from sql_generator import generate_sql
from database import db
from llm import llm
from state import GraphState
from sql_validator import validate_sql
from retry_generator import retry_sql
from langchain_core.messages import HumanMessage, AIMessage
from analyzer import analyze
from chart_generator import generate_chart
from insight_generator import generate_insights


def gen_sql(state):
    state["sql"] = generate_sql(
        question=state["question"],
        messages=state["messages"],
        connection_id=state["connection_id"],
    )

    return state

def validate_node(state):
    try:
        state["sql"] = validate_sql(state["sql"])
        state["is_valid"] = True
        state["error"] = None
    except Exception as exc:
        state["is_valid"] = False
        state["error"] = str(exc)

    return state


def retry_node(state):
    state["retries"] += 1

    state["sql"] = retry_sql(
        question=state["question"],
        invalid_sql=state["sql"],
        connection_id=state["connection_id"],
        error_message=state.get("error"),
    )

    return state


def execute_sql(state: GraphState):
    try:
        state["result"] = db.run_sql(
            connection_id=state["connection_id"],
            query=state["sql"],
        )
        state["is_valid"] = True
        state["error"] = None
    except Exception as exc:
        state["result"] = []
        state["is_valid"] = False
        state["error"] = str(exc)

    return state


def answer(state: GraphState):
    prompt = f"""
Question:
{state["question"]}

SQL Result:
{state["result"]}

Answer naturally and accurately based on the SQL result.
"""

    response = llm.invoke(prompt)

    if isinstance(response.content, list):
        answer_text = "".join(
            item["text"]
            for item in response.content
            if isinstance(item, dict) and item.get("type") == "text"
        )
    else:
        answer_text = response.content

    return {
        "answer": answer_text,
        "messages": [
            HumanMessage(content=state["question"]),
            AIMessage(content=answer_text),
        ],
    }


def failed_node(state):
    err = state.get("error")
    if err:
        msg = f"Sorry, I couldn't execute a valid SQL query after multiple attempts. Error: {err}"
    else:
        msg = "Sorry, I couldn't generate a valid SQL query after multiple attempts."

    state["answer"] = msg
    return {
        "answer": msg,
        "messages": [
            HumanMessage(content=state["question"]),
            AIMessage(content=msg),
        ],
    }



def analyze_node(state):

    state["analysis"] = analyze(

        state["question"],

        state["result"]

    )

    return state



def chart_node(state):

    state["chart"] = generate_chart(

        state["result"],

        state["analysis"]

    )

    return state




def insight_node(state):
    if state.get("analysis", {}).get("generate_insights", False):
        state["insights"] = generate_insights(
            state["question"],
            state["result"]
        )
    else:
        state["insights"] = ""

    return state
