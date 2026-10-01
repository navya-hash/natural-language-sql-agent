from pydantic import BaseModel


class ChatRequest(BaseModel):
    question: str
    thread_id: str | None = None


class ConnectRequest(BaseModel):

    db_type: str

    host: str | None = None

    port: int | None = None

    username: str | None = None

    password: str | None = None

    database: str | None = None