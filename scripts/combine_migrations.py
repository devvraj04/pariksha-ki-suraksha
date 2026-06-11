import os

def main():
    migrations_dir = 'supabase/migrations'
    output_file = 'supabase/combined_migrations.sql'
    
    if not os.path.exists(migrations_dir):
        print(f"Error: {migrations_dir} directory not found.")
        return
        
    sql_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith('.sql')])
    
    print(f"Found {len(sql_files)} migration files.")
    
    combined_sql = []
    for filename in sql_files:
        filepath = os.path.join(migrations_dir, filename)
        print(f"Reading: {filename}")
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            combined_sql.append(f"-- ==========================================\n-- MIGRATION: {filename}\n-- ==========================================\n")
            combined_sql.append(content)
            combined_sql.append("\n\n")
            
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("".join(combined_sql))
        
    print(f"Successfully generated combined migration SQL at: {output_file}")

if __name__ == "__main__":
    main()
