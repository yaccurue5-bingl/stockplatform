#!/usr/bin/env python3
"""
DB 스키마 확인 스크립트
- ksic_codes 테이블 구조 확인
- companies 테이블 구조 확인
"""

import os
from supabase import create_client
from dotenv import load_dotenv
from pathlib import Path

# 환경 변수 로드
base_path = Path(__file__).resolve().parent.parent

# .env.local 파일 경로 탐색
env_paths = [
    base_path / '.env.local',
    base_path / 'my-research-platform' / '.env.local',
]

env_loaded = False
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print(f"✅ 환경 변수 로드: {env_path}")
        env_loaded = True
        break

if not env_loaded:
    load_dotenv()
    print("⚠️ 기본 환경 변수 로드")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Supabase 환경 변수 누락")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_table_schema(table_name):
    """테이블 스키마 확인"""
    print(f"\n{'='*70}")
    print(f"📊 {table_name} 테이블 스키마")
    print(f"{'='*70}")

    try:
        # 샘플 데이터 1개 조회하여 컬럼 확인
        response = supabase.table(table_name).select("*").limit(1).execute()

        if response.data:
            print("\n✅ 테이블 존재!")
            print(f"\n컬럼 목록:")
            for key in response.data[0].keys():
                print(f"  - {key}")

            print(f"\n샘플 데이터 (1행):")
            for key, value in response.data[0].items():
                print(f"  {key}: {value}")
        else:
            print("\n⚠️ 테이블이 비어있습니다.")

        # 총 레코드 수 확인
        count_response = supabase.table(table_name).select("*", count="exact").limit(1).execute()
        print(f"\n총 레코드 수: {count_response.count}")

    except Exception as e:
        print(f"\n❌ 테이블 조회 실패: {e}")

def check_ksic_codes_data():
    """ksic_codes 테이블 데이터 샘플 확인"""
    print(f"\n{'='*70}")
    print("📋 ksic_codes 테이블 데이터 샘플 (10개)")
    print(f"{'='*70}")

    try:
        response = supabase.table("ksic_codes").select("*").limit(10).execute()

        if response.data:
            for idx, row in enumerate(response.data, 1):
                print(f"\n{idx}. {row}")
        else:
            print("\n⚠️ 데이터가 없습니다.")

    except Exception as e:
        print(f"\n❌ 조회 실패: {e}")

def check_companies_data():
    """companies 테이블 데이터 샘플 확인 (sector 컬럼 중심)"""
    print(f"\n{'='*70}")
    print("📋 companies 테이블 데이터 샘플 (10개)")
    print(f"{'='*70}")

    try:
        response = supabase.table("companies").select("stock_code, corp_name, sector, market").limit(10).execute()

        if response.data:
            for idx, row in enumerate(response.data, 1):
                print(f"{idx}. [{row.get('stock_code')}] {row.get('corp_name'):<20} | sector: {row.get('sector', 'N/A'):<15} | market: {row.get('market', 'N/A')}")
        else:
            print("\n⚠️ 데이터가 없습니다.")

    except Exception as e:
        print(f"\n❌ 조회 실패: {e}")

if __name__ == "__main__":
    print("\n🔍 DB 스키마 및 데이터 확인 시작...\n")

    # ksic_codes 테이블 확인
    check_table_schema("ksic_codes")
    check_ksic_codes_data()

    # companies 테이블 확인
    check_table_schema("companies")
    check_companies_data()

    print(f"\n{'='*70}")
    print("✅ 확인 완료!")
    print(f"{'='*70}\n")
