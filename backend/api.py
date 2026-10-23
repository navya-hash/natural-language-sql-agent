import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import URL, func, select

from app_database import (
    Conversation,
    DatabaseConnection,
    SessionLocal,
    encrypt_database_url,
)
from auth import require_user
from database import db
from graph import build_workflow, create_checkpointer_pool
from models import ChatRequest, ConnectRequest, RenameConversationRequest

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = Path(os.getenv("SQLITE_UPLOAD_DIR", str(BASE_DIR / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MiB


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = create_checkpointer_pool()
    try:
        pool.open()
        pool.wait()
        app.state.workflow = build_workflow(pool)
        yield
    finally:
        pool.close()


app = FastAPI(title="Natural Language SQL Agent", lifespan=lifespan)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS", "http://localhost:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def get_owned_connection(connection_id: str, user_id: str) -> DatabaseConnection:
    """Return a connection only if it belongs to the authenticated Clerk user."""
    with SessionLocal() as session:
        connection = session.get(DatabaseConnection, connection_id)
        if connection is None or connection.owner_id != user_id:
            # Use 404 to avoid revealing another user's connection IDs.
            raise HTTPException(
                status_code=404, detail="Database connection not found."
            )
        # Return a detached model object; its fields remain usable after session close.
        return connection


def ensure_connection_available(connection_id: str) -> None:
    if not db.is_connected(connection_id):
        raise HTTPException(
            status_code=503,
            detail="Database connection could not be restored. Reconnect and try again.",
        )


def get_owned_conversation(
    thread_id: str, user_id: str
) -> Conversation:
    """Return a conversation only if it belongs to the authenticated Clerk user."""
    with SessionLocal() as session:
        conversation = session.get(Conversation, thread_id)
        if conversation is None or conversation.owner_id != user_id:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        # Return the detached model; callers only read its scalar fields.
        return conversation


@app.post("/connect")
def connect(
    request: ConnectRequest,
    user_id: str = Depends(require_user),
):
    connection_id = str(uuid4())
    engine_registered = False

    try:
        db_type = request.db_type.lower()

        if db_type == "mysql":
            database_url = URL.create(
                drivername="mysql+pymysql",
                username=request.username,
                password=request.password,
                host=request.host,
                port=request.port,
                database=request.database,
            )
        elif db_type in ("postgres", "postgresql"):
            database_url = URL.create(
                drivername="postgresql+psycopg2",
                username=request.username,
                password=request.password,
                host=request.host,
                port=request.port,
                database=request.database,
            )
        else:
            raise HTTPException(
                status_code=422, detail="Unsupported database type."
            )

        plain_url = database_url.render_as_string(hide_password=False)
        encrypted_url = encrypt_database_url(plain_url)

        # Verify the target database before persisting its connection details.
        db.connect(database_url, connection_id=connection_id)
        engine_registered = True

        with SessionLocal() as session:
            record = DatabaseConnection(
                id=connection_id,
                owner_id=user_id,
                name=request.database,
                db_type=db_type,
                encrypted_url=encrypted_url,
            )
            session.add(record)
            session.commit()

        return {
            "success": True,
            "connection_id": connection_id,
            "message": "Database connected and saved successfully.",
        }

    except HTTPException:
        if engine_registered:
            db.close_connection(connection_id)
        raise
    except Exception:
        if engine_registered:
            db.close_connection(connection_id)
        logger.exception("Database connection failed")
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not connect and save the database connection. "
                "Check the connection settings and application database."
            ),
        )


@app.post("/upload-sqlite")
def upload_sqlite(
    file: UploadFile = File(...),
    user_id: str = Depends(require_user),
):
    filepath = None
    connection_id = str(uuid4())
    engine_registered = False

    try:
        original_name = file.filename or ""
        if Path(original_name).suffix.lower() not in {".sqlite", ".db"}:
            raise HTTPException(
                status_code=400,
                detail="Please upload a .sqlite or .db file.",
            )

        filepath = UPLOAD_DIR / f"{connection_id}.sqlite"
        filepath.parent.mkdir(parents=True, exist_ok=True)
        total_size = 0

        with filepath.open("wb") as destination:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Database file exceeds the 50 MiB limit.",
                    )
                destination.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=400, detail="The uploaded file is empty."
            )

        # Run a basic integrity check before accepting the database.
        with sqlite3.connect(
            filepath.resolve().as_uri() + "?mode=ro", uri=True
        ) as sqlite_conn:
            check = sqlite_conn.execute("PRAGMA quick_check").fetchone()
            if not check or check[0] != "ok":
                raise HTTPException(
                    status_code=400,
                    detail="The uploaded SQLite database failed validation.",
                )

        db.connect_sqlite(str(filepath.resolve()), connection_id=connection_id)
        engine_registered = True
        encrypted_path = encrypt_database_url(str(filepath.resolve()))

        with SessionLocal() as session:
            record = DatabaseConnection(
                id=connection_id,
                owner_id=user_id,
                name=Path(original_name).name,
                db_type="sqlite",
                encrypted_url=encrypted_path,
            )
            session.add(record)
            session.commit()

        return {
            "success": True,
            "connection_id": connection_id,
            "message": "SQLite database uploaded and saved successfully.",
        }

    except HTTPException:
        if engine_registered:
            db.close_connection(connection_id)
        if filepath and filepath.exists():
            filepath.unlink(missing_ok=True)
        raise
    except Exception:
        logger.exception("SQLite upload failed")
        if engine_registered:
            db.close_connection(connection_id)
        if filepath and filepath.exists():
            filepath.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="Could not validate, connect, or save the SQLite database.",
        )
    finally:
        file.file.close()


@app.get("/tables")
def get_tables(
    connection_id: str = Query(min_length=1),
    user_id: str = Depends(require_user),
):
    get_owned_connection(connection_id, user_id)
    ensure_connection_available(connection_id)
    try:
        return {"success": True, "tables": db.get_tables(connection_id)}
    except ValueError:
        raise HTTPException(
            status_code=404, detail="Database connection not found."
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not retrieve tables")
        raise HTTPException(status_code=400, detail="Could not retrieve tables.")


@app.get("/schema")
def get_schema(
    connection_id: str = Query(min_length=1),
    user_id: str = Depends(require_user),
):
    get_owned_connection(connection_id, user_id)
    ensure_connection_available(connection_id)
    try:
        return {"success": True, "schema": db.get_schema_dict(connection_id)}
    except ValueError:
        raise HTTPException(
            status_code=404, detail="Database connection not found."
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not retrieve schema")
        raise HTTPException(
            status_code=400, detail="Could not retrieve database schema."
        )


@app.get("/preview/{table_name}")
def preview_table(
    table_name: str,
    connection_id: str = Query(min_length=1),
    user_id: str = Depends(require_user),
):
    get_owned_connection(connection_id, user_id)
    ensure_connection_available(connection_id)
    try:
        rows = db.get_table_preview(
            connection_id=connection_id,
            table_name=table_name,
        )
        return {"success": True, "table": table_name, "rows": rows}
    except ValueError as exc:
        if "not found" in str(exc).lower() or "does not exist" in str(exc).lower():
            raise HTTPException(status_code=404, detail=str(exc))
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not preview table")
        raise HTTPException(
            status_code=400, detail="Could not preview the selected table."
        )


@app.post("/chat")
def chat(
    request: ChatRequest,
    user_id: str = Depends(require_user),
):
    # Verify ownership before touching the database or LangGraph state.
    get_owned_connection(request.connection_id, user_id)
    ensure_connection_available(request.connection_id)

    thread_id = request.thread_id or str(uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    workflow = app.state.workflow

    try:
        with SessionLocal() as session:
            conversation = session.get(Conversation, thread_id)
            if conversation is not None:
                if conversation.owner_id != user_id:
                    raise HTTPException(
                        status_code=404, detail="Conversation not found."
                    )
                if conversation.connection_id != request.connection_id:
                    # User reconnected or selected an active connection: seamlessly rebind
                    logger.info(
                        "Rebinding conversation %s from connection %s to %s",
                        thread_id,
                        conversation.connection_id,
                        request.connection_id,
                    )
                    conversation.connection_id = request.connection_id
                    session.commit()

        snapshot = workflow.get_state(config)
        existing_state = snapshot.values or {}
        existing_connection_id = existing_state.get("connection_id")

        if (
            existing_connection_id is not None
            and existing_connection_id != request.connection_id
        ):
            # Synchronize checkpoint state with newly bound connection
            workflow.update_state(config, {"connection_id": request.connection_id})

        question_input = {
            "question": request.question,
            "connection_id": request.connection_id,
            "sql": "",
            "retries": 0,
            "is_valid": False,
            "result": [],
            "analysis": {},
            "chart": {},
            "insights": "",
            "answer": "",
            "error": None,
        }
        input_state = (
            question_input
            if existing_state
            else {**question_input, "messages": []}
        )

        result = workflow.invoke(input_state, config=config)

        with SessionLocal() as session:
            conversation = session.get(Conversation, thread_id)
            if conversation is None:
                conversation = Conversation(
                    thread_id=thread_id,
                    owner_id=user_id,
                    connection_id=request.connection_id,
                    title=request.question.strip()[:255] or "New conversation",
                )
                session.add(conversation)
            else:
                # Re-check ownership before updating metadata.
                if conversation.owner_id != user_id:
                    raise HTTPException(
                        status_code=404, detail="Conversation not found."
                    )
                conversation.updated_at = func.now()
            session.commit()

        serialized_messages = []
        for message in result.get("messages", []):
            if hasattr(message, "model_dump"):
                serialized_messages.append(message.model_dump())
            else:
                serialized_messages.append(
                    {
                        "type": getattr(message, "type", "unknown"),
                        "content": getattr(message, "content", ""),
                    }
                )

        return {
            "thread_id": thread_id,
            "question": result.get("question"),
            "sql": result.get("sql"),
            "result": result.get("result"),
            "answer": result.get("answer"),
            "analysis": result.get("analysis"),
            "chart": result.get("chart"),
            "insights": result.get("insights"),
            "messages": serialized_messages,
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Chat execution failed")
        raise HTTPException(
            status_code=500,
            detail="The SQL agent could not process this question.",
        )


@app.get("/connections")
def list_connections(user_id: str = Depends(require_user)):
    try:
        with SessionLocal() as session:
            statement = (
                select(DatabaseConnection)
                .where(DatabaseConnection.owner_id == user_id)
                .order_by(DatabaseConnection.created_at.desc())
            )
            connections = session.scalars(statement).all()
            return {
                "success": True,
                "connections": [
                    {
                        "id": conn.id,
                        "name": conn.name,
                        "db_type": conn.db_type,
                        "created_at": (
                            conn.created_at.isoformat()
                            if conn.created_at
                            else None
                        ),
                        "is_connected": db.is_connected(conn.id),
                    }
                    for conn in connections
                ],
            }
    except Exception:
        logger.exception("Failed to list connections")
        raise HTTPException(
            status_code=500, detail="Could not retrieve database connections."
        )


@app.get("/conversations")
def list_conversations(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(require_user),
):
    try:
        with SessionLocal() as session:
            statement = (
                select(Conversation, DatabaseConnection.name, DatabaseConnection.db_type)
                .outerjoin(
                    DatabaseConnection,
                    Conversation.connection_id == DatabaseConnection.id,
                )
                .where(Conversation.owner_id == user_id)
                .order_by(Conversation.updated_at.desc())
                .offset(offset)
                .limit(limit)
            )
            rows = session.execute(statement).all()
            return {
                "conversations": [
                    {
                        "thread_id": conv.thread_id,
                        "connection_id": conv.connection_id,
                        "connection_name": db_name or "Unknown Database",
                        "db_type": db_type or "unknown",
                        "title": conv.title,
                        "created_at": (
                            conv.created_at.isoformat()
                            if conv.created_at
                            else None
                        ),
                        "updated_at": (
                            conv.updated_at.isoformat()
                            if conv.updated_at
                            else None
                        ),
                    }
                    for conv, db_name, db_type in rows
                ],
                "limit": limit,
                "offset": offset,
            }
    except Exception:
        logger.exception("Failed to list conversations")
        raise HTTPException(
            status_code=500, detail="Could not retrieve conversations."
        )


@app.get("/conversations/{thread_id}/messages")
def get_conversation_messages(
    thread_id: str,
    user_id: str = Depends(require_user),
):
    try:
        conversation = get_owned_conversation(thread_id, user_id)
        
        # Check connection status and attempt restoration if needed
        is_conn_active = False
        conn_name = "Unknown Database"
        db_type = "unknown"
        with SessionLocal() as session:
            conn_record = session.get(DatabaseConnection, conversation.connection_id)
            if conn_record and conn_record.owner_id == user_id:
                conn_name = conn_record.name
                db_type = conn_record.db_type
                is_conn_active = db.is_connected(conversation.connection_id)

        conversation_data = {
            "thread_id": conversation.thread_id,
            "connection_id": conversation.connection_id,
            "connection_name": conn_name,
            "db_type": db_type,
            "is_connected": is_conn_active,
            "title": conversation.title,
            "created_at": (
                conversation.created_at.isoformat()
                if conversation.created_at
                else None
            ),
            "updated_at": (
                conversation.updated_at.isoformat()
                if conversation.updated_at
                else None
            ),
        }

        workflow = app.state.workflow
        config = {"configurable": {"thread_id": thread_id}}
        snapshot = workflow.get_state(config)
        state = snapshot.values or {}
        if not state:
            raise HTTPException(
                status_code=404, detail="Conversation history not found."
            )

        messages = []
        for message in state.get("messages", []):
            if hasattr(message, "model_dump"):
                serialized = message.model_dump()
            else:
                serialized = {
                    "type": getattr(message, "type", "unknown"),
                    "content": getattr(message, "content", ""),
                }
            messages.append(serialized)

        return {"conversation": conversation_data, "messages": messages}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to retrieve conversation messages")
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve conversation messages.",
        )


@app.delete("/conversations/{thread_id}")
def delete_conversation(
    thread_id: str,
    user_id: str = Depends(require_user),
):
    try:
        # Verify ownership before deleting the checkpoint or metadata.
        get_owned_conversation(thread_id, user_id)

        workflow = app.state.workflow
        workflow.checkpointer.delete_thread(thread_id)

        with SessionLocal() as session:
            conversation = session.get(Conversation, thread_id)
            if conversation is not None and conversation.owner_id == user_id:
                session.delete(conversation)
                session.commit()

        return {
            "success": True,
            "thread_id": thread_id,
            "message": "Conversation deleted successfully.",
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to delete conversation")
        raise HTTPException(
            status_code=500, detail="Could not delete the conversation."
        )


@app.patch("/conversations/{thread_id}")
def rename_conversation(
    thread_id: str,
    request: RenameConversationRequest,
    user_id: str = Depends(require_user),
):
    title = request.title.strip()
    if not title:
        raise HTTPException(
            status_code=422, detail="Conversation title cannot be empty."
        )

    try:
        with SessionLocal() as session:
            conversation = session.get(Conversation, thread_id)
            if conversation is None or conversation.owner_id != user_id:
                raise HTTPException(
                    status_code=404, detail="Conversation not found."
                )

            conversation.title = title
            conversation.updated_at = func.now()
            session.commit()
            session.refresh(conversation)

            return {
                "success": True,
                "thread_id": conversation.thread_id,
                "title": conversation.title,
                "updated_at": (
                    conversation.updated_at.isoformat()
                    if conversation.updated_at
                    else None
                ),
            }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to rename conversation")
        raise HTTPException(
            status_code=500, detail="Could not rename the conversation."
        )
