from apps.api.core.supabase_client import get_supabase_client

try:
    db = get_supabase_client()
    agencies = db.table("agencies").select("name, slug, status").execute()
    print("Agencies in DB:", agencies.data)
    
    admins = db.table("platform_admins").select("email").execute()
    print("Admins in DB:", admins.data)
    
    staff_count = db.table("agency_staff").select("count", count="exact").execute()
    print("Agency Staff Count:", staff_count.count)
    
    students_count = db.table("students").select("count", count="exact").execute()
    print("Students Count:", students_count.count)
except Exception as e:
    print("Error checking DB:", e)
