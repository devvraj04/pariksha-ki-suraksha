import os
import re
import sys
import psycopg2

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
    migrations_dir = os.path.join(base_dir, "infra", "supabase", "migrations")
    
    print(f"Loading environment from: {env_path}")
    env = load_env(env_path)
    
    db_url = env.get("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in .env file.")
        sys.exit(1)
        
    print(f"Migrations directory: {migrations_dir}")
    if not os.path.exists(migrations_dir):
        print(f"Error: Migrations directory not found at {migrations_dir}")
        sys.exit(1)
        
    sql_files = [f for f in os.listdir(migrations_dir) if f.endswith(".sql")]
    sql_files.sort()
    
    if not sql_files:
        print("No migration files found.")
        sys.exit(0)
        
    print(f"Found {len(sql_files)} migrations to apply.")
    
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cursor = conn.cursor()
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)
        
    print("Connected to database successfully. Applying migrations...")
    
    for sql_file in sql_files:
        file_path = os.path.join(migrations_dir, sql_file)
        print(f"Applying {sql_file}...", end="", flush=True)
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                sql_content = f.read()
                
            if not sql_content.strip():
                print(" Skipped (Empty)")
                continue
                
            cursor.execute(sql_content)
            print(" SUCCESS")
        except Exception as e:
            print(" FAILED")
            print(f"Error executing migration {sql_file}: {e}")
            conn.close()
            sys.exit(1)
            
    cursor.close()
    conn.close()
    print("All migrations applied successfully!")

if __name__ == "__main__":
    main()
