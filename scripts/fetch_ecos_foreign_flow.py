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

ECOS_BASE        = 'https://ecos.bok.or.kr/api'
STAT_CODE        = '802Y001'   # 1.5.1.1. 주식시장(일)
ITEM_KOSPI_FLOW  = '0030000'   # 외국인 순매수(유가증권시장/KOSPI), 단위: 억원
ITEM_KOSDAQ_FLOW = '0113000'   # 외국인 순매수(코스닥시장/KOSDAQ),  단위: 억원
PAGE_SIZE        = 9999


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

def ecos_search_item(api_key: str, start: str, end: str, item_code: str) -> list[dict]:
    """ECOS StatisticSearch — 특정 item_code 단일 조회."""
    url = '/'.join([
        ECOS_BASE, 'StatisticSearch', api_key, 'json', 'kr',
        '1', str(PAGE_SIZE), STAT_CODE, 'D', start, end,
        item_code, '', '', '',
    ]) + '/'
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f'ECOS API 호출 실패 (item={item_code}): {e}')
        return []

    result = data.get('StatisticSearch', {})
    if 'RESULT' in result:
        logger.warning(f"ECOS 응답: {result['RESULT']}")
        return []

    rows = result.get('row', [])
    return [rows] if isinstance(rows, dict) else (rows or [])


def parse_values(rows: list[dict]) -> dict[str, float]:
    """rows → {YYYY-MM-DD: float(억원)}. 1 item_code 기준이므로 1일 1행."""
    result: dict[str, float] = {}
    for row in rows:
        t = str(row.get('TIME', '')).replace('/', '').replace('-', '')
        v = row.get('DATA_VALUE')
        if len(t) != 8 or v in (None, '', '-'):
            continue
        iso = f'{t[:4]}-{t[4:6]}-{t[6:]}'
        try:
            result[iso] = round(float(str(v).replace(',', '')), 2)
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


def save_to_db(sb, iso_date: str, kospi: float | None, kosdaq: float | None) -> bool:
    row: dict = {'date': iso_date, 'source': '한국은행_ECOS'}
    if kospi  is not None: row['foreign_net_buy_kospi']  = kospi
    if kosdaq is not None: row['foreign_net_buy_kosdaq'] = kosdaq
    try:
        sb.table('daily_indicators').upsert(row, on_conflict='date').execute()
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

    # ECOS 조회 (최근 7일 범위 — ECOS 지연 대비)
    fetch_start = to_yyyymmdd(target - timedelta(days=7))
    fetch_end   = target_yyyymm
    logger.info(f'  ECOS 조회: {fetch_start} ~ {fetch_end}')

    kospi_rows  = ecos_search_item(api_key, fetch_start, fetch_end, ITEM_KOSPI_FLOW)
    kosdaq_rows = ecos_search_item(api_key, fetch_start, fetch_end, ITEM_KOSDAQ_FLOW)
    logger.info(f'  수신: KOSPI {len(kospi_rows)}행 / KOSDAQ {len(kosdaq_rows)}행')

    kospi_map  = parse_values(kospi_rows)
    kosdaq_map = parse_values(kosdaq_rows)

    all_dates = sorted(set(kospi_map) | set(kosdaq_map), reverse=True)
    logger.info(f'  파싱된 날짜: {all_dates}')

    if not all_dates:
        logger.warning('  ECOS 데이터 없음 — 주말·공휴일 또는 API 지연. 정상 종료.')
        sys.exit(0)

    # 대상일 우선, 없으면 가장 최신 날짜 사용
    save_date = target_iso if target_iso in all_dates else all_dates[0]
    if save_date != target_iso:
        logger.warning(f'  {target_iso} 데이터 없음 (ECOS 지연) → {save_date} 사용')

    kospi_val  = kospi_map.get(save_date)
    kosdaq_val = kosdaq_map.get(save_date)

    def fmt(v): return f'{v:+,.0f}억원' if v is not None else 'N/A'
    logger.info(f'  [{save_date}] KOSPI 순매수: {fmt(kospi_val)} / KOSDAQ 순매수: {fmt(kosdaq_val)}')

    if args.dry_run:
        logger.info('  [DRY-RUN] DB 저장 생략.')
        sys.exit(0)

    sb = get_supabase()
    ok = save_to_db(sb, save_date, kospi_val, kosdaq_val)

    logger.info('=' * 55)
    if ok:
        logger.info(f'  ✅ 완료: {save_date} 저장 (KOSPI {fmt(kospi_val)} / KOSDAQ {fmt(kosdaq_val)})')
        sys.exit(0)
    else:
        logger.error('  ❌ DB 저장 실패')
        sys.exit(1)


if __name__ == '__main__':
    main()
