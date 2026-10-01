import os
import sqlite3
from langgraph.graph import START, END, StateGraph
from state import GraphState
from nodes import gen_sql, execute_sql, answer, validate_node, retry_node, failed_node, analyze_node, chart_node, insight_node
from routes import validate_route

# Previously used MemorySaver:
# from langgraph.checkpoint.memory import InMemorySaver
# memory = InMemorySaver()

from langgraph.checkpoint.sqlite import SqliteSaver

# Setup persistent SQLite checkpointer
db_path = os.path.join(os.path.dirname(__file__), "checkpoints.sqlite")
conn = sqlite3.connect(db_path, check_same_thread=False)
memory = SqliteSaver(conn)
memory.setup()

# define graph
graph = StateGraph(GraphState)

# add nodes
graph.add_node("generate_sql", gen_sql)
graph.add_node("validate_sql", validate_node)
graph.add_node("execute_sql", execute_sql)
graph.add_node("retry_sql", retry_node)
graph.add_node("answer_query", answer)
graph.add_node("failed", failed_node)
graph.add_node("analyze", analyze_node)
graph.add_node("chart", chart_node)
graph.add_node("insights", insight_node)

# add edges
graph.add_edge(START, "generate_sql")
graph.add_edge("generate_sql", "validate_sql")
graph.add_conditional_edges("validate_sql", validate_route, {
    "execute": "execute_sql",
    "retry": "retry_sql",
    "failed": "failed",
})
graph.add_edge("retry_sql", "validate_sql")
graph.add_edge("execute_sql", "analyze")
graph.add_edge("analyze", "chart")
graph.add_edge("chart", "insights")
graph.add_edge("insights", "answer_query")

graph.add_edge("answer_query", END)
graph.add_edge("failed", END)

workflow = graph.compile(checkpointer=memory)

# The primary purpose of adding checkpointer=memory when compiling a LangGraph workflow is state persistence across turns and execution control.
#Without a checkpointer, calling graph.invoke() treats every execution as a completely isolated event. With a checkpointer, LangGraph automatically saves a snapshot of the state after every step, keyed by a thread ID.
#InMemorySaver() is LangGraph's simplest checkpointer—an in-memory key-value database that saves snapshots of your graph's state in Python's RAM as your workflow runs.
# Its primary use is to give your graph short-term state persistence without needing to set up an external database like PostgreSQL or Redis.
#For production applications or multi-user environments where state must endure server restarts and deployments, you need to use Production Checkpointers 
# like PostgresSaver or SqliteSaver