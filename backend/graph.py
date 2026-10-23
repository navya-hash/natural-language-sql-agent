
import os
from psycopg_pool import ConnectionPool
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import START, END, StateGraph

from state import GraphState
from nodes import (
    gen_sql,
    execute_sql,
    answer,
    validate_node,
    retry_node,
    failed_node,
    analyze_node,
    chart_node,
    insight_node,
)
from routes import validate_route, execute_route


def build_graph():
    graph = StateGraph(GraphState)

    graph.add_node("generate_sql", gen_sql)
    graph.add_node("validate_sql", validate_node)
    graph.add_node("execute_sql", execute_sql)
    graph.add_node("retry_sql", retry_node)
    graph.add_node("answer_query", answer)
    graph.add_node("failed", failed_node)
    graph.add_node("analyze", analyze_node)
    graph.add_node("chart", chart_node)
    graph.add_node("insights", insight_node)

    graph.add_edge(START, "generate_sql")
    graph.add_edge("generate_sql", "validate_sql")

    graph.add_conditional_edges(
        "validate_sql",
        validate_route,
        {
            "execute": "execute_sql",
            "retry": "retry_sql",
            "failed": "failed",
        },
    )

    graph.add_edge("retry_sql", "validate_sql")

    graph.add_conditional_edges(
        "execute_sql",
        execute_route,
        {
            "analyze": "analyze",
            "retry": "retry_sql",
            "failed": "failed",
        },
    )
    graph.add_edge("analyze", "chart")
    graph.add_edge("chart", "insights")
    graph.add_edge("insights", "answer_query")
    graph.add_edge("answer_query", END)
    graph.add_edge("failed", END)

    return graph


def create_checkpointer_pool():
    database_url = os.environ["LANGGRAPH_CHECKPOINT_URL"]

    pool = ConnectionPool(
        conninfo=database_url,
        min_size=1,
        max_size=10,
        kwargs={
            "autocommit": True,
            "prepare_threshold": 0,
        },
        open=False,
    )

    return pool


def build_workflow(pool):
    checkpointer = PostgresSaver(pool)

    # Creates LangGraph checkpoint tables if they don't exist.
    checkpointer.setup()

    return build_graph().compile(checkpointer=checkpointer)

