from llm import llm

from database import db
import re


def generate_sql(question, messages):


    schema = db.get_schema()

    conversation = ""

    for msg in messages:

        if msg.type == "human":
            conversation += f"User: {msg.content}\n"

        else:
            conversation += f"Assistant: {msg.content}\n"

    prompt = f"""
You are an expert SQLite developer.

Database Schema:

{schema}

Conversation History:

{conversation}

Current User Question:

{question}

Generate ONLY SQL.

Rules:

1. Return ONLY SQL.
2. No markdown.
3. SQLite syntax only.
"""

    response = llm.invoke(prompt)
    if isinstance(response.content, list):
        return response.content[0]["text"].strip()

    return response.content.strip()
   



