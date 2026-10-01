#here we define the state of graph
from typing import TypedDict,Annotated
from langgraph.graph.message import add_messages

#here add_messages is used as a  reducer function
#messages becomes our conversation history
class GraphState(TypedDict):
    messages:Annotated[list,add_messages]
    question: str
    sql: str
    is_valid: bool
    retries: int
    # result: list[]
    result: list[dict]
    answer: str
    # table: list
    chart: dict
    insights: str
    analysis: dict
    