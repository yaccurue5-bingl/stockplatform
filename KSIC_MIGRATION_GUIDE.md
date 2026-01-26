# KSIC Database Migration Guide

## Problem
The `ksic_codes` table doesn't exist or has an incorrect schema, causing the import script to fail with errors like:
- "Could not find the 'description' column of 'ksic_codes' in the schema cache"
- "column ksic_codes.ksic_code does not exist"

## Solution
You need to apply the migration file `supabase/migrations/003_add_ksic_support.sql` to your Supabase database.

---

## Method 1: Using Supabase Dashboard (Recommended - Easiest)

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** (in the left sidebar)
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/003_add_ksic_support.sql`
6. Paste it into the SQL Editor
7. Click **Run** (or press Ctrl+Enter / Cmd+Enter)
8. Wait for the query to complete
9. You should see: "✓ KSIC 지원 마이그레이션 완료" in the results

---

## Method 2: Using Supabase CLI (Requires CLI Installation)

### Install Supabase CLI
```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or via npm
npm install -g supabase
```

### Link and Apply Migration
```bash
# Link to your project
supabase link --project-ref your-project-id

# Apply all migrations
supabase db push

# Or apply specific migration
supabase db push --include-all --include 003_add_ksic_support.sql
```

---

## Method 3: Using Python Script with Direct Database Connection

### Prerequisites
1. Install psycopg2:
   ```bash
   pip install psycopg2-binary
   ```

2. Get your database password:
   - Go to Supabase Dashboard
   - Navigate to Settings > Database
   - Find the "Database Password" section
   - Copy your database password

3. Add to your `.env.local` file:
   ```env
   SUPABASE_DB_PASSWORD=your_database_password_here
   ```

### Run Migration Script
```bash
# Apply all migrations
python scripts/apply_migrations.py

# Apply specific migration
python scripts/apply_migrations.py 003_add_ksic_support
```

---

## Method 4: Using PostgreSQL Client (Advanced)

If you have `psql` installed:

```bash
# Get connection string from Supabase Dashboard
# Settings > Database > Connection String (URI)

psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres" \
  -f supabase/migrations/003_add_ksic_support.sql
```

---

## Verification

After applying the migration, verify it worked:

```bash
# Check database schema
python scripts/check_db_schema.py
```

Expected output should show the `ksic_codes` table with these columns:
- ksic_code (PRIMARY KEY)
- ksic_name
- division_code, division_name
- major_code, major_name
- minor_code, minor_name
- sub_code, sub_name
- detail_code, detail_name
- top_industry
- description
- created_at, updated_at

---

## After Migration

Once the migration is applied, you can run the import script:

```bash
# Import KSIC data
python scripts/import_ksic_data.py

# Or use the API
curl -X POST http://localhost:8000/api/ksic/setup-all
```

---

## Troubleshooting

### Error: "relation 'ksic_codes' already exists"
This means the table exists but might have wrong columns. Options:
1. Drop and recreate (⚠️ WARNING: This deletes all data):
   ```sql
   DROP TABLE IF EXISTS public.ksic_codes CASCADE;
   -- Then run the migration again
   ```

2. Or add missing columns manually:
   ```sql
   ALTER TABLE public.ksic_codes
     ADD COLUMN IF NOT EXISTS description TEXT,
     ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
   ```

### Error: "function update_updated_at_column() does not exist"
You need to apply the earlier migrations first (001, 002):
```bash
python scripts/apply_migrations.py 001_initial_schema
python scripts/apply_migrations.py 002_disclosure_insights_rcept_dt_nullable
python scripts/apply_migrations.py 003_add_ksic_support
```

### Error: "Could not find the 'description' column"
The migration hasn't been applied yet. Follow Method 1 above (easiest).

### Error: "column ksic_codes.ksic_code does not exist"
The table doesn't exist at all. Apply the migration using Method 1.

---

## Quick Fix (If Migration Doesn't Work)

If you're unable to apply the full migration, here's a minimal schema to get started:

```sql
-- Minimal ksic_codes table
CREATE TABLE IF NOT EXISTS public.ksic_codes (
  ksic_code TEXT PRIMARY KEY,
  ksic_name TEXT NOT NULL,
  division_code TEXT,
  division_name TEXT,
  major_code TEXT,
  major_name TEXT,
  minor_code TEXT,
  minor_name TEXT,
  sub_code TEXT,
  sub_name TEXT,
  detail_code TEXT,
  detail_name TEXT,
  top_industry TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ksic_codes_major ON public.ksic_codes(major_code);
CREATE INDEX IF NOT EXISTS idx_ksic_codes_top_industry ON public.ksic_codes(top_industry);
CREATE INDEX IF NOT EXISTS idx_ksic_codes_name ON public.ksic_codes(ksic_name);

-- Enable RLS
ALTER TABLE public.ksic_codes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can view ksic codes"
  ON public.ksic_codes
  FOR SELECT
  USING (auth.role() = 'authenticated');
```

Run this in the Supabase SQL Editor, then try the import script again.

---

## Need Help?

If you encounter issues:
1. Check the Supabase logs in your dashboard
2. Verify your environment variables are set correctly
3. Ensure you have the necessary permissions (service role key)
4. Check that the previous migrations (001, 002) have been applied
5. Try the "Quick Fix" SQL above if nothing else works
