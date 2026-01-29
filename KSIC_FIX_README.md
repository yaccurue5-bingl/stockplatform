# KSIC Import Error Fix

## Problem

The KSIC import script fails with the following error:

```
'there is no unique or exclusion constraint matching the ON CONFLICT specification'
Error code: 42P10
```

This error occurs because the `ksic_codes` table is missing a primary key constraint on the `ksic_code` column, which is required for the `upsert()` operation used in the import script.

## Root Cause

The import script at `scripts/import_ksic_data.py:223-226` uses:

```python
response = self.supabase.table('ksic_codes').upsert(
    batch_records,
    on_conflict='ksic_code'
).execute()
```

The `ON CONFLICT` clause requires a unique constraint or primary key on `ksic_code`, but this constraint was not successfully created in the database.

## Solution

You have **3 options** to fix this issue:

### Option 1: Quick Fix (Recommended) ⚡

Run the quick fix SQL script directly in your Supabase SQL Editor:

1. Open your Supabase dashboard
2. Navigate to **SQL Editor**
3. Open the file `quick_fix_ksic_constraint.sql` in your project root
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **"Run"**

This will:
- Remove any duplicate `ksic_code` values
- Remove any NULL `ksic_code` values
- Drop and recreate the primary key constraint properly
- Verify the fix was successful

### Option 2: Apply Migration via Script

If you have direct database access configured:

1. Get your database password from Supabase dashboard > Settings > Database
2. Add it to your `.env.local` file:
   ```bash
   SUPABASE_DB_PASSWORD=your_password_here
   ```
3. Run the migration:
   ```bash
   python scripts/apply_migrations.py 006_ensure_ksic_primary_key.sql
   ```

### Option 3: Manual SQL Execution

If you prefer to run the SQL commands manually, execute these in order:

```sql
-- 1. Remove duplicates
DELETE FROM ksic_codes WHERE ctid NOT IN (
    SELECT MAX(ctid) FROM ksic_codes GROUP BY ksic_code
);

-- 2. Remove NULLs
DELETE FROM ksic_codes WHERE ksic_code IS NULL;

-- 3. Drop old constraint
ALTER TABLE ksic_codes DROP CONSTRAINT IF EXISTS ksic_codes_pkey CASCADE;

-- 4. Make column NOT NULL
ALTER TABLE ksic_codes ALTER COLUMN ksic_code SET NOT NULL;

-- 5. Add primary key
ALTER TABLE ksic_codes ADD CONSTRAINT ksic_codes_pkey PRIMARY KEY (ksic_code);
```

## Verification

After applying the fix, verify it worked by running:

```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'ksic_codes' AND constraint_type = 'PRIMARY KEY';
```

You should see:
```
constraint_name    | constraint_type
-------------------|----------------
ksic_codes_pkey   | PRIMARY KEY
```

## Testing the Import

Once the constraint is in place, test the import script:

```bash
python scripts/import_ksic_data.py
```

The script should now complete successfully without the constraint error.

## Files Created

This fix includes:

1. `supabase/migrations/006_ensure_ksic_primary_key.sql` - Full migration file
2. `quick_fix_ksic_constraint.sql` - Quick fix script (recommended)
3. `scripts/apply_ksic_primary_key_fix.py` - Helper script with instructions
4. `KSIC_FIX_README.md` - This documentation

## Technical Details

### Why This Happened

The migrations in `003_add_ksic_support.sql` and `004_rename_ksic_columns_to_english.sql` attempted to create a primary key, but it may have failed silently due to:

- Duplicate `ksic_code` values in the table
- NULL `ksic_code` values
- The constraint being dropped but not properly recreated

### The Fix

Migration `006_ensure_ksic_primary_key.sql` ensures:

1. **Data cleaning**: Removes duplicates and NULLs that prevent constraint creation
2. **Constraint removal**: Drops any partial or broken constraints
3. **Constraint creation**: Creates a proper PRIMARY KEY constraint
4. **Foreign key recreation**: Restores the foreign key from `companies` table
5. **Verification**: Confirms the constraint exists and is working

## Need Help?

If you encounter any issues:

1. Check the Supabase SQL Editor for detailed error messages
2. Verify you're using a service role key with sufficient permissions
3. Check if there are any data issues preventing constraint creation
4. Review the full migration file for additional context

---

**Created**: 2026-01-27
**Issue**: PostgreSQL error 42P10 - Missing unique constraint for ON CONFLICT
**Status**: Fix ready for deployment
