#!/usr/bin/env python3
"""
Run migration 007 - Companies table cleanup
Uses PostgreSQL connection to execute SQL directly
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# .env.local 파일 로드
project_root = Path(__file__).parent.parent
env_path = project_root / ".env.local"
load_dotenv(env_path)

# Supabase URL에서 project reference 추출
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
if not SUPABASE_URL:
    print("❌ Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local")
    sys.exit(1)

# URL에서 project ref 추출 (예: https://rxcwqsolfrjhomeusyza.supabase.co -> rxcwqsolfrjhomeusyza)
project_ref = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")

print("=" * 60)
print("🔧 Companies Table Cleanup Migration")
print("=" * 60)
print("\n📋 This migration will:")
print("  1. Remove duplicate rows (prefer codes without 'A' prefix)")
print("  2. Drop unnecessary columns: industry_category, corp_code, ksic_name")
print("  3. Reset sector column to NULL")
print("\n" + "=" * 60)

# 마이그레이션 파일 읽기
migration_file = project_root / "supabase" / "migrations" / "007_cleanup_companies_table.sql"

if not migration_file.exists():
    print(f"❌ Error: Migration file not found: {migration_file}")
    sys.exit(1)

print(f"\n📖 Migration file: {migration_file}")

with open(migration_file, 'r', encoding='utf-8') as f:
    sql_content = f.read()

print("\n" + "=" * 60)
print("📝 SQL Migration Content")
print("=" * 60)
print("\nPlease execute this SQL in your Supabase Dashboard:")
print(f"\n🔗 Dashboard URL:")
print(f"   https://supabase.com/dashboard/project/{project_ref}/editor/sql")
print("\n" + "=" * 60)
print("\nSQL to execute:")
print("=" * 60)
print(sql_content)
print("=" * 60)

print("\n" + "=" * 60)
print("📌 Instructions:")
print("=" * 60)
print("1. Open the Supabase Dashboard URL above")
print("2. Navigate to SQL Editor")
print("3. Copy and paste the SQL content above")
print("4. Click 'Run' to execute the migration")
print("=" * 60)

print("\n💡 Alternative: If you have the database password, you can run:")
print(f"   psql 'postgresql://postgres:[PASSWORD]@db.{project_ref}.supabase.co:5432/postgres' < {migration_file}")
print("=" * 60)

# 마이그레이션 파일을 임시 위치에 복사하여 쉽게 접근할 수 있게 함
import shutil
temp_sql = project_root / "migration_007.sql"
shutil.copy(migration_file, temp_sql)
print(f"\n📄 SQL file copied to: {temp_sql}")
print("   (for easier access)")
print("\n✨ Please execute the migration manually and confirm when done.")
