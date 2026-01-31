# Fix KSIC Import Error - Quick Guide

## The Problem

You encountered these errors when running the KSIC import script:

```
ERROR - Could not find the 'description' column of 'ksic_codes' in the schema cache
ERROR - column ksic_codes.ksic_code does not exist
```

**Root Cause:** The `ksic_codes` table either doesn't exist or has an incorrect schema in your Supabase database.

---

## Quick Fix (3 Steps)

### Step 1: Diagnose the Issue

Run the diagnostic script to identify the exact problem:

```bash
python scripts/diagnose_ksic_issue.py
```

This will tell you:
- ✓ Does the table exist?
- ✓ Does it have all required columns?
- ✓ Does it have data?
- ✓ Are permissions configured correctly?

### Step 2: Apply the Migration

**Option A: Supabase Dashboard (Easiest - 2 minutes)**

1. Open https://app.supabase.com
2. Select your project
3. Click **SQL Editor** in the sidebar
4. Click **New Query**
5. Open the file: `supabase/migrations/003_add_ksic_support.sql`
6. Copy ALL the contents
7. Paste into SQL Editor
8. Click **Run** (or press Ctrl+Enter)
9. Wait for "Success" message

**Option B: Command Line (Requires Database Password)**

If you have your database password:

```bash
# 1. Install psycopg2
pip install psycopg2-binary

# 2. Add DB password to .env.local
echo "SUPABASE_DB_PASSWORD=your_password_here" >> .env.local

# 3. Run migration script
python scripts/apply_migrations.py 003_add_ksic_support
```

### Step 3: Verify and Import

```bash
# Verify the migration worked
python scripts/diagnose_ksic_issue.py

# Import KSIC data
python scripts/import_ksic_data.py
```

---

## Expected Result

After applying the migration:

```bash
$ python scripts/diagnose_ksic_issue.py

======================================================================
KSIC Database Diagnostic
======================================================================

INFO - Checking if ksic_codes table exists...
INFO - ✓ ksic_codes table exists
INFO - Checking table schema...
INFO - ✓ All required columns exist
INFO - Checking if table has data...
INFO - ⚠ ksic_codes table is empty
INFO - Checking permissions...
INFO - ✓ Read and write permissions OK

======================================================================
Diagnostic Results
======================================================================

Found 1 issue(s):

1. ❌ ksic_codes table has no data

======================================================================
Recommended Solutions
======================================================================

SOLUTION 3: Import KSIC data:
  python scripts/import_ksic_data.py

Or use the API:
  curl -X POST http://localhost:8000/api/ksic/import
```

Then run the import:

```bash
$ python scripts/import_ksic_data.py

============================================================
KSIC 데이터 임포트 시작
============================================================
INFO - KSIC 데이터 임포터 초기화 완료
INFO - KSIC 엑셀 파일 로드 시도...
INFO - KSIC 레코드 준비 중...
INFO - 총 68개 레코드 준비 완료
INFO - 데이터베이스에 KSIC 데이터 임포트 시작...
INFO - 배치 1/1 처리 중... (1-68/68)
INFO - ✓ 68개 레코드 처리 완료
INFO - 임포트 완료: 삽입/업데이트 68개, 오류 0개
✓ KSIC 데이터 임포트 성공!
```

---

## Files Created

To help you fix this issue, I created:

1. **KSIC_MIGRATION_GUIDE.md**
   - Comprehensive guide with multiple migration methods
   - Troubleshooting section
   - Rollback instructions

2. **scripts/diagnose_ksic_issue.py**
   - Diagnostic tool to identify the exact problem
   - Provides actionable solutions

3. **scripts/apply_migrations.py**
   - Automated migration runner
   - Applies SQL migrations programmatically

4. **FIX_KSIC_IMPORT_ERROR.md** (this file)
   - Quick reference guide
   - 3-step fix process

---

## Still Having Issues?

### Issue 1: "Table already exists but wrong schema"

```sql
-- In Supabase SQL Editor, drop and recreate:
DROP TABLE IF EXISTS public.ksic_codes CASCADE;
-- Then run the full migration SQL
```

### Issue 2: "Can't access Supabase Dashboard"

Use the command-line method:
```bash
pip install psycopg2-binary
python scripts/apply_migrations.py
```

### Issue 3: "Don't have database password"

Get it from:
1. Supabase Dashboard → Settings → Database
2. Look for "Database Password" section
3. Reset if needed (⚠️ will require updating all connections)

---

## Next Steps

After fixing the database:

1. ✅ Apply migration (Step 2 above)
2. ✅ Run diagnostic to verify
3. ✅ Import KSIC data
4. ✅ Validate data: `python scripts/validate_ksic_data.py`
5. ✅ Map companies: `python scripts/map_companies_to_ksic.py`

Or use the all-in-one API:
```bash
python main.py  # Start the API server
curl -X POST http://localhost:8000/api/ksic/setup-all
```

---

## Summary

**Problem:** Database table missing or incorrect
**Solution:** Apply the migration SQL
**Time:** 2-5 minutes
**Difficulty:** Easy (copy & paste SQL)

See **KSIC_MIGRATION_GUIDE.md** for detailed information.
