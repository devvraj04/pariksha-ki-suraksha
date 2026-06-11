import os
import logging
import httpx

logger = logging.getLogger(__name__)

def broadcast_realtime_event(topic: str, event: str, payload: dict):
    """
    Fire-and-forget helper to broadcast an ephemeral event via Supabase Realtime HTTP REST API.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        logger.warning("Supabase credentials not found. Skipping realtime broadcast.")
        return
        
    url = f"{supabase_url.rstrip('/')}/realtime/v1/api/broadcast"
    
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    body = {
        "messages": [
            {
                "topic": topic,
                "event": event,
                "payload": payload
            }
        ]
    }
    
    try:
        # Use sync httpx client for fire-and-forget backend requests
        with httpx.Client() as client:
            resp = client.post(url, headers=headers, json=body, timeout=5.0)
            if resp.status_code != 200:
                logger.error(f"Realtime broadcast failed: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"Error broadcasting realtime event to {topic}: {str(e)}")
