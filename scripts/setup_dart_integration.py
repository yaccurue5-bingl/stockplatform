#!/usr/bin/env python3
"""
DART 통합 설정 스크립트
======================

이 스크립트는 DART API 통합에 필요한 모든 설정을 자동으로 수행합니다:
1. 환경변수 확인 (.env.local의 DART_API_KEY)
2. DB 마이그레이션 적용 (dart_corp_codes 테이블 생성)
3. DART API에서 corp_code 데이터 다운로드 및 DB 저장

사용법:
    python scripts/setup_dart_integration.py
"""

import sys
import os
from pathlib import Path
import logging

# 프로젝트 루트를 Python 경로에 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.env_loader import load_env, get_supabase_config, get_dart_api_key

# 환경변수 로드
load_env()

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def print_header(title: str):
    """헤더 출력"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def check_environment() -> bool:
    """환경변수 확인"""
    print_header("1. 환경변수 확인")

    # DART API 키 확인
    dart_api_key = get_dart_api_key()
    if dart_api_key:
        masked_key = dart_api_key[:8] + "..." + dart_api_key[-8:]
        print(f"✓ DART_API_KEY: {masked_key}")
    else:
        print("✗ DART_API_KEY가 설정되지 않았습니다.")
        print("  .env.local 파일에 DART_API_KEY를 추가하세요.")
        return False

    # Supabase 설정 확인
    supabase_url, supabase_key = get_supabase_config(use_service_role=True)
    if supabase_url and supabase_key:
        print(f"✓ Supabase URL: {supabase_url}")
        print(f"✓ Supabase Key: {supabase_key[:20]}...")
    else:
        print("✗ Supabase 설정이 없습니다.")
        return False

    return True


def create_table() -> bool:
    """dart_corp_codes 테이블 생성"""
    print_header("2. dart_corp_codes 테이블 생성")

    try:
        from supabase import create_client

        url, key = get_supabase_config(use_service_role=True)
        supabase = create_client(url, key)

        # 테이블 존재 여부 확인
        try:
            result = supabase.table("dart_corp_codes").select("count", count="exact").limit(0).execute()
            count = result.count if hasattr(result, 'count') else 0
            print(f"✓ dart_corp_codes 테이블이 이미 존재합니다. (레코드 수: {count})")
            return True
        except Exception:
            print("테이블이 존재하지 않습니다. 생성이 필요합니다.")

            # 마이그레이션 SQL 파일 경로 출력
            migration_file = PROJECT_ROOT / "supabase" / "migrations" / "008_add_dart_corp_codes_table.sql"
            print(f"\n다음 SQL 파일을 Supabase SQL Editor에서 실행하세요:")
            print(f"  {migration_file}")
            print(f"\nSupabase Dashboard → SQL Editor → New Query")
            print(f"파일 내용을 복사하여 실행하세요.\n")

            # SQL 파일 내용 출력
            with open(migration_file, 'r', encoding='utf-8') as f:
                sql_content = f.read()

            print("─" * 70)
            print(sql_content)
            print("─" * 70)

            response = input("\n테이블 생성을 완료했습니까? (y/n): ")
            return response.lower() == 'y'

    except Exception as e:
        logger.error(f"테이블 생성 확인 실패: {e}")
        return False


def sync_corp_codes() -> bool:
    """DART API에서 corp_code 데이터 동기화"""
    print_header("3. DART corp_code 데이터 동기화")

    try:
        from scripts.sync_dart_corp_codes import sync_corp_codes_to_db, verify_sync

        # 동기화 실행
        saved_count = sync_corp_codes_to_db(force_refresh=False)

        if saved_count > 0:
            print(f"✓ {saved_count}개 기업 데이터 동기화 완료")

            # 검증
            if verify_sync():
                return True

        return False

    except Exception as e:
        logger.error(f"동기화 실패: {e}", exc_info=True)
        return False


def test_db_client() -> bool:
    """DB 클라이언트 테스트"""
    print_header("4. DB 클라이언트 테스트")

    try:
        from scripts.industry_classifier.dart_db_client import DARTDBClient

        client = DARTDBClient()

        # 삼성전자 조회
        print("삼성전자(005930) 조회 중...")
        samsung = client.get_corp_code("005930")

        if samsung:
            print(f"✓ 기업명: {samsung['corp_name']}")
            print(f"✓ 기업코드: {samsung['corp_code']}")
            print(f"✓ 종목코드: {samsung['stock_code']}")
            return True
        else:
            print("✗ 삼성전자 데이터를 찾을 수 없습니다.")
            return False

    except Exception as e:
        logger.error(f"테스트 실패: {e}", exc_info=True)
        return False


def main():
    """메인 함수"""
    print("\n" + "=" * 70)
    print("  DART 통합 설정 스크립트")
    print("=" * 70)

    # 1. 환경변수 확인
    if not check_environment():
        print("\n❌ 환경변수 설정이 필요합니다.")
        return 1

    # 2. 테이블 생성
    if not create_table():
        print("\n❌ 테이블 생성이 필요합니다.")
        return 1

    # 3. 데이터 동기화
    if not sync_corp_codes():
        print("\n❌ 데이터 동기화 실패")
        return 1

    # 4. 테스트
    if not test_db_client():
        print("\n❌ DB 클라이언트 테스트 실패")
        return 1

    # 완료
    print_header("✅ 모든 설정 완료")
    print("\nDARTDBClient를 사용하여 corp_code를 조회할 수 있습니다:")
    print("\n  from scripts.industry_classifier.dart_db_client import DARTDBClient")
    print("  client = DARTDBClient()")
    print("  corp_info = client.get_corp_code('005930')")
    print("  industry_info = client.get_company_industry('005930')")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
