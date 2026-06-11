# Supabase Database Setup & Migrations Guide

This directory contains the database design for **LeakGuard AI** specified in `02_DATABASE_DESIGN.md`.

## 📦 Prerequisites (Storage Buckets)
The system requires the following Supabase Storage buckets:
- `encrypted-papers` (private)
- `omr-scans` (private)
- `vision-alerts` (private)
- `forensic-uploads` (private)

*Note: These buckets will be automatically pre-created when you run the SQL migrations, provided the `storage` schema exists.*

---

## 🚀 How to Apply Migrations to Your Online Supabase Project

You can apply the migrations in two ways:

### Option A: Via the Supabase CLI (Recommended)
1. **Install Supabase CLI**: Make sure you have the Supabase CLI installed on your machine.
2. **Login & Link Project**:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
   *You can find your Project Reference in your Supabase dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`*
3. **Push Migrations**:
   ```bash
   supabase db push
   ```
   This will execute the migrations under `supabase/migrations/` sequentially (from `001` to `010`).

### Option B: Copy-Paste via Supabase Dashboard SQL Editor
If you prefer not to use the CLI, you can copy the contents of the SQL migration files and run them in the **SQL Editor** of your Supabase Dashboard in sequential order:
1. `001_enums.sql`
2. `002_core_tables.sql`
3. `003_module1_tables.sql`
4. `004_module2_tables.sql`
5. `005_module3_tables.sql`
6. `006_module4_tables.sql`
7. `007_module5_tables.sql`
8. `008_audit_tables.sql`
9. `009_indexes.sql`
10. `010_rls_policies.sql`

---

## 🔑 Where to Put Your Database Keys

1. **Root Configuration**:
   - Copy `.env.example` to `.env` at the root of the project.
   - Enter your `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` here.

2. **Next.js Frontend Configuration (`apps/frontend/`)**:
   - Create `.env.local` under `apps/frontend/`.
   - Add:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     NEXT_PUBLIC_API_URL=http://localhost:8000
     ```

3. **FastAPI Backend Configuration (`apps/backend/`)**:
   - Create `.env` under `apps/backend/`.
   - Add:
     ```env
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     VAULT_MASTER_SALT=your-vault-master-salt
     JWT_RS256_PRIVATE_KEY="your-private-key-pem"
     JWT_RS256_PUBLIC_KEY="your-public-key-pem"
     ```
