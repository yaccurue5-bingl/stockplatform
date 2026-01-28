#!/usr/bin/env python3
"""
DART 기업코드(corp_code) 동기화 스크립트
=======================================

DART API에서 corpCode.xml 파일을 다운로드하여
DB의 dart_corp_codes 테이블에 저장합니다.

이렇게 하면 매번 XML 파일을 다운로드/파싱하지 않고
DB에서 빠르게 조회할 수 있습니다.

사용법:
    python scripts/sync_dart_corp_codes.py
    python scripts/sync_dart_corp_codes.py --force-refresh
"""

import sys
import logging
from pathlib import Path
from typing import Dict, List
import time

# 프로젝트 루트를 Python 경로에 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.env_loader import load_env, get_supabase_config, validate_dart_api_key
from scripts.industry_classifier.dart_api import DARTClient

# 환경변수 로드
load_env()

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_supabase_client():
    """Supabase 클라이언트 생성"""
    try:
        from supabase import create_client, Client

        url, key = get_supabase_config(use_service_role=True)

        if not url or not key:
            raise ValueError("Supabase 설정이 없습니다.")

        return create_client(url, key)
    except Exception as e:
        logger.error(f"Supabase 클라이언트 생성 실패: {e}")
        raise


def sync_corp_codes_to_db(force_refresh: bool = False) -> int:
    """
    DART API에서 corp_code 데이터를 다운로드하여 DB에 저장

    Args:
        force_refresh: True면 기존 XML 파일 무시하고 새로 다운로드

    Returns:
        저장된 레코드 수
    """
    logger.info("=" * 70)
    logger.info("DART 기업코드 동기화 시작")
    logger.info("=" * 70)

    # 1. DART API 키 검증
    try:
        validate_dart_api_key()
    except ValueError as e:
        logger.error(str(e))
        return 0

    # 2. DART 클라이언트 생성 및 데이터 로드
    logger.info("DART API에서 corp_code 데이터 로드 중...")
    dart_client = DARTClient()

    try:
        corp_code_map = dart_client.load_corp_code_map(force_refresh=force_refresh)
        logger.info(f"✓ {len(corp_code_map)}개 기업 데이터 로드 완료")
    except Exception as e:
        logger.error(f"DART API 호출 실패: {e}")
        return 0

    if not corp_code_map:
        logger.warning("corp_code 데이터가 비어 있습니다.")
        return 0

    # 3. Supabase 클라이언트 생성
    try:
        supabase = get_supabase_client()
        logger.info("✓ Supabase 연결 완료")
    except Exception as e:
        logger.error(f"Supabase 연결 실패: {e}")
        return 0

    # 4. DB에 데이터 저장 (배치 처리)
    logger.info("DB에 데이터 저장 중...")

    # corp_code_map을 리스트로 변환
    records: List[Dict] = []
    for stock_code, info in corp_code_map.items():
        records.append({
            'stock_code': stock_code,
            'corp_code': info['corp_code'],
            'corp_name': info['corp_name'],
            'modify_date': info.get('modify_date', ''),
        })

    # 배치 크기 설정 (Supabase는 한 번에 많은 데이터를 처리할 수 있음)
    batch_size = 500
    total_saved = 0
    total_batches = (len(records) + batch_size - 1) // batch_size

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        batch_num = (i // batch_size) + 1

        try:
            # upsert: 있으면 업데이트, 없으면 삽입
            supabase.table("dart_corp_codes").upsert(
                batch,
                on_conflict="stock_code"
            ).execute()

            total_saved += len(batch)
            logger.info(f"  배치 {batch_num}/{total_batches}: {len(batch)}개 저장 완료 (누적: {total_saved}/{len(records)})")

            # Rate limiting (API 제한 방지)
            if i + batch_size < len(records):
                time.sleep(0.1)

        except Exception as e:
            logger.error(f"배치 {batch_num} 저장 실패: {e}")
            # 실패해도 계속 진행
            continue

    logger.info("=" * 70)
    logger.info(f"✓ 동기화 완료: {total_saved}/{len(records)}개 저장")
    logger.info("=" * 70)

    return total_saved


def verify_sync() -> bool:
    """
    동기화 결과 검증

    Returns:
        검증 성공 여부
    """
    logger.info("\n동기화 결과 검증 중...")

    try:
        supabase = get_supabase_client()

        # 전체 레코드 수 확인
        result = supabase.table("dart_corp_codes").select("stock_code", count="exact").execute()
        total_count = result.count if hasattr(result, 'count') else len(result.data)

        logger.info(f"✓ DB에 저장된 기업 수: {total_count}개")

        # 샘플 데이터 조회 (삼성전자)
        samsung = supabase.table("dart_corp_codes").select("*").eq("stock_code", "005930").execute()

        if samsung.data:
            logger.info(f"✓ 샘플 데이터 확인:")
            for key, value in samsung.data[0].items():
                if key not in ['created_at', 'updated_at']:
                    logger.info(f"    {key:15s}: {value}")
            return True
        else:
            logger.warning("⚠️  삼성전자(005930) 데이터를 찾을 수 없습니다.")
            return False

    except Exception as e:
        logger.error(f"검증 실패: {e}")
        return False


def main():
    """메인 함수"""
    import argparse

    parser = argparse.ArgumentParser(
        description="DART 기업코드 데이터를 DB에 동기화합니다."
    )
    parser.add_argument(
        '--force-refresh',
        action='store_true',
        help='기존 XML 파일을 무시하고 DART API에서 새로 다운로드'
    )

    args = parser.parse_args()

    try:
        # 동기화 실행
        saved_count = sync_corp_codes_to_db(force_refresh=args.force_refresh)

        if saved_count > 0:
            # 검증
            verify_sync()
            logger.info("\n✅ 모든 작업이 완료되었습니다.")
            return 0
        else:
            logger.error("\n❌ 동기화 실패")
            return 1

    except KeyboardInterrupt:
        logger.info("\n\n사용자에 의해 중단되었습니다.")
        return 1
    except Exception as e:
        logger.error(f"\n❌ 오류 발생: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
