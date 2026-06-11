import os
from supabase import create_client, Client

# Load environment variables from .env file manually to support local development
def _load_env():
    # Scan standard relative paths for the root .env file
    for path in ['.env', '../../.env', '../.env', 'apps/backend/.env']:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        # Set variable if not already set by shell
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            break

_load_env()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Create a single global Supabase client instance using the service role key to bypass RLS for backend writes
supabase: Client = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None

def get_db() -> Client:
    """FastAPI dependency to retrieve the configured Supabase client."""
    if not supabase:
        raise RuntimeError("Supabase client is not initialized. Please verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    return supabase
