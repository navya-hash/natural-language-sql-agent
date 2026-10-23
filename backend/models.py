# from pydantic import BaseModel


# class ChatRequest(BaseModel):
#     question: str
#     thread_id: str | None = None


# class ConnectRequest(BaseModel):

#     db_type: str

#     host: str | None = None

#     port: int | None = None

#     username: str | None = None

#     password: str | None = None

#     database: str | None = None


# from pydantic import BaseModel, Field


# class ChatRequest(BaseModel):
#     question: str = Field(min_length=1, max_length=10_000)
#     thread_id: str | None = None
#     connection_id: str = Field(min_length=1)


# class ConnectRequest(BaseModel):
#     db_type: str
#     host: str
#     port: int
#     username: str
#     password: str
#     database: str



from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=10_000)
    thread_id: str | None = None
    connection_id: str = Field(min_length=1)


class ConnectRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    db_type: Literal["mysql", "postgres", "postgresql"]

    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=4096)
    database: str = Field(min_length=1, max_length=255)

class RenameConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)