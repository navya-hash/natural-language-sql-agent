
from graph import workflow

config = {
    "configurable": {
        "thread_id": "user_1"
    }
}

question = input("Ask: ")

state = {

    "messages": [],

    "question": question,

    "sql": "",

    "retries": 0,

    "is_valid": False,

    "result": [],

    "analysis": {},

    "chart": {},

    "insights": "",

    "answer": ""
}

result = workflow.invoke(state,config=config)

# print("\nGenerated SQL:")
# print(result["sql"])

# print("\nAnswer:")
# print(result["answer"])
# print(result)

# print(result["analysis"])
# print(result["messages"])

# print(result["chart"])
print(result["insights"])



 