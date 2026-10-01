import sys
import os
import sqlite3
import time

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

# Create sample sqlite database
sample_db_path = os.path.join(backend_dir, "uploads", "test_sample.sqlite")
os.makedirs(os.path.dirname(sample_db_path), exist_ok=True)
conn_sample = sqlite3.connect(sample_db_path)
conn_sample.execute("CREATE TABLE IF NOT EXISTS products (id INT, name TEXT, price REAL)")
conn_sample.execute("DELETE FROM products")
conn_sample.execute("INSERT INTO products VALUES (1, 'Laptop', 1200.0), (2, 'Phone', 800.0)")
conn_sample.commit()
conn_sample.close()

from database import db
db.connect_sqlite(sample_db_path)

# Helper function to invoke workflow with retry on rate limit
def invoke_with_retry(wf, state, config, max_retries=3):
    for attempt in range(max_retries):
        try:
            return wf.invoke(state, config=config)
        except Exception as e:
            if "RESOURCE_EXHAUSTED" in str(e) or "429" in str(e):
                print(f"Rate limit hit. Sleeping 25s before retry (attempt {attempt+1}/{max_retries})...")
                time.sleep(25)
            else:
                raise e
    return wf.invoke(state, config=config)

print("--- Initializing Backend Workflow ---")
import graph

# Step 1: Thread-1 First Question
print("\n--- Running Thread-1 First Turn ---")
config_t1 = {"configurable": {"thread_id": "thread-1"}}
initial_state_t1 = {
    "messages": [],
    "question": "How many products are in the database?",
    "sql": "",
    "retries": 0,
    "is_valid": False,
    "result": [],
    "analysis": {},
    "chart": {},
    "insights": "",
    "answer": ""
}

res1 = invoke_with_retry(graph.workflow, initial_state_t1, config_t1)
print(f"Thread-1 Question: {res1['question']}")
print(f"Thread-1 Generated SQL: {res1['sql']}")
print(f"Thread-1 Answer: {res1['answer']}")

state_t1_after_turn1 = graph.workflow.get_state(config_t1)
messages_count_t1_turn1 = len(state_t1_after_turn1.values.get("messages", []))
print(f"Thread-1 Message Count in State: {messages_count_t1_turn1}")
assert messages_count_t1_turn1 >= 2, "Expected at least 2 messages in thread-1 after turn 1"

# Close database connection to simulate backend restart
graph.conn.close()

print("\n--- SIMULATING BACKEND RESTART ---")
# Force re-import / re-connection of graph module
if "graph" in sys.modules:
    del sys.modules["graph"]

import graph as graph_restarted

print("\n--- Verifying Thread-1 State Restored After Restart ---")
restarted_state_t1 = graph_restarted.workflow.get_state(config_t1)
restored_messages_t1 = restarted_state_t1.values.get("messages", [])
print(f"Restored Thread-1 Messages Count: {len(restored_messages_t1)}")
assert len(restored_messages_t1) == messages_count_t1_turn1, "Thread-1 messages count after restart does not match!"

# Sleep briefly to respect Gemini API rate limits
print("Sleeping 25s to avoid rate limit between workflow calls...")
time.sleep(25)

# Step 2: Thread-1 Second Question (resuming context)
print("\n--- Running Thread-1 Second Turn (Contextual Follow-up) ---")
res2 = invoke_with_retry(
    graph_restarted.workflow,
    {
        "question": "Which product is the most expensive?",
        "sql": "",
        "retries": 0,
        "is_valid": False,
        "result": [],
        "analysis": {},
        "chart": {},
        "insights": "",
        "answer": ""
    },
    config=config_t1
)
print(f"Thread-1 Second Answer: {res2['answer']}")
updated_t1_state = graph_restarted.workflow.get_state(config_t1)
print(f"Thread-1 Message Count after 2 turns: {len(updated_t1_state.values.get('messages', []))}")
assert len(updated_t1_state.values.get("messages", [])) >= 4, "Expected at least 4 messages in thread-1 after 2 turns"

# Sleep briefly to respect Gemini API rate limits
print("Sleeping 25s to avoid rate limit before Thread-2...")
time.sleep(25)

# Step 3: Thread-2 First Question (Thread Isolation Test)
print("\n--- Running Thread-2 Turn (Testing Thread Isolation) ---")
config_t2 = {"configurable": {"thread_id": "thread-2"}}
res_t2 = invoke_with_retry(
    graph_restarted.workflow,
    {
        "messages": [],
        "question": "List all products",
        "sql": "",
        "retries": 0,
        "is_valid": False,
        "result": [],
        "analysis": {},
        "chart": {},
        "insights": "",
        "answer": ""
    },
    config=config_t2
)
state_t2 = graph_restarted.workflow.get_state(config_t2)
state_t1_final = graph_restarted.workflow.get_state(config_t1)

print(f"Thread-2 Message Count: {len(state_t2.values.get('messages', []))}")
print(f"Thread-1 Message Count: {len(state_t1_final.values.get('messages', []))}")

assert len(state_t2.values.get("messages", [])) == 2, "Thread-2 should only have 2 messages (1 turn)"
assert len(state_t1_final.values.get("messages", [])) >= 4, "Thread-1 should retain its 4+ messages"

print("\n✅ PERSISTENCE & THREAD ISOLATION TEST PASSED SUCCESSFULLY!")
