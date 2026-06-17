import psycopg2
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()
db_url = os.getenv("DATABASE_URL")
print(f"Connecting to database...")

conn = psycopg2.connect(db_url)
cur = conn.cursor()

try:
    # Get current tables in public schema
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
    tables = [row[0] for row in cur.fetchall()]
    print("Tables in public schema:", tables)

    # Check agencies
    cur.execute("SELECT id, name, slug, status FROM agencies;")
    print("Agencies:", cur.fetchall())

    # Check platform admins
    cur.execute("SELECT id, email, user_id FROM platform_admins;")
    print("Platform Admins:", cur.fetchall())

    # Check auth.users count
    cur.execute("SELECT count(*) FROM auth.users;")
    print("Total Auth Users:", cur.fetchone()[0])
    
    cur.execute("SELECT id, email, raw_user_meta_data FROM auth.users;")
    print("Auth Users:")
    for row in cur.fetchall():
        print(row)
finally:
    cur.close()
    conn.close()
