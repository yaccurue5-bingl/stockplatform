"""
scripts/fetch_ecos_foreign_flow.py
===================================
한국은행 ECOS API → 전 영업일 외국인 순매수 KOSPI 수집.
EOD 배치 Step 2용 (fetch_mofe_indicator.py 대체).

CloudConvert/Groq 불필요 — ECOS API 직접 호출 (무료, SSL 문제 없음).
통계코드: 064Y002 (외국인 주식 거래 동향, 일별)

사용법:
  python scripts/fetch_ecos_foreign_flow.py
  python scripts/fetch_ecos_foreign_flow.py --date 20260419
  python scripts/fetch_ecos_foreign_flow.py --dry-run
"""

import os
import sys
import argparse
import logging
import requests
from datetime import date, timedelta
from pathlib import Path

try:
    from supabase import create_client as _supabase_create_client
except ImportError:
    _supabase_create_client = None

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('fetch_ecos_foreign_flow')

# ── 설정 ──────────────────────────────────────────────────────────────────────

ECOS_BASE  = 'https://ecos.bok.or.kr/api'
STAT_CODE  = '064Y002'   # 외국인 주식 거래 동향 (일별)
PAGE_SIZE  = 9999


# ── 날짜 헬퍼 ─────────────────────────────────────────────────────────────────

def get_prev_business_day(ref: date | None = None) -> date:
    d = (ref or date.today()) - timedelta(days=1)
    while d.weekday() >= 5:          # 토(5)/일(6) 스킵
        d -= timedelta(days=1)
    return d


def to_yyyymmdd(d: date) -> str:
    return d.strftime('%Y%m%d')


def to_iso(d: date) -> str:
    return d.strftime('%Y-%m-%d')


# ── ECOS API ──────────────────────────────────────────────────────────────────

def ecos_search(api_key: str, start: str, end: str) -> list[dict]:
    """
    ECOS StatisticSearch 호출.
    start/end: YYYYMMDD
    반환: row 리스트
    """
    url = '/'.join([
        ECOS_BASE, 'StatisticSearch', api_key, 'json', 'kr',
        '1', str(PAGE_SIZE), STAT_CODE, 'D', start, end,
        '', '', '', '',   # item_code 1~4 (빈 문자열 = 와일드카드)
    ]) + '/'

    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f'ECOS API 호출 실패: {e}')
        return []

    result = data.get('StatisticSearch', {})
    if 'RESULT' in result:
        code = result['RESULT'].get('CODE', '')
        msg  = result['RESULT'].get('MESSAGE', '')
        logger.warning(f'ECOS 응답: [{code}] {msg}')
        return []

    rows = result.get('row', [])
    if isinstance(rows, dict):
        rows = [rows]
    return rows or []


def parse_foreign_net_buy(rows: list[dict]) -> dict[str, float]:
    """
    rows → {YYYY-MM-DD: 억원} 변환.
    ECOS 064Y002 구조: 항목이 여러 개이므로 '순매수' 키워드 항목만 사용.
    없으면 전체 합산 대신 첫 번째 항목 사용 (기존 backfill 방식과 동일).
    """
    result: dict[str, float] = {}

    # 항목명에 '순매수' 포함된 행 우선 필터
    net_buy_rows = [
        r for r in rows
        if '순매수' in (r.get('ITEM_NAME1', '') + r.get('ITEM_NAME2', '') + r.get('ITEM_NAME3', ''))
        and 'KOSPI' in (r.get('ITEM_NAME1', '') + r.get('ITEM_NAME2', '') + r.get('ITEM_NAME3', '')).upper()
    ]

    # KOSPI 순매수 항목이 없으면 '순매수' 항목 전체 사용
    if not net_buy_rows:
        net_buy_rows = [
            r for r in rows
            if '순매수' in (r.get('ITEM_NAME1', '') + r.get('ITEM_NAME2', '') + r.get('ITEM_NAME3', ''))
        ]

    # 그래도 없으면 전체 rows 그대로 (기존 backfill 동작과 동일)
    target_rows = net_buy_rows if net_buy_rows else rows

    for row in target_rows:
        time_str = str(row.get('TIME', ''))
        raw_val  = row.get('DATA_VALUE')

        if not time_str or raw_val in (None, '', '-'):
            continue

        time_str = time_str.replace('/', '').replace('-', '')
        if len(time_str) != 8:
            continue

        iso = f'{time_str[:4]}-{time_str[4:6]}-{time_str[6:]}'
        try:
            val = float(str(raw_val).replace(',', ''))
            result[iso] = round(val, 2)
        except (ValueError, TypeError):
            continue

    return result


# ── Supabase ──────────────────────────────────────────────────────────────────

def get_supabase():
    if _supabase_create_client is None:
        logger.error('supabase 패키지 미설치: pip install supabase')
        sys.exit(1)
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        logger.error('Supabase 환경변수 누락')
        sys.exit(1)
    return _supabase_create_client(url, key)


def save_to_db(sb, iso_date: str, value: float) -> bool:
    try:
        sb.table('daily_indicators').upsert(
            {
                'date':                  iso_date,
                'foreign_net_buy_kospi': value,
                'source':                '한국은행_ECOS',
            },
            on_conflict='date',
        ).execute()
        return True
    except Exception as e:
        logger.error(f'DB 저장 실패 ({iso_date}): {e}')
        return False


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='ECOS 외국인 순매수 일별 수집 (EOD Step 2)')
    parser.add_argument('--date',    help='기준일 YYYYMMDD (기본: 전 영업일)')
    parser.add_argument('--dry-run', action='store_true', help='DB 저장 없이 출력만')
    args = parser.parse_args()

    # 대상 날짜 결정
    if args.date:
        target = date(int(args.date[:4]), int(args.date[4:6]), int(args.date[6:]))
    else:
        target = get_prev_business_day()

    target_iso    = to_iso(target)
    target_yyyymm = to_yyyymmdd(target)

    # ECOS는 최근 데이터가 1~2일 지연될 수 있으므로 ±3일 범위로 조회
    start = get_prev_business_day(target - timedelta(days=1))  # target 기준 이전 영업일
    end   = target

    logger.info('=' * 55)
    logger.info('  ECOS 외국인 순매수 수집 (EOD)')
    logger.info(f'  대상일: {target_iso}  dry_run={args.dry_run}')
    logger.info('=' * 55)

    api_key = os.environ.get('ECOS_API_KEY', '').strip()
    if not api_key:
        logger.error('ECOS_API_KEY 환경변수 누락')
        sys.exit(1)

    # ECOS 조회 (대상일 포함 최근 5영업일 — ECOS 지연 대비)
    fetch_start = to_yyyymmdd(target - timedelta(days=7))
    fetch_end   = target_yyyymm
    logger.info(f'  ECOS 조회: {fetch_start} ~ {fetch_end}')

    rows = ecos_search(api_key, fetch_start, fetch_end)
    logger.info(f'  수신 rows: {len(rows)}개')

    if not rows:
        logger.warning('  ECOS 데이터 없음 — 주말·공휴일 또는 API 지연일 수 있음. 정상 종료.')
        sys.exit(0)

    flow_map = parse_foreign_net_buy(rows)
    logger.info(f'  파싱된 날짜: {sorted(flow_map.keys())}')

    # 대상일 데이터 확인
    value = flow_map.get(target_iso)

    if value is None:
        # ECOS 지연 — 최근 가용 날짜 데이터 확인
        available = sorted(flow_map.keys(), reverse=True)
        logger.warning(f'  {target_iso} 데이터 없음 (ECOS 지연)')
        if available:
            logger.info(f'  가용 최신 날짜: {available[0]} → 해당 날짜 저장 시도')
            value     = flow_map[available[0]]
            target_iso = available[0]
        else:
            logger.warning('  저장할 데이터 없음. 정상 종료.')
            sys.exit(0)

    sign = '+' if value >= 0 else ''
    logger.info(f'  외국인 순매수 [{target_iso}]: {sign}{value:,.0f}억원')

    if args.dry_run:
        logger.info('  [DRY-RUN] DB 저장 생략.')
        sys.exit(0)

    sb = get_supabase()
    ok = save_to_db(sb, target_iso, value)

    logger.info('=' * 55)
    if ok:
        logger.info(f'  ✅ 완료: {target_iso} 외국인 순매수 {sign}{value:,.0f}억원 저장')
        sys.exit(0)
    else:
        logger.error('  ❌ DB 저장 실패')
        sys.exit(1)


if __name__ == '__main__':
    main()
