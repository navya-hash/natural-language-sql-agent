from llm import llm
from database import db


def retry_sql(question, invalid_sql):

    schema = db.get_schema()

    prompt = f"""
You generated an invalid SQLite query.

Database Schema:

{schema}

Previous Invalid SQL:

{invalid_sql}

User Question:

{question}

Generate a corrected SQLite query.

Rules:
1. Only SELECT queries.
2. No markdown.
3. Return ONLY SQL.
"""

    response = llm.invoke(prompt)

    if isinstance(response.content, list):
            return response.content[0]["text"].strip()
    
    return response.content.strip()