
#Application Database layer

import os
from sqlalchemy import Text
from dotenv import load_dotenv
from sqlalchemy import (
    create_engine,
    String,
    DateTime,
    ForeignKey,
    func,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    sessionmaker,
)
from cryptography.fernet import Fernet


# load_dotenv()
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_ENV_PATH = BASE_DIR / ".env"

load_dotenv(ROOT_ENV_PATH, override=False)

def _get_fernet():
    key = os.environ.get("CONNECTION_ENCRYPTION_KEY")

    if not key:
        raise RuntimeError(
            "CONNECTION_ENCRYPTION_KEY is missing from .env"
        )

    return Fernet(key.encode())


def encrypt_database_url(database_url: str) -> str:
    return _get_fernet().encrypt(
        database_url.encode()
    ).decode()


def decrypt_database_url(encrypted_url: str) -> str:
    return _get_fernet().decrypt(
        encrypted_url.encode()
    ).decode()



DATABASE_URL = os.environ["APP_DATABASE_URL"]

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass

class DatabaseConnection(Base):
    __tablename__ = "database_connections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(100), index=True)
    name: Mapped[str] = mapped_column(String(255))
    db_type: Mapped[str] = mapped_column(String(30))
    encrypted_url: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class Conversation(Base):
    __tablename__ = "conversations"

    thread_id: Mapped[str] = mapped_column(
        String(36), primary_key=True
    )
    owner_id: Mapped[str] = mapped_column(
        String(100), index=True
    )
    connection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("database_connections.id"),
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255), default="New conversation"
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


def init_app_database():
    Base.metadata.create_all(bind=engine)



# Table	                     Purpose
# database_connections	Records metadata about each saved database connection.
# conversations	Records conversation IDs and which database connection each conversation uses.