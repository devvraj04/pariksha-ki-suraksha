import os
import json
import urllib.request
import urllib.parse
from apps.api.core.config import settings

def query_groq(prompt: str, system_message: str = None) -> str:
    """
    Queries the Groq API (llama-3.1-8b-instant) using urllib.
    Falls back to None if key is missing or query fails.
    """
    groq_api_key = os.getenv("GROQ_API_KEY") or settings.GROQ_API_KEY
    if not groq_api_key:
        print("[Groq Client] Warning: GROQ_API_KEY not found in environment or settings.")
        return None

    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {groq_api_key}"
        }
        
        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

        data = {
            "model": "llama-3.1-8b-instant",
            "messages": messages,
            "temperature": 0.5,
            "max_tokens": 512
        }
        
        req_data = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=req_data, headers=headers, method="POST")
        
        with urllib.request.urlopen(req, timeout=12) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            return res_body["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[Groq Client Error] Query failed: {e}")
        return None
