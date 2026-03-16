#!/usr/bin/env python3
"""
Sector 누락 수정 스크립트
=========================

Supabase companies 테이블에서 sector가 "기타" 또는 NULL인 종목만
DART API를 통해 정확한 sector로 업데이트합니다.

사용법:
    python scripts/fix_missing_sectors.py              # 전체 수정
    python scripts/fix_missing_sectors.py --dry-run    # 테스트 (DB 수정 안함)
    python scripts/fix_missing_sectors.py --limit 10   # 10개만 처리
"""

import os
import sys
import argparse
import logging
import time
from pathlib import Path
from datetime import datetime

# 프로젝트 루트 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.env_loader import load_env
load_env()

from supabase import create_client

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_supabase_client():
    """Supabase 클라이언트 생성"""
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise ValueError("Supabase 환경변수가 설정되지 않았습니다.")

    return create_client(url, key)


def get_missing_sector_stocks(supabase, limit=None):
    """sector가 '기타' 또는 NULL인 종목 조회"""
    query = supabase.table("companies").select("stock_code, corp_name, sector")

    # sector가 NULL이거나 '기타'인 것만 조회
    # Supabase에서는 or 필터 사용
    response = query.or_("sector.is.null,sector.eq.기타").execute()

    stocks = response.data if response.data else []

    if limit:
        stocks = stocks[:limit]

    return stocks


def is_preferred_stock(corp_name: str) -> bool:
    """우선주 여부 확인"""
    if not corp_name:
        return False
    # 우선주 접미사 패턴: 우, 우B, 우C, 1우, 2우, 3우 등
    preferred_suffixes = ['우', '우B', '우C', '우D', '1우', '2우', '3우', '1우B', '2우B']
    for suffix in preferred_suffixes:
        if corp_name.endswith(suffix):
            return True
    return False


def get_base_stock_name(corp_name: str) -> str:
    """우선주에서 원본 종목명 추출 (예: 삼성전자우 → 삼성전자)"""
    if not corp_name:
        return corp_name

    # 우선주 접미사 제거 (긴 것부터 확인)
    preferred_suffixes = ['1우B', '2우B', '우B', '우C', '우D', '1우', '2우', '3우', '우']
    for suffix in preferred_suffixes:
        if corp_name.endswith(suffix):
            return corp_name[:-len(suffix)]
    return corp_name


def find_base_stock_sector(supabase, corp_name: str) -> str:
    """원본 종목(보통주)의 sector 조회"""
    base_name = get_base_stock_name(corp_name)

    if base_name == corp_name:
        return None

    # 원본 종목명으로 검색
    response = supabase.table("companies").select("corp_name, sector").eq("corp_name", base_name).execute()

    if response.data and len(response.data) > 0:
        sector = response.data[0].get('sector')
        if sector and sector != '기타':
            return sector

    return None


def classify_stock(stock_code: str):
    """DART API를 통해 종목의 sector 분류"""
    try:
        from scripts.industry_classifier import IndustryClassifier
        classifier = IndustryClassifier()
        result = classifier.classify(stock_code)

        if result and result.get('success'):
            return {
                'success': True,
                'sector': result.get('top_industry'),
                'ksic_code': result.get('ksic_code'),
                'corp_name': result.get('corp_name')
            }
        else:
            return {
                'success': False,
                'error': result.get('error') if result else 'Unknown error'
            }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def update_sector(supabase, stock_code: str, sector: str):
    """Supabase에 sector 업데이트"""
    update_data = {
        'sector': sector,
        'updated_at': datetime.now().isoformat()
    }

    response = supabase.table("companies").update(update_data).eq("stock_code", stock_code).execute()
    return response


def main():
    parser = argparse.ArgumentParser(description='Sector 누락 수정 스크립트')
    parser.add_argument('--dry-run', action='store_true', help='테스트 모드 (DB 수정 안함)')
    parser.add_argument('--limit', type=int, default=None, help='처리할 최대 종목 수')
    parser.add_argument('--delay', type=float, default=0.5, help='API 호출 간격 (초)')
    args = parser.parse_args()

    print("=" * 70)
    print("🔧 Sector 누락 수정 스크립트")
    print("=" * 70)

    if args.dry_run:
        print("⚠️  DRY-RUN 모드: DB를 수정하지 않습니다.\n")

    # Supabase 연결
    print("[1/4] Supabase 연결 중...")
    try:
        supabase = get_supabase_client()
        print("  ✓ Supabase 연결 성공\n")
    except Exception as e:
        print(f"  ✗ Supabase 연결 실패: {e}")
        sys.exit(1)

    # 누락된 sector 종목 조회
    print("[2/4] sector가 '기타' 또는 NULL인 종목 조회 중...")
    try:
        stocks = get_missing_sector_stocks(supabase, limit=args.limit)
        print(f"  ✓ {len(stocks)}개 종목 발견\n")
    except Exception as e:
        print(f"  ✗ 조회 실패: {e}")
        sys.exit(1)

    if not stocks:
        print("✅ 수정이 필요한 종목이 없습니다.")
        return

    # 종목별 sector 분류 및 업데이트
    print("[3/4] DART API를 통해 sector 분류 중...")
    print("-" * 70)

    success_count = 0
    fail_count = 0
    skip_count = 0
    results = []

    for i, stock in enumerate(stocks, 1):
        stock_code = stock['stock_code']
        corp_name = stock.get('corp_name', 'Unknown')
        old_sector = stock.get('sector', 'NULL')

        print(f"  [{i}/{len(stocks)}] {stock_code} ({corp_name})", end=" ")

        # DART API로 분류
        result = classify_stock(stock_code)

        if result['success']:
            new_sector = result['sector']

            if new_sector and new_sector != '기타':
                print(f"→ {new_sector}")

                if not args.dry_run:
                    try:
                        update_sector(supabase, stock_code, new_sector)
                        success_count += 1
                        results.append({
                            'stock_code': stock_code,
                            'corp_name': corp_name,
                            'old_sector': old_sector,
                            'new_sector': new_sector,
                            'status': 'updated'
                        })
                    except Exception as e:
                        print(f"    ⚠️  DB 업데이트 실패: {e}")
                        fail_count += 1
                else:
                    success_count += 1
                    results.append({
                        'stock_code': stock_code,
                        'corp_name': corp_name,
                        'old_sector': old_sector,
                        'new_sector': new_sector,
                        'status': 'would_update'
                    })
            else:
                print(f"→ 여전히 '기타' (SKIP)")
                skip_count += 1
        else:
            # DART API 실패 시 우선주 매칭 시도
            if is_preferred_stock(corp_name):
                base_sector = find_base_stock_sector(supabase, corp_name)
                if base_sector:
                    print(f"→ {base_sector} (우선주 매칭: {get_base_stock_name(corp_name)})")

                    if not args.dry_run:
                        try:
                            update_sector(supabase, stock_code, base_sector)
                            success_count += 1
                            results.append({
                                'stock_code': stock_code,
                                'corp_name': corp_name,
                                'old_sector': old_sector,
                                'new_sector': base_sector,
                                'status': 'updated (우선주)'
                            })
                        except Exception as e:
                            print(f"    ⚠️  DB 업데이트 실패: {e}")
                            fail_count += 1
                    else:
                        success_count += 1
                        results.append({
                            'stock_code': stock_code,
                            'corp_name': corp_name,
                            'old_sector': old_sector,
                            'new_sector': base_sector,
                            'status': 'would_update (우선주)'
                        })
                else:
                    print(f"→ 실패: 원본 종목({get_base_stock_name(corp_name)}) sector 없음")
                    fail_count += 1
            else:
                print(f"→ 실패: {result.get('error', 'Unknown')}")
                fail_count += 1

        # API Rate Limit 방지
        time.sleep(args.delay)

    print("-" * 70)

    # 결과 요약
    print("\n[4/4] 결과 요약")
    print("=" * 70)
    print(f"  총 처리: {len(stocks)}개")
    print(f"  ✅ 성공: {success_count}개")
    print(f"  ⏭️  스킵: {skip_count}개 (여전히 '기타')")
    print(f"  ❌ 실패: {fail_count}개")

    if args.dry_run:
        print("\n⚠️  DRY-RUN 모드였습니다. 실제 적용하려면 --dry-run 옵션을 제거하세요.")

    # 성공한 매핑 결과 출력
    if results:
        print("\n📋 매핑 결과:")
        print("-" * 70)
        for r in results[:20]:  # 최대 20개만 출력
            status = "✅" if r['status'] == 'updated' else "🔍"
            print(f"  {status} {r['stock_code']} ({r['corp_name']}): {r['old_sector']} → {r['new_sector']}")

        if len(results) > 20:
            print(f"  ... 외 {len(results) - 20}개")

    print("=" * 70)
    print("✅ 완료")


if __name__ == "__main__":
    main()
