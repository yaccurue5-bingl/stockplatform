#!/usr/bin/env python3
"""
KONEX 종목 삭제 스크립트
========================

DB에서 KONEX 시장 종목을 삭제합니다.

사용법:
    # 삭제 전 확인 (Dry-run)
    python scripts/delete_konex_stocks.py --dry-run

    # 실제 삭제 실행
    python scripts/delete_konex_stocks.py

    # 강제 실행 (확인 없이)
    python scripts/delete_konex_stocks.py --force
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv

# 프로젝트 루트를 Python 경로에 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# .env.local 로드
env_path = PROJECT_ROOT / '.env.local'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

# 프록시 비활성화
for proxy_var in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'GLOBAL_AGENT_HTTP_PROXY']:
    os.environ.pop(proxy_var, None)

from supabase import create_client

# Supabase 클라이언트 초기화
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print('❌ Supabase 환경 변수가 설정되지 않았습니다.')
    print('   .env.local 파일에서 NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.')
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_konex_count():
    """KONEX 종목 수 조회"""
    try:
        result = supabase.table('companies').select('stock_code', count='exact').eq('market', 'KONEX').execute()
        return result.count
    except Exception as e:
        print(f'❌ KONEX 종목 수 조회 실패: {e}')
        return None


def get_konex_stocks(limit=10):
    """KONEX 종목 목록 조회"""
    try:
        result = supabase.table('companies').select('stock_code,corp_name,market').eq('market', 'KONEX').limit(limit).execute()
        return result.data
    except Exception as e:
        print(f'❌ KONEX 종목 목록 조회 실패: {e}')
        return []


def delete_konex_stocks():
    """KONEX 종목 삭제"""
    try:
        result = supabase.table('companies').delete().eq('market', 'KONEX').execute()
        return True
    except Exception as e:
        print(f'❌ KONEX 종목 삭제 실패: {e}')
        return False


def get_market_stats():
    """시장별 종목 수 통계"""
    try:
        # Supabase에서는 GROUP BY를 직접 지원하지 않으므로
        # 각 시장별로 개별 쿼리 실행
        kospi = supabase.table('companies').select('stock_code', count='exact').eq('market', 'KOSPI').execute()
        kosdaq = supabase.table('companies').select('stock_code', count='exact').eq('market', 'KOSDAQ').execute()
        konex = supabase.table('companies').select('stock_code', count='exact').eq('market', 'KONEX').execute()

        return {
            'KOSPI': kospi.count,
            'KOSDAQ': kosdaq.count,
            'KONEX': konex.count
        }
    except Exception as e:
        print(f'❌ 시장 통계 조회 실패: {e}')
        return None


def main():
    parser = argparse.ArgumentParser(
        description='KONEX 종목 삭제 스크립트',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--dry-run', action='store_true', help='삭제하지 않고 확인만 함')
    parser.add_argument('--force', action='store_true', help='확인 없이 즉시 삭제')

    args = parser.parse_args()

    print('=' * 70)
    print('KONEX 종목 삭제 스크립트')
    print('=' * 70)
    print()

    # 1. 현재 상태 확인
    print('📊 현재 DB 상태 확인 중...')
    stats = get_market_stats()
    if stats:
        print(f'   KOSPI:  {stats["KOSPI"]:5d}개')
        print(f'   KOSDAQ: {stats["KOSDAQ"]:5d}개')
        print(f'   KONEX:  {stats["KONEX"]:5d}개')
        print()
    else:
        print('⚠️  통계 조회 실패')
        return

    konex_count = stats['KONEX']

    if konex_count == 0:
        print('✅ KONEX 종목이 없습니다. 작업을 종료합니다.')
        return

    # 2. KONEX 종목 샘플 출력
    print(f'📋 KONEX 종목 샘플 (처음 10개):')
    konex_stocks = get_konex_stocks(limit=10)
    if konex_stocks:
        for stock in konex_stocks:
            print(f'   - {stock["stock_code"]}: {stock["corp_name"]} ({stock["market"]})')
        print()
    else:
        print('   (샘플 조회 실패)')
        print()

    # 3. Dry-run 모드
    if args.dry_run:
        print('⚠️  DRY-RUN 모드: 실제 삭제하지 않습니다.')
        print(f'   삭제 예정 종목: {konex_count}개')
        print()
        print('실제 삭제를 원하면 --dry-run 없이 다시 실행하세요:')
        print('  python scripts/delete_konex_stocks.py')
        return

    # 4. 사용자 확인
    if not args.force:
        print(f'⚠️  {konex_count}개의 KONEX 종목을 삭제하시겠습니까?')
        print('   이 작업은 되돌릴 수 없습니다!')
        print()
        response = input('   삭제하려면 "yes"를 입력하세요: ').strip().lower()

        if response != 'yes':
            print('❌ 작업이 취소되었습니다.')
            return

    # 5. 삭제 실행
    print()
    print(f'🗑️  {konex_count}개의 KONEX 종목 삭제 중...')

    if delete_konex_stocks():
        print('✅ KONEX 종목이 성공적으로 삭제되었습니다.')
    else:
        print('❌ 삭제 중 오류가 발생했습니다.')
        sys.exit(1)

    # 6. 삭제 후 통계 확인
    print()
    print('📊 삭제 후 DB 상태:')
    stats_after = get_market_stats()
    if stats_after:
        print(f'   KOSPI:  {stats_after["KOSPI"]:5d}개')
        print(f'   KOSDAQ: {stats_after["KOSDAQ"]:5d}개')
        print(f'   KONEX:  {stats_after["KONEX"]:5d}개')
        print()
    else:
        print('⚠️  통계 조회 실패')

    print('=' * 70)
    print('✅ 작업 완료')
    print('=' * 70)


if __name__ == '__main__':
    main()
