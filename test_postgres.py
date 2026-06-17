import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# String 1: standard env string
db_url_env = os.getenv("DATABASE_URL")
print("Trying env DATABASE_URL...")
try:
    conn = psycopg2.connect(db_url_env, connect_timeout=5)
    print("SUCCESS on env DATABASE_URL!")
    conn.close()
except Exception as e:
    print("FAILED on env DATABASE_URL:", e)

# String 2: direct host, port 5432
db_url_direct = "postgresql://postgres:ParikshaSetu@db.nimrtgutmnopbyypvfjf.supabase.co:5432/postgres"
print("\nTrying direct connection on port 5432...")
try:
    conn = psycopg2.connect(db_url_direct, connect_timeout=5)
    print("SUCCESS on direct port 5432!")
    conn.close()
except Exception as e:
    print("FAILED on direct port 5432:", e)

# String 3: pooler, port 5432
db_url_pooler_5432 = "postgresql://postgres.nimrtgutmnopbyypvfjf:ParikshaSetu@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
print("\nTrying pooler connection on port 5432...")
try:
    conn = psycopg2.connect(db_url_pooler_5432, connect_timeout=5)
    print("SUCCESS on pooler port 5432!")
    conn.close()
except Exception as e:
    print("FAILED on pooler port 5432:", e)
