import os
from supabase import create_client

def main():
    # Load environment variables manually
    for path in ['.env', '../.env', 'apps/backend/.env']:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            break

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    
    print(f"Connecting to: {url}")
    print(f"Using Key (truncated): {key[:15]}..." if key else "No key found")
    
    try:
        supabase = create_client(url, key)
        resp = supabase.table("user_profiles").select("id").limit(1).execute()
        print("Connection successful! Query response:")
        print(resp.data)
    except Exception as e:
        print(f"Connection failed: {str(e)}")

if __name__ == "__main__":
    main()
