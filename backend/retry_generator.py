
from llm import llm
from database import db


def retry_sql(question, invalid_sql, connection_id, error_message=None):
    schema = db.get_schema(connection_id)
    dialect = db.get_dialect(connection_id)

    error_context = ""
    if error_message:
        error_context = f"\nDatabase Error Encountered:\n{error_message}\n"

    prompt = f"""
You are an expert SQL developer correcting an invalid SQL query.

Target Database Dialect: {dialect.upper()}

Database Schema:

{schema}

Previous Invalid SQL:

{invalid_sql}
{error_context}
User Question:

{question}

Generate a corrected SQL query compatible with {dialect.upper()}.

Rules:
1. Return ONLY pure SQL.
2. No markdown code fences, no explanations, no comments.
3. Must use {dialect.upper()} syntax exclusively.
4. For row limits in {dialect.upper()}, use 'LIMIT <n>' at the end of the query. NEVER use 'TOP <n>'.
5. Only generate read-only SELECT queries.
6. Use only tables and columns present in the schema.
7. Correct the syntax, dialect, or schema-related errors reported above.
"""

    response = llm.invoke(prompt)

    if isinstance(response.content, list):
        return "".join(
            item["text"]
            for item in response.content
            if isinstance(item, dict) and item.get("type") == "text"
        ).strip()

    return response.content.strip()


