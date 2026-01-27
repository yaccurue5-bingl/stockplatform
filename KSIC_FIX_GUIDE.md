# KSIC Database Fix Guide

## Problem Description

**Error**: `ERROR: 42703: column "major_code" does not exist`

This error occurs when trying to create an index on the `major_code` column in the `ksic_codes` table, but the column doesn't exist in the database schema.

### Root Cause

The `ksic_codes` table was supposed to have hierarchical classification columns (division, major, minor, sub, detail) as defined in migration `003_add_ksic_support.sql`. However, these columns may not have been created if:

1. Migration 003 was not applied properly
2. The table was created manually without these columns
3. Migration 004 was applied to a database that didn't have migration 003 applied

## Solution

We've created a comprehensive fix that:

1. **Checks and adds all missing hierarchical columns** if they don't exist
2. **Populates the `major_code` column** from existing `ksic_code` data
3. **Creates required indexes** on the columns
4. **Verifies the fix** was successful

## How to Apply the Fix

### Option 1: Direct SQL Execution (Recommended)

If you have direct access to your Supabase database:

1. Open the Supabase SQL Editor:
   - Go to your Supabase Dashboard
   - Navigate to SQL Editor

2. Copy and paste the contents of either:
   - `supabase/migrations/005_fix_missing_hierarchical_columns.sql` (comprehensive fix with verification)
   - OR the updated `supabase/migrations/004_rename_ksic_columns_to_english.sql` (if you're rerunning migrations)

3. Execute the SQL script

4. Check the output messages for:
   - ✓ symbols indicating successful operations
   - ℹ symbols indicating items already existed (safe)
   - ⚠ or ✗ symbols indicating issues (need investigation)

### Option 2: Using Migration Script

If the Supabase connection is working from your environment:

```bash
# Apply the fix migration
python scripts/apply_migrations.py
```

Or specifically apply the KSIC migration:

```bash
python scripts/apply_ksic_migration.py
```

### Option 3: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Apply the new migration
supabase db push

# Or apply specific migration file
supabase db push --include-all
```

## What Gets Fixed

The fix ensures these columns exist in the `ksic_codes` table:

| Column | Type | Description |
|--------|------|-------------|
| `ksic_code` | TEXT | KSIC 코드 (Primary Key) |
| `ksic_name` | TEXT | KSIC 산업명 |
| `division_code` | TEXT | 대분류 코드 (1자리) |
| `division_name` | TEXT | 대분류명 |
| **`major_code`** | TEXT | **중분류 코드 (2자리)** ← The critical one |
| `major_name` | TEXT | 중분류명 |
| `minor_code` | TEXT | 소분류 코드 (3자리) |
| `minor_name` | TEXT | 소분류명 |
| `sub_code` | TEXT | 세분류 코드 (4자리) |
| `sub_name` | TEXT | 세분류명 |
| `detail_code` | TEXT | 세세분류 코드 (5자리) |
| `detail_name` | TEXT | 세세분류명 |
| `description` | TEXT | 설명 |
| `top_industry` | TEXT | 상위 업종 분류 |
| `created_at` | TIMESTAMP | 생성일시 |
| `updated_at` | TIMESTAMP | 수정일시 |

## Indexes Created

After the fix, these indexes will exist:

- `idx_ksic_codes_major` on `major_code` - For fast major category lookups
- `idx_ksic_codes_top_industry` on `top_industry` - For industry filtering
- `idx_ksic_codes_name` on `ksic_name` - For name searches

## Verification

After applying the fix, you can verify it worked by running these queries:

### 1. Check Column Exists

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ksic_codes'
AND column_name = 'major_code';
```

Expected result: One row showing `major_code | text`

### 2. Check Index Exists

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'ksic_codes'
AND indexname = 'idx_ksic_codes_major';
```

Expected result: One row showing the index definition

### 3. Check Data Population

```sql
SELECT
  COUNT(*) as total_records,
  COUNT(major_code) as records_with_major_code,
  COUNT(DISTINCT major_code) as unique_major_codes
FROM ksic_codes;
```

Expected result: All or most records should have major_code populated

### 4. Test Query That Failed Before

```sql
-- This should now work without error
SELECT * FROM ksic_codes WHERE major_code = '26';
```

## Migration Files Updated

1. **`004_rename_ksic_columns_to_english.sql`** - Updated to ensure all hierarchical columns exist before creating indexes
2. **`005_fix_missing_hierarchical_columns.sql`** (NEW) - Standalone fix script with verification

## Related Files

- `supabase/migrations/003_add_ksic_support.sql` - Original schema definition
- `supabase/migrations/004_rename_ksic_columns_to_english.sql` - Column rename migration (updated)
- `supabase/migrations/005_fix_missing_hierarchical_columns.sql` - Standalone fix (new)
- `scripts/apply_ksic_migration.py` - Python script to apply migrations
- `scripts/diagnose_ksic_issue.py` - Diagnostic tool for KSIC issues

## Troubleshooting

### Issue: "Index already exists" error

This is safe to ignore. The migration uses `CREATE INDEX IF NOT EXISTS` or drops before recreating.

### Issue: "Column already exists" error

This is safe and expected if some columns already exist. The migration checks before adding.

### Issue: Still getting "column does not exist" after applying fix

1. Verify you're connected to the correct database
2. Check if you have multiple database instances
3. Verify the transaction committed successfully (check for ROLLBACK messages)
4. Try the verification queries above

### Issue: Migration script can't connect to database

If you see `Temporary failure in name resolution` or similar network errors:

1. Check your `.env.local` file has correct Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. Verify network connectivity to Supabase

3. Use Option 1 (Direct SQL Execution) via Supabase Dashboard instead

## Prevention

To prevent this issue in the future:

1. Always run migrations in order (003 → 004 → 005)
2. Verify each migration succeeds before running the next
3. Keep migration files idempotent (safe to run multiple times)
4. Use the diagnostic script to check schema before running migrations:
   ```bash
   python scripts/diagnose_ksic_issue.py
   ```

## Questions?

If you encounter issues not covered here:

1. Run the diagnostic script: `python scripts/diagnose_ksic_issue.py`
2. Check Supabase logs in your dashboard
3. Verify your database schema matches the expected structure
4. Check if other migrations need to be applied first
