from sql_generator import generate_sql
# from database import run_sql
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
        state["question"],
        state["messages"]

    )

    return state

def validate_node(state):

    try:

        state["sql"] = validate_sql(state["sql"])

        state["is_valid"] = True

    except Exception:

        state["is_valid"] = False

    return state

def retry_node(state):

    state["retries"] += 1

    state["sql"] = retry_sql(
        state["question"],
        state["sql"]
    )

    return state

def execute_sql(state):
    state['result']=db.run_sql(state['sql'])
    return state

def answer(state):
    prompt = f"""
Question:

{state["question"]}

SQL Result:

{state["result"]}

Answer naturally.
"""

    response = llm.invoke(prompt)

    if isinstance(response.content, list):
        state["answer"] = response.content[0]["text"]
    else:
        state["answer"] = response.content

    state["messages"].append(
        HumanMessage(content=state["question"])
    )

    state["messages"].append(
        AIMessage(content=state["answer"])
    )

    return state


def failed_node(state):

    state["answer"] = (
        "Sorry, I couldn't generate a valid SQL query after multiple attempts."
    )

    return state




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

    if state["analysis"]["generate_insights"]:

        state["insights"] = generate_insights(

            state["question"],

            state["result"]

        )

    else:

        state["insights"] = ""

    return state
