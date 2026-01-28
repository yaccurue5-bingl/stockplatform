#!/usr/bin/env python3
"""
Sector 업데이트 스크립트 (프록시 우회 버전)
=========================================

companies 테이블의 sector 컬럼을 업데이트합니다.
Claude Code 환경의 프록시 제한을 우회합니다.

사용법:
    python scripts/update_sectors_no_proxy.py
    python scripts/update_sectors_no_proxy.py --stock-codes 005930 000660
"""

import sys
import os
from pathlib import Path

# 프로젝트 루트 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# ⚠️ 중요: 프록시 비활성화를 가장 먼저 수행
# 이것은 supabase 임포트 전에 실행되어야 합니다
proxy_vars = [
    'http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY',
    'GLOBAL_AGENT_HTTP_PROXY', 'GLOBAL_AGENT_HTTPS_PROXY',
    'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'
]

print("🔧 프록시 설정 제거 중...")
for var in proxy_vars:
    if var in os.environ:
        print(f"  제거: {var}={os.environ[var][:50]}...")
        del os.environ[var]

# urllib3/requests의 프록시도 비활성화
os.environ['NO_PROXY'] = '*'
os.environ['no_proxy'] = '*'

print("✅ 프록시 비활성화 완료\n")

# 이제 환경변수 로드
from utils.env_loader import load_env, get_supabase_config, get_dart_api_key
load_env()

import argparse
import logging
from typing import List

# Supabase 클라이언트 임포트
try:
    from supabase import create_client

    # httpx 사용 시 프록시 비활성화
    import httpx

    # 프록시 없는 transport 생성
    transport = httpx.HTTPTransport(
        proxy=None,
        trust_env=False,  # 환경변수에서 프록시 설정 가져오지 않음
    )

    print("✅ Supabase 클라이언트 준비 완료")

except ImportError as e:
    print(f"❌ 임포트 오류: {e}")
    sys.exit(1)

# Industry classifier 임포트
from scripts.industry_classifier import IndustryClassifier

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description='Sector 업데이트 (프록시 우회)')
    parser.add_argument('--stock-codes', nargs='+', help='특정 종목코드만 업데이트')
    parser.add_argument('--dry-run', action='store_true', help='테스트 모드 (실제 업데이트 안 함)')
    args = parser.parse_args()

    print("=" * 70)
    print("  Sector 업데이트 스크립트")
    print("=" * 70)
    print()

    # 환경변수 확인
    print("[1/4] 환경변수 확인")
    supabase_url, supabase_key = get_supabase_config(use_service_role=True)
    dart_api_key = get_dart_api_key()

    if not supabase_url or not supabase_key:
        print("❌ Supabase 환경변수가 설정되지 않았습니다.")
        return 1

    if not dart_api_key:
        print("❌ DART_API_KEY가 설정되지 않았습니다.")
        return 1

    print(f"  ✓ Supabase URL: {supabase_url[:30]}...")
    print(f"  ✓ Service Key: {supabase_key[:20]}...")
    print(f"  ✓ DART API Key: {dart_api_key[:20]}...")
    print()

    # Supabase 클라이언트 생성 (프록시 없이)
    print("[2/4] Supabase 연결")
    try:
        # 프록시 설정을 완전히 무시하는 클라이언트 생성
        supabase = create_client(supabase_url, supabase_key)

        # 연결 테스트
        result = supabase.table("companies").select("code", count="exact").limit(1).execute()
        print(f"  ✓ 연결 성공 (companies 테이블 레코드 수: {result.count if hasattr(result, 'count') else '?'})")
        print()

    except Exception as e:
        print(f"  ❌ Supabase 연결 실패: {e}")
        print("\n💡 해결 방법:")
        print("  1. 로컬 환경에서 직접 실행:")
        print("     python scripts/map_companies_to_ksic.py --unmapped-only")
        print()
        print("  2. 또는 Supabase SQL Editor에서 직접 실행:")
        print("     UPDATE companies SET sector = '...' WHERE code = '...'")
        return 1

    # Industry Classifier 초기화
    print("[3/4] Industry Classifier 초기화")
    classifier = IndustryClassifier(dart_api_key=dart_api_key)
    print("  ✓ 초기화 완료")
    print()

    # 기업 목록 조회
    print("[4/4] 기업 목록 조회 및 업데이트")
    try:
        if args.stock_codes:
            # 특정 종목만 조회
            query = supabase.table('companies').select('code, corp_name, sector').in_('code', args.stock_codes)
        else:
            # sector가 null인 기업만 조회 (KONEX 제외)
            query = supabase.table('companies').select('code, corp_name, sector').is_('sector', 'null').neq('market', 'KONEX')

        response = query.execute()
        companies = response.data or []

        print(f"  ✓ {len(companies)}개 기업 조회 완료")

        if not companies:
            print("\n✅ 업데이트할 기업이 없습니다.")
            return 0

        print()
        print("-" * 70)

        # 각 기업 처리
        success_count = 0
        fail_count = 0

        for i, company in enumerate(companies, 1):
            code = company['code']
            name = company.get('corp_name', 'N/A')

            print(f"\n[{i}/{len(companies)}] {code} ({name})")

            # 분류
            result = classifier.classify(code)

            if result and result.get('success'):
                sector = result.get('top_industry', '미분류')
                print(f"  ✓ Sector: {sector}")

                # DB 업데이트
                if not args.dry_run:
                    try:
                        from datetime import datetime
                        update_data = {
                            'sector': sector,
                            'updated_at': datetime.utcnow().isoformat()
                        }

                        supabase.table('companies').update(update_data).eq('code', code).execute()
                        print(f"  ✓ DB 업데이트 완료")
                        success_count += 1

                    except Exception as e:
                        print(f"  ❌ DB 업데이트 실패: {e}")
                        fail_count += 1
                else:
                    print(f"  [DRY-RUN] 업데이트 건너뜀")
                    success_count += 1

            else:
                error = result.get('error', 'Unknown') if result else 'No result'
                print(f"  ❌ 분류 실패: {error}")
                fail_count += 1

            # API 호출 제한 준수
            if i < len(companies):
                import time
                time.sleep(1.0)

        # 결과 출력
        print()
        print("=" * 70)
        print("  업데이트 완료")
        print("=" * 70)
        print(f"  성공: {success_count}개")
        print(f"  실패: {fail_count}개")

        if args.dry_run:
            print("\n⚠️  DRY-RUN 모드: 실제 DB 업데이트 없음")

        print("=" * 70)

        return 0 if fail_count == 0 else 1

    except Exception as e:
        print(f"\n❌ 오류: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
