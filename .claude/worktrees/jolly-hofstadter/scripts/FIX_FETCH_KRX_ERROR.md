# Fix for "null value in column 'code' violates not-null constraint" Error

## Problem

You encountered this error when running `fetch_krx_from_datagokr.py`:

```
postgrest.exceptions.APIError: {'message': 'null value in column "code" of relation "companies" violates not-null constraint', 'code': '23502'...}
```

## Root Cause

**You are running an outdated version of the script** on your local Windows machine (`C:\stockplatform\scripts\fetch_krx_from_datagokr.py`).

### What's different in the old version:
- ❌ Has a `transform_and_save()` function (doesn't exist in current version)
- ❌ Uses `on_conflict="stock_code"` (wrong - should be `"code"`)
- ❌ May not properly set the `code` field

### What's correct in the updated version:
- ✅ Separate `transform_to_db_format()` and `save_to_supabase()` functions
- ✅ Uses `on_conflict="code"` (correct - matches PRIMARY KEY)
- ✅ Sets both `'code'` and `'stock_code'` fields explicitly
- ✅ Validates data before inserting
- ✅ Better error messages

## Solution

### Option 1: Pull the latest version from the repository (Recommended)

```bash
# On your Windows machine
cd C:\stockplatform
git fetch origin
git pull origin claude/setup-project-build-ICsxg

# Or if you have local changes, stash them first:
git stash
git pull origin claude/setup-project-build-ICsxg
git stash pop
```

### Option 2: Copy the updated script manually

1. Go to the repository on GitHub/your git hosting
2. Navigate to `scripts/fetch_krx_from_datagokr.py`
3. Copy the entire file contents
4. Replace your local `C:\stockplatform\scripts\fetch_krx_from_datagokr.py`

### Option 3: Verify and fix the database schema

If the script is up-to-date but still failing, your database schema might be missing the `code` column:

1. Go to your Supabase SQL Editor
2. Run this diagnostic script: `my-research-platform/supabase/diagnose_companies_table.sql`
3. If it shows missing columns, run: `my-research-platform/supabase/fix_companies_table_v2.sql`

## How to Verify the Fix

After updating, check that your local script has these key lines:

```python
# Around line 178-179 in transform_to_db_format():
company = {
    'code': stock_code,              # PRIMARY KEY (required)
    'stock_code': stock_code,        # 종목 코드
    'corp_name': stock_name,
    # ...
}

# Around line 234 in save_to_supabase():
supabase.table("companies").upsert(batch, on_conflict="code").execute()
```

## Run the Updated Script

```bash
# On Windows
cd C:\stockplatform
python scripts\fetch_krx_from_datagokr.py

# On Linux
cd /home/user/stockplatform
python3 scripts/fetch_krx_from_datagokr.py
```

## Expected Output

```
🚀 KRX 종목 정보 수집 시작 (data.go.kr API)
✅ 데이터베이스 스키마 검증 완료 (code 컬럼 존재)
📅 기준일자: 20260123
📊 data.go.kr API를 통해 KRX 종목 정보 수집 중...
   ✅ Batch 1 저장 완료 (100개)
   ...
🎉 최종 완료
   ✅ 성공: 2000개
   ❌ 실패: 0개
```

## Key Changes in Updated Version

1. **Database Schema Validation**: Checks if `code` column exists before running
2. **Better Error Messages**: Shows which items are missing `code` values
3. **Data Validation**: Verifies all required fields before inserting
4. **Improved Documentation**: Clear comments explaining each field

## Related Files

- Script: `scripts/fetch_krx_from_datagokr.py`
- Schema Fix: `my-research-platform/supabase/fix_companies_table_v2.sql`
- Diagnostics: `my-research-platform/supabase/diagnose_companies_table.sql`
- Initial Schema: `supabase/migrations/001_initial_schema.sql`

## Questions?

If you're still having issues:
1. Check that you pulled the latest changes
2. Run the diagnostic SQL script to verify your database schema
3. Check the script output for validation errors
