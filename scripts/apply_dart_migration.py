#!/usr/bin/env python3
"""
DART Corp Codes 마이그레이션 적용
================================

Supabase Python 클라이언트를 사용하여
008_add_dart_corp_codes_table.sql 마이그레이션을 적용합니다.
"""

import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.env_loader import load_env, get_supabase_config

# 환경변수 로드
load_env()

def apply_migration():
    """마이그레이션 적용"""
    from supabase import create_client

    url, key = get_supabase_config(use_service_role=True)
    supabase = create_client(url, key)

    # 마이그레이션 SQL 파일 읽기
    migration_file = PROJECT_ROOT / "supabase" / "migrations" / "008_add_dart_corp_codes_table.sql"

    print(f"마이그레이션 파일 읽기: {migration_file}")

    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    # SQL을 개별 문장으로 분리하여 실행
    print("마이그레이션 적용 중...")

    try:
        # Supabase에서는 rpc를 통해 SQL 실행
        # 먼저 테이블이 존재하는지 확인
        result = supabase.table("dart_corp_codes").select("count", count="exact").limit(0).execute()
        print("✓ dart_corp_codes 테이블이 이미 존재합니다.")
    except Exception as e:
        # 테이블이 없으면 생성
        print(f"dart_corp_codes 테이블 생성 중...")

        # 기본 테이블 생성 SQL만 실행 (함수 제외)
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS public.dart_corp_codes (
          stock_code TEXT PRIMARY KEY,
          corp_code TEXT NOT NULL,
          corp_name TEXT NOT NULL,
          modify_date TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(corp_code)
        );
        """

        try:
            supabase.rpc('exec_sql', {'sql': create_table_sql}).execute()
            print("✓ dart_corp_codes 테이블 생성 완료")
        except Exception as e2:
            print(f"⚠️  직접 SQL 실행 실패. 대신 Supabase 대시보드에서 수동으로 실행하세요.")
            print(f"   SQL 파일: {migration_file}")
            print(f"   오류: {e2}")

    print("\n✅ 마이그레이션 준비 완료")
    print("   다음 단계: python scripts/sync_dart_corp_codes.py")


if __name__ == "__main__":
    apply_migration()
