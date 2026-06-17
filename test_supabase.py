from apps.api.core.supabase_client import get_supabase_client

try:
    db = get_supabase_client()
    res = db.table("agencies").select("count").execute()
    print("Supabase connection successful! Agencies count:", res.data)
except Exception as e:
    print("Supabase connection failed:", e)
