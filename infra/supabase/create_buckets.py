import os
import sys
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions

def load_env(env_path):
    env_vars = {}
    if not os.path.exists(env_path):
        print(f"Error: .env file not found at {env_path}")
        sys.exit(1)
        
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip("'").strip('"')
                env_vars[key] = value
    return env_vars

def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    env_path = os.path.join(base_dir, ".env")
    
    env = load_env(env_path)
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not service_role_key:
        print("Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env")
        sys.exit(1)
        
    print(f"Connecting to Supabase at {supabase_url}...")
    options = ClientOptions(persist_session=False)
    supabase: Client = create_client(supabase_url, service_role_key, options=options)
    
    # Bucket definitions: (name, is_public)
    buckets = [
        ("syllabus-pdfs", False),
        ("brochures", True),
        ("admit-cards", False),
        ("question-papers-vault", False),
        ("answer-sheet-uploads", False),
        ("cctv-clips", False),
        ("evidence-uploads", True), # Allow public write
        ("result-pdfs", False),
        ("session-recordings", False),
        ("webcam-snapshots", False)
    ]
    
    print("Creating storage buckets...")
    
    # Retrieve existing buckets to avoid duplicate creation errors
    try:
        existing_buckets = [b.name for b in supabase.storage.list_buckets()]
    except Exception as e:
        print(f"Error listing buckets: {e}")
        sys.exit(1)
        
    for name, is_public in buckets:
        if name in existing_buckets:
            print(f"Bucket '{name}' already exists. Skipping.")
            continue
            
        print(f"Creating bucket '{name}' (public={is_public})...", end="", flush=True)
        try:
            supabase.storage.create_bucket(name, options={"public": is_public})
            print(" SUCCESS")
        except Exception as e:
            print(" FAILED")
            print(f"Error creating bucket '{name}': {e}")
            
    print("All storage buckets verified and created!")

if __name__ == "__main__":
    main()
