from fastapi import FastAPI
from pydantic import BaseModel

from graph import workflow
from pathlib import Path

from models import ChatRequest
from models import ConnectRequest

from database import db
from fastapi import UploadFile, File
import shutil
import os
from uuid import uuid4


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.post("/connect")
def connect(request: ConnectRequest):

    try:

        if request.db_type.lower() == "mysql":

            db.connect_mysql(

                request.host,

                request.port,

                request.username,

                request.password,

                request.database

            )

        elif request.db_type.lower() == "postgres":

            db.connect_postgres(

                request.host,

                request.port,

                request.username,

                request.password,

                request.database

            )

        else:

            return {

                "success": False,

                "message": "Unsupported database."

            }

        return {

            "success": True,

            "message": "Database connected successfully."

        }

    except Exception as e:

        return {

            "success": False,

            "message": str(e)

        }

@app.post("/upload-sqlite")
def upload_sqlite(file: UploadFile = File(...)):

    try:

        if not (
            file.filename.endswith(".sqlite")
            or file.filename.endswith(".db")
        ):
            return {
                "success": False,
                "message": "Please upload a .sqlite or .db file."
            }

        os.makedirs("uploads", exist_ok=True)

        filepath = os.path.join("uploads", file.filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        db.connect_sqlite(filepath)

        return {

            "success": True,

            "message": "SQLite database connected successfully."

        }

    except Exception as e:

        return {

            "success": False,

            "message": str(e)

        }

@app.get("/tables")
def get_tables():

    try:

        tables = db.get_tables()

        return {
            "success": True,
            "tables": tables
        }

    except Exception as e:

        return {
            "success": False,
            "message": str(e)
        }

@app.get("/schema")
def get_schema():

    try:

        schema = db.get_schema_dict()

        return {
            "success": True,
            "schema": schema
        }

    except Exception as e:

        return {
            "success": False,
            "message": str(e)
        }

@app.get("/preview/{table_name}")
def preview_table(table_name: str):

    try:

        rows = db.get_table_preview(table_name)

        return {
            "success": True,
            "table": table_name,
            "rows": rows
        }

    except Exception as e:

        return {
            "success": False,
            "message": str(e)
        }

@app.post("/chat")
def chat(request: ChatRequest):

    state = {

        "messages": [],

        "question": request.question,

        "sql": "",

        "retries": 0,

        "is_valid": False,

        "result": [],

        "analysis": {},

        "chart": {},

        "insights": "",

        "answer": ""

    }

    # Use existing thread if provided.
    # Otherwise create a new thread.
    thread_id = request.thread_id or str(uuid4())

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    result = workflow.invoke(
        state,
        config=config
    )

    return {

        "thread_id": thread_id,

        "question": result["question"],

        "sql": result["sql"],

        "result": result["result"],

        "answer": result["answer"],

        "analysis": result["analysis"],

        "chart": result["chart"],

        "insights": result["insights"]

    }