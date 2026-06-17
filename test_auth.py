from apps.api.core.supabase_client import get_supabase_client

try:
    db = get_supabase_client()
    users_res = db.auth.admin.list_users()
    print("Total users in Supabase Auth:", len(users_res))
    for u in users_res:
        # User object properties
        print(f"User: {u.email} (ID: {u.id})")
except Exception as e:
    print("Failed to list users:", e)
