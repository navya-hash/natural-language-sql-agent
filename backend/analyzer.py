import json

from llm import llm


def analyze(question, result):

    prompt = f"""
You are an AI data analyst.

User Question:
{question}

SQL Result:
{result}

Decide whether the result should be visualized.

Return ONLY valid JSON.

Example:
{{
    "generate_chart": true,
    "chart_type": "bar",
    "generate_insights": true
}}

Chart types allowed:
- bar
- line
- pie
- scatter
- none

Rules:
1. If only one numeric value exists, chart = false.
2. Time series -> line chart.
3. Categories with numbers -> bar chart.
4. Percentage distribution -> pie chart.
5. Numeric vs numeric -> scatter.
"""

    response = llm.invoke(prompt)

    if isinstance(response.content, list):
        text = response.content[0]["text"].strip()
    else:
        text = response.content.strip()

    # Remove markdown if Gemini returns it
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(text)

    except Exception:
        return {
            "generate_chart": False,
            "chart_type": "none",
            "generate_insights": True
        }