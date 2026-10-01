import urllib.request
import json

base_url = "http://127.0.0.1:8000"

# 1. Upload sample SQLite DB (Chinook)
import requests
with open("../database/Chinook.sqlite", "rb") as f:
    resp = requests.post(f"{base_url}/upload-sqlite", files={"file": f})
print("Upload response:", resp.json())

# 2. Get tables
resp = requests.get(f"{base_url}/tables")
print("Tables:", resp.json().get("tables")[:5])

# 3. Test chat endpoint
chat_payload = {
    "question": "How many tracks are there in the database?",
    "thread_id": "test-live-thread"
}
resp = requests.post(f"{base_url}/chat", json=chat_payload)
print("\nChat response:")
print(json.dumps(resp.json(), indent=2))
