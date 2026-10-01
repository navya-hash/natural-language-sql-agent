from llm import llm


def generate_insights(question, result):

    if len(result) == 0:
        return []

    prompt = f"""
You are an experienced Business Data Analyst.

User Question:
{question}

SQL Result:
{result}

Analyze the result and generate 3-5 concise business insights.

Rules:
1. Return ONLY bullet points.
2. Do not explain the SQL.
3. Mention trends, highest, lowest, comparisons whenever applicable.
4. If the result contains only one value, briefly explain what it means.
5. Keep each insight within one sentence.
"""

    response = llm.invoke(prompt)

    if isinstance(response.content, list):
        text = response.content[0]["text"].strip()
    else:
        text = response.content.strip()

    return text