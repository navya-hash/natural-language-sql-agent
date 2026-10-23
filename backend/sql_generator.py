
from llm import llm
from database import db
import re


def generate_sql(question, messages, connection_id):
    schema = db.get_schema(connection_id)
    dialect = db.get_dialect(connection_id)

    conversation = ""

    for msg in messages:
        if msg.type == "human":
            conversation += f"User: {msg.content}\n"
        elif msg.type == "ai":
            conversation += f"Assistant: {msg.content}\n"

    prompt = f"""
You are an expert SQL developer.

Target Database Dialect: {dialect.upper()}

Database Schema:

{schema}

Conversation History:

{conversation}

Current User Question:

{question}

Generate ONLY valid {dialect.upper()} SQL.

Rules:
1. Return ONLY pure SQL.
2. No markdown code fences, no explanations, no comments.
3. Must use {dialect.upper()} syntax exclusively.
4. For row limits in {dialect.upper()}, use 'LIMIT <n>' at the end of the query. NEVER use 'TOP <n>'.
5. Only generate read-only SELECT queries.
6. Use only tables and columns present in the schema.
"""

    response = llm.invoke(prompt)

    if isinstance(response.content, list):
        return "".join(
            item["text"]
            for item in response.content
            if isinstance(item, dict) and item.get("type") == "text"
        ).strip()

    return response.content.strip()


# from llm import llm

# from database import db
# import re


# def generate_sql(question, messages):


#     schema = db.get_schema()

#     conversation = ""

#     for msg in messages:

#         if msg.type == "human":
#             conversation += f"User: {msg.content}\n"

#         else:
#             conversation += f"Assistant: {msg.content}\n"

#     prompt = f"""
# You are an expert SQLite developer.

# Database Schema:

# {schema}

# Conversation History:

# {conversation}

# Current User Question:

# {question}

# Generate ONLY SQL.

# Rules:

# 1. Return ONLY SQL.
# 2. No markdown.
# 3. SQLite syntax only.
# """

#     response = llm.invoke(prompt)
#     if isinstance(response.content, list):
#         return response.content[0]["text"].strip()

#     return response.content.strip()
   



