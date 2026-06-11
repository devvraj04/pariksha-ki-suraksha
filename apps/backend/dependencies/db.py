import os
from supabase import create_client, Client

# Load environment variables from .env file manually to support local development
def _load_env():
    for path in ['.env', '../../.env', '../.env', 'apps/backend/.env']:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            break

_load_env()

# Global client holder, initialized lazily on first access
_supabase_client: Client = None

def get_db() -> Client:
    """
    FastAPI dependency to retrieve the configured Supabase client.
    Initializes lazily to prevent validation errors at import time.
    """
    global _supabase_client
    if _supabase_client is None:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key or supabase_key == "your-service-role-key":
            raise RuntimeError(
                "Supabase client is not initialized. Please configure valid SUPABASE_URL "
                "and SUPABASE_SERVICE_ROLE_KEY environment variables."
            )
        
        _supabase_client = create_client(supabase_url, supabase_key)
        
    return _supabase_client
