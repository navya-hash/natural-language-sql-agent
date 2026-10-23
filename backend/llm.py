# import os

# from dotenv import load_dotenv
# from langchain_google_genai import ChatGoogleGenerativeAI

# load_dotenv()

# llm = ChatGoogleGenerativeAI(
#     model="gemini-3.6-flash",
#     temperature=0
# )


# import os

# from dotenv import load_dotenv
# from langchain_groq import ChatGroq

# load_dotenv()

# llm = ChatGroq(
#     model="meta-llama/llama-prompt-guard-2-22m",
#     temperature=0
# )

import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0,
)


