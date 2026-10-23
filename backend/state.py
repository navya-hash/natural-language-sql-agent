#here we define the state of graph
# from typing import TypedDict,Annotated
# from langgraph.graph.message import add_messages

# #here add_messages is used as a  reducer function
# #messages becomes our conversation history
# class GraphState(TypedDict):
#     messages:Annotated[list,add_messages]
#     question: str
#     sql: str
#     is_valid: bool
#     retries: int
#     # result: list[]
#     result: list[dict]
#     answer: str
#     # table: list
#     chart: dict
#     insights: str
#     analysis: dict



from typing import Annotated, TypedDict, Any
from langgraph.graph.message import add_messages


class GraphState(TypedDict):
    # Conversation history, merged using LangGraph's message reducer.
    messages: Annotated[list, add_messages]

    # Identifies the database associated with this conversation.
    connection_id: str

    question: str
    sql: str
    is_valid: bool
    retries: int
    result: list[dict[str, Any]]
    answer: str
    chart: dict[str, Any]
    insights: str
    analysis: dict[str, Any]
    error: str | None

    