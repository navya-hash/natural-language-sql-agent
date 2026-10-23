

from pathlib import Path
from threading import RLock
from uuid import uuid4

from sqlalchemy import URL, MetaData, Table, create_engine, inspect, select, text
from sqlalchemy.engine import Engine

from urllib.parse import unquote, urlparse

from app_database import (
    SessionLocal,
    DatabaseConnection,
    decrypt_database_url,
)

class ConnectionNotFoundError(ValueError):
    """Raised when a connection ID does not exist in memory or Neon."""


class DatabaseManager:
    """Manage multiple database engines, indexed by connection ID."""

    def __init__(self):
        self._engines: dict[str, Engine] = {}
        self._lock = RLock()

    def connect(self, database_url, connection_id=None):
        """Create and register a database connection."""
        connection_id = connection_id or str(uuid4())
        engine = create_engine(database_url, pool_pre_ping=True)

        try:
            # Verify the connection before registering it.
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception:
            engine.dispose()
            raise

        with self._lock:
            old_engine = self._engines.get(connection_id)
            self._engines[connection_id] = engine

        if old_engine is not None:
            old_engine.dispose()

        return connection_id


    
    def _get_engine(self, connection_id):
        """Return an active engine, restoring it from Neon when necessary."""
        with self._lock:
            engine = self._engines.get(connection_id)

        if engine is not None:
            return engine

        return self._restore_connection(connection_id)


    def _restore_connection(self, connection_id):
        """Restore a previously saved database connection from Neon."""
        with SessionLocal() as session:
            record = session.get(DatabaseConnection, connection_id)

            if record is None:
                raise ConnectionNotFoundError(
                    f"Database connection '{connection_id}' was not found."
                )

            if not record.encrypted_url:
                raise ValueError(
                    f"Connection '{connection_id}' has no saved connection details."
                )

            db_type = record.db_type.lower()
            encrypted_url = record.encrypted_url

        # Decrypt only after retrieving the record. Never log this value.
        saved_value = decrypt_database_url(encrypted_url)

        # Another request may have restored this connection while we queried Neon.
        with self._lock:
            engine = self._engines.get(connection_id)

        if engine is not None:
            return engine

        if db_type == "sqlite":
            # New records should store an absolute filesystem path.
            # This also supports older records saved as file:// URIs.
            if saved_value.startswith("file:"):
                parsed = urlparse(saved_value)
                filepath = unquote(parsed.path)

                # Handle Windows file URIs such as file:///C:/data/db.sqlite
                if len(filepath) >= 3 and filepath[0] == "/":
                    if filepath[1].isalpha() and filepath[2] == ":":
                        filepath = filepath[1:]
            else:
                filepath = saved_value

            self.connect_sqlite(filepath, connection_id=connection_id)

        elif db_type in ("mysql", "postgres", "postgresql"):
            # SQLAlchemy URLs are restored using the saved driver and credentials.
            self.connect(saved_value, connection_id=connection_id)

        else:
            raise ValueError(
                f"Unsupported saved database type: '{db_type}'."
            )

        with self._lock:
            return self._engines[connection_id]


    def is_connected(self, connection_id):
        """Check whether a connection exists and can be restored."""
        try:
            self._get_engine(connection_id)
            return True
        except ConnectionNotFoundError:
            return False


    def connect_sqlite(self, filepath, connection_id=None):
        path = Path(filepath).resolve()

        if not path.is_file():
            raise FileNotFoundError("SQLite database file was not found.")

        # URL.create handles path escaping correctly.
        url = URL.create(
            "sqlite",
            database=str(path),
        )
        return self.connect(url, connection_id)

    def connect_mysql(
        self, host, port, username, password, database, connection_id=None
    ):
        url = URL.create(
            drivername="mysql+pymysql",
            username=username,
            password=password,
            host=host,
            port=port,
            database=database,
        )
        return self.connect(url, connection_id)

    def connect_postgres(
        self, host, port, username, password, database, connection_id=None
    ):
        url = URL.create(
            drivername="postgresql+psycopg2",
            username=username,
            password=password,
            host=host,
            port=port,
            database=database,
        )
        return self.connect(url, connection_id)

    def get_tables(self, connection_id):
        engine = self._get_engine(connection_id)
        return inspect(engine).get_table_names()

    def get_dialect(self, connection_id) -> str:
        engine = self._get_engine(connection_id)
        return engine.dialect.name.lower()

    def get_schema(self, connection_id):
        engine = self._get_engine(connection_id)
        inspector = inspect(engine)
        lines = []

        for table_name in inspector.get_table_names():
            lines.append(f"\nTable: {table_name}")

            for column in inspector.get_columns(table_name):
                lines.append(f"{column['name']} ({column['type']})")

        return "\n".join(lines)

    def get_schema_dict(self, connection_id):
        engine = self._get_engine(connection_id)
        inspector = inspect(engine)
        schema = {}

        for table_name in inspector.get_table_names():
            schema[table_name] = [
                {
                    "name": column["name"],
                    "type": str(column["type"]),
                }
                for column in inspector.get_columns(table_name)
            ]

        return schema

    def get_table_preview(self, connection_id, table_name, limit=10):
        if not isinstance(limit, int) or not 1 <= limit <= 100:
            raise ValueError("Preview limit must be between 1 and 100.")

        engine = self._get_engine(connection_id)
        inspector = inspect(engine)

        if table_name not in inspector.get_table_names():
            raise ValueError(f"Table '{table_name}' does not exist.")

        metadata = MetaData()

        table = Table(
            table_name,
            metadata,
            autoload_with=engine,
        )

        with engine.connect() as conn:
            result = conn.execute(select(table).limit(limit))
            return [dict(row._mapping) for row in result]

    def run_sql(self, connection_id, query):
        """Execute SQL against the explicitly selected database.

        Read-only SQL enforcement must be implemented before production use.
        """
        engine = self._get_engine(connection_id)

        with engine.connect() as conn:
            result = conn.execute(text(query))
            return [dict(row._mapping) for row in result]

    def close_connection(self, connection_id):
        with self._lock:
            engine = self._engines.pop(connection_id, None)

        if engine is not None:
            engine.dispose()

    def close_all(self):
        with self._lock:
            engines = list(self._engines.values())
            self._engines.clear()

        for engine in engines:
            engine.dispose()


db = DatabaseManager()
