"""
scripts/backfill_mofe_indicator.py
===================================
재정경제부 일일경제지표 과거 데이터 백필.

게시판 목록 페이지를 파싱해 최근 N개 게시물을 찾고,
이미 DB에 없는 날짜만 CloudConvert → Groq 추출 → Supabase 저장.

사용:
  python scripts/backfill_mofe_indicator.py             # 최근 10개
  python scripts/backfill_mofe_indicator.py --count 5   # 최근 5개
  python scripts/backfill_mofe_indicator.py --dry-run   # DB 저장 없이 확인
  python scripts/backfill_mofe_indicator.py --force     # 이미 있는 날짜도 덮어쓰기

CloudConvert: 1 크레딧/건  →  --count 이하로 크레딧이 부족하면 가능한 만큼만 처리.
"""

import os
import re
import json
import ssl
import sys
import time
import logging
import tempfile
import argparse
from pathlib import Path
from datetime import date

import urllib3
import requests
from requests.adapters import HTTPAdapter
import pdfplumber
from groq import Groq
from dotenv import load_dotenv
from supabase import create_client

# ── 환경변수 ──────────────────────────────────────────────────────────────────
_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / '.env.local', override=True)
load_dotenv(_ROOT / 'frontend' / '.env.local', override=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('backfill_mofe')

# ── 클라이언트 초기화 ──────────────────────────────────────────────────────────
CLOUDCONVERT_API_KEY = os.environ['CLOUDCONVERT_API_KEY'].strip()
SUPABASE_URL         = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY         = os.environ['SUPABASE_SERVICE_ROLE_KEY']
GROQ_API_KEY         = os.environ['GROQ_API_KEY'].strip()

sb           = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client  = Groq(api_key=GROQ_API_KEY)
CC_HEADERS   = {'Authorization': f'Bearer {CLOUDCONVERT_API_KEY}', 'Content-Type': 'application/json'}

# ── mofe.go.kr 설정 ────────────────────────────────────────────────────────────
BASE_URL    = 'https://www.mofe.go.kr'
BOARD_URL   = (
    f'{BASE_URL}/st/ecnmyidx/listTbEconomyIndicatorView.do'
    '?bbsId=MOSFBBS_000000000045&menuNo=6010200'
)
DETAIL_BASE = f'{BASE_URL}/st/ecnmyidx/detailTbEconomyIndicatorView.do'
BBS_ID      = 'MOSFBBS_000000000045'
SITE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  'Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Referer': BASE_URL,
}

# SSL 경고 억제 (mofe.go.kr 레거시 인증서 대응)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class _LegacySSLAdapter(HTTPAdapter):
    """
    한국 정부 사이트(mofe.go.kr)는 Python 3.10+ 기본 SSL 보안 정책과
    호환되지 않는 경우가 많음 (WinError 10054 / SSL handshake 실패).
    - SECLEVEL=1 로 레거시 cipher 허용
    - 인증서 검증 비활성화 (공공기관 사이트 자체 서명 대응)
    """
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        try:
            ctx.set_ciphers('DEFAULT:@SECLEVEL=1')
        except ssl.SSLError:
            pass  # 일부 OpenSSL 버전에서 무시
        kwargs['ssl_context'] = ctx
        return super().init_poolmanager(*args, **kwargs)

    def proxy_manager_for(self, proxy, **proxy_kwargs):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        try:
            ctx.set_ciphers('DEFAULT:@SECLEVEL=1')
        except ssl.SSLError:
            pass
        proxy_kwargs['ssl_context'] = ctx
        return super().proxy_manager_for(proxy, **proxy_kwargs)


def _make_mofe_session() -> requests.Session:
    """mofe.go.kr 전용 HTTP 세션 생성 (레거시 SSL + 재시도)."""
    session = requests.Session()
    adapter = _LegacySSLAdapter(
        max_retries=urllib3.Retry(
            total=3,
            backoff_factor=1.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=['GET', 'POST'],
        )
    )
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    session.headers.update(SITE_HEADERS)
    return session

# Groq 추출 프롬프트 (fetch_mofe_indicator.py와 동일)
INDICATOR_SYSTEM_PROMPT = """You are a STRICT financial data extraction engine for Korean government documents.

CRITICAL RULES:
1. DO NOT infer or estimate — only extract values explicitly printed in the text
2. DO NOT create numbers that are not present
3. If data is not explicitly present, return null
4. 날짜(date): extract the reference date of this report in YYYY-MM-DD format

KOREAN NUMBER FORMAT — VERY IMPORTANT:
- Korean documents use comma (,) as a THOUSANDS SEPARATOR, not a decimal point
- "8,300" means EIGHT THOUSAND THREE HUNDRED (8300), NOT 8.3
- "6,069" means SIX THOUSAND SIXTY NINE (6069), NOT 6.069
- "5,377.30" means five thousand three hundred seventy-seven point three (5377.30)
- NEVER interpret a comma in a number as a decimal point

MULTI-DATE COLUMNS — VERY IMPORTANT:
- The document contains a table with multiple date columns
- ALWAYS extract data from the MOST RECENT date column (rightmost data column)
- The 전일비 column = change from previous day

FIELD EXTRACTION RULES:
- kospi_close / kosdaq_close: closing index value from the LATEST date column
- kospi_change_pct / kosdaq_change_pct: 전일비 % for KOSPI/KOSDAQ (positive or negative)
- foreign_net_buy_kospi: 외국인 순매수 전일비 value in 억원
  * "△" or "▽" prefix means NEGATIVE — return as negative number
- foreign_net_buy_kosdaq: return null if only combined figure is shown
- usd_krw: USD/KRW exchange rate
- treasury_yield_3y: 3-year Korean treasury bond yield %
- wti_oil: WTI crude oil price in USD

Return JSON with EXACTLY this structure (no extra fields):
{
  "date": "YYYY-MM-DD",
  "kospi_close": <float>,
  "kospi_change_pct": <float>,
  "kosdaq_close": <float>,
  "kosdaq_change_pct": <float>,
  "foreign_net_buy_kospi": <float or null>,
  "foreign_net_buy_kosdaq": <float or null>,
  "usd_krw": <float>,
  "treasury_yield_3y": <float>,
  "wti_oil": <float>
}"""


# ── 게시판 파싱 ────────────────────────────────────────────────────────────────

def get_board_posts(http: requests.Session, page_count: int = 2) -> list[tuple[str, int]]:
    """
    게시판 목록 페이지(1~page_count)에서 NttId 추출.
    반환: [(ntt_id_str, ntt_num), ...] 최신순 정렬, 중복 제거.
    """
    seen: set[int] = set()
    result: list[tuple[str, int]] = []

    for page in range(1, page_count + 1):
        url = BOARD_URL + f'&pageIndex={page}&recordCountPerPage=20'
        try:
            r = http.get(url, timeout=15, verify=False)
        except Exception as e:
            logger.warning(f'게시판 페이지 {page} 요청 실패: {e}')
            break

        matches = re.findall(r'searchNttId1=(MOSF_(\d+))', r.text)
        if not matches:
            logger.info(f'페이지 {page}: NttId 없음 → 마지막 페이지')
            break

        new_on_page = 0
        for ntt_str, ntt_num_str in sorted(matches, key=lambda x: int(x[1]), reverse=True):
            ntt_num = int(ntt_num_str)
            if ntt_num not in seen:
                seen.add(ntt_num)
                result.append((ntt_str, ntt_num))
                new_on_page += 1

        logger.info(f'페이지 {page}: {new_on_page}개 게시물')

    result.sort(key=lambda x: x[1], reverse=True)  # 최신순
    return result


def get_atch_id(http: requests.Session, ntt_id_str: str) -> tuple[str, str] | None:
    """상세 페이지에서 (atchFileId, detail_url) 반환. 없으면 None."""
    detail_url = (
        f'{DETAIL_BASE}?bbsId={BBS_ID}'
        f'&searchNttId1={ntt_id_str}&menuNo=6010200'
    )
    try:
        r = http.get(detail_url, timeout=15, verify=False)
        m = re.search(r'atchFileId=(ATCH_\w+)', r.text)
        if m:
            return m.group(1), detail_url
    except Exception as e:
        logger.warning(f'{ntt_id_str} 상세 페이지 요청 실패: {e}')
    return None


# ── HWP 다운로드 ───────────────────────────────────────────────────────────────

def download_hwp(http: requests.Session, atch_id: str, detail_url: str) -> str | None:
    """HWP 임시파일 경로 반환. 실패 시 None."""
    http.headers.update({'Referer': detail_url})
    hwp_url = f'{BASE_URL}/com/cmm/fms/FileDown.do?atchFileId={atch_id}&fileSn=1'
    try:
        r = http.get(hwp_url, timeout=60, stream=True, verify=False)
        r.raise_for_status()
        tmp = tempfile.NamedTemporaryFile(suffix='.hwp', delete=False)
        for chunk in r.iter_content(chunk_size=8192):
            tmp.write(chunk)
        tmp.close()
        size_kb = Path(tmp.name).stat().st_size // 1024
        if size_kb < 10:
            logger.error(f'다운로드 파일 너무 작음 ({size_kb} KB)')
            Path(tmp.name).unlink(missing_ok=True)
            return None
        logger.info(f'HWP 다운로드: {size_kb} KB')
        return tmp.name
    except Exception as e:
        logger.error(f'HWP 다운로드 실패: {e}')
        return None


# ── CloudConvert HWP → PDF ──────────────────────────────────────────────────────

def hwp_to_pdf(hwp_path: str) -> str | None:
    """CloudConvert로 HWP→PDF 변환. 1 크레딧 소비. 실패 시 None."""
    logger.info(f'CloudConvert 변환 시작: {Path(hwp_path).name}')
    try:
        r = requests.post(
            'https://api.cloudconvert.com/v2/jobs',
            headers=CC_HEADERS,
            json={'tasks': {
                'upload-hwp':    {'operation': 'import/upload'},
                'convert-to-pdf': {'operation': 'convert', 'input': 'upload-hwp',
                                   'input_format': 'hwp', 'output_format': 'pdf'},
                'export-pdf':    {'operation': 'export/url', 'input': 'convert-to-pdf'},
            }},
            timeout=30,
        )
        r.raise_for_status()
        job   = r.json()['data']
        job_id = job['id']

        upload_task   = next(t for t in job['tasks'] if t['name'] == 'upload-hwp')
        upload_url    = upload_task['result']['form']['url']
        upload_params = upload_task['result']['form']['parameters']

        with open(hwp_path, 'rb') as f:
            files = {**{k: (None, v) for k, v in upload_params.items()}, 'file': f}
            requests.post(upload_url, files=files, timeout=60).raise_for_status()
        logger.info('업로드 완료, 변환 대기 중...')

        for attempt in range(24):
            time.sleep(5)
            st = requests.get(f'https://api.cloudconvert.com/v2/jobs/{job_id}',
                              headers=CC_HEADERS, timeout=15).json()['data']['status']
            logger.info(f'  변환 상태: {st} ({(attempt+1)*5}s)')
            if st == 'finished':
                break
            if st == 'error':
                logger.error('CloudConvert 변환 실패')
                return None

        tasks      = requests.get(f'https://api.cloudconvert.com/v2/jobs/{job_id}',
                                  headers=CC_HEADERS, timeout=15).json()['data']['tasks']
        export     = next((t for t in tasks if t['name'] == 'export-pdf'), None)
        if not export or not export.get('result', {}).get('files'):
            logger.error('export 결과 없음')
            return None

        pdf_r = requests.get(export['result']['files'][0]['url'], timeout=60, stream=True)
        pdf_r.raise_for_status()
        tmp = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
        for chunk in pdf_r.iter_content(chunk_size=8192):
            tmp.write(chunk)
        tmp.close()
        logger.info(f'PDF 변환 완료: {Path(tmp.name).stat().st_size // 1024} KB')
        return tmp.name

    except Exception as e:
        logger.error(f'CloudConvert 오류: {e}')
        return None


# ── Groq 지표 추출 ──────────────────────────────────────────────────────────────

def extract_indicators(pdf_path: str) -> dict | None:
    """PDF → Groq → 검증된 지표 dict. 실패 시 None."""
    try:
        text = ''
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text += (page.extract_text() or '') + '\n'
        if not text.strip():
            logger.error('PDF 텍스트 추출 실패')
            return None
        logger.info(f'PDF 텍스트: {len(text)}자')

        resp = groq_client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=[
                {'role': 'system', 'content': INDICATOR_SYSTEM_PROMPT},
                {'role': 'user',   'content': f'TEXT:\n{text[:4000]}'},
            ],
            temperature=0.1,
            max_completion_tokens=400,
            response_format={'type': 'json_object'},
        )
        data = json.loads(resp.choices[0].message.content)

        # 간단 검증
        if data.get('kospi_close') and not (1000 < data['kospi_close'] < 20000):
            logger.warning(f'kospi_close 이상값: {data["kospi_close"]}')
            return None
        if data.get('usd_krw') and not (900 < data['usd_krw'] < 2500):
            logger.warning(f'usd_krw 이상값: {data["usd_krw"]}')
            return None
        # 외국인 순매수 단위 보정 (100 미만이면 조원 → 억원)
        for key in ('foreign_net_buy_kospi', 'foreign_net_buy_kosdaq'):
            val = data.get(key)
            if val is not None and abs(val) < 100:
                data[key] = round(val * 10000, 0)
                logger.warning(f'{key} 단위 보정: {val} → {data[key]} 억원')

        return data

    except Exception as e:
        logger.error(f'지표 추출 실패: {e}')
        return None


# ── DB 저장 ────────────────────────────────────────────────────────────────────

def save_to_db(data: dict) -> bool:
    report_date = data.get('date') or date.today().isoformat()
    try:
        sb.table('daily_indicators').upsert({
            'date':                   report_date,
            'kospi_close':            data.get('kospi_close'),
            'kospi_change_pct':       data.get('kospi_change_pct'),
            'kosdaq_close':           data.get('kosdaq_close'),
            'kosdaq_change_pct':      data.get('kosdaq_change_pct'),
            'foreign_net_buy_kospi':  data.get('foreign_net_buy_kospi'),
            'foreign_net_buy_kosdaq': data.get('foreign_net_buy_kosdaq'),
            'usd_krw':                data.get('usd_krw'),
            'treasury_yield_3y':      data.get('treasury_yield_3y'),
            'wti_oil':                data.get('wti_oil'),
            'source':                 '기획재정부_일일경제지표',
        }, on_conflict='date').execute()
        logger.info(f'저장 완료: {report_date}')
        return True
    except Exception as e:
        logger.error(f'저장 실패: {e}')
        return False


# ── 크레딧 확인 ────────────────────────────────────────────────────────────────

def get_credits() -> int:
    try:
        r = requests.get('https://api.cloudconvert.com/v2/users/me',
                         headers=CC_HEADERS, timeout=10)
        return int(r.json().get('data', {}).get('credits', 0))
    except Exception as e:
        logger.warning(f'크레딧 확인 실패: {e}')
        return -1  # -1 = 확인 불가, 진행 허용


# ── 기존 DB 날짜 조회 ──────────────────────────────────────────────────────────

def get_existing_dates() -> set[str]:
    try:
        resp = sb.table('daily_indicators').select('date').execute()
        return {row['date'] for row in (resp.data or [])}
    except Exception as e:
        logger.warning(f'기존 날짜 조회 실패: {e}')
        return set()


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='재정경제부 일일경제지표 백필')
    parser.add_argument('--count',   type=int, default=10,
                        help='처리할 최대 건수 (기본 10, CloudConvert 크레딧 기준)')
    parser.add_argument('--dry-run', action='store_true',
                        help='DB 저장 없이 결과만 출력')
    parser.add_argument('--force',   action='store_true',
                        help='이미 DB에 있는 날짜도 덮어쓰기')
    args = parser.parse_args()

    logger.info('=' * 60)
    logger.info(f'재정경제부 일일경제지표 백필 (최대 {args.count}건)')
    logger.info(f'모드: {"DRY-RUN" if args.dry_run else "실제 저장"}  force={args.force}')
    logger.info('=' * 60)

    # CloudConvert 크레딧 확인
    credits = get_credits()
    if credits == 0:
        logger.error('CloudConvert 크레딧 없음. 중단.')
        sys.exit(1)
    if credits > 0:
        logger.info(f'CloudConvert 잔여 크레딧: {credits}')
        if credits < args.count:
            logger.warning(f'크레딧({credits}) < 요청 건수({args.count}) → {credits}건만 처리')
            args.count = credits
    else:
        logger.info('크레딧 확인 불가 — 진행 허용 (실제 변환 시 실패할 수 있음)')

    # DB 기존 날짜
    existing_dates: set[str] = set() if args.force else get_existing_dates()
    logger.info(f'DB 기존 데이터: {len(existing_dates)}일 (force={args.force})')

    # 게시판 목록 파싱 (count의 3배를 목표로 넉넉하게)
    logger.info('\n게시판 목록 파싱 중...')
    http = _make_mofe_session()
    try:
        http.get(BASE_URL, timeout=10, verify=False)  # 초기 쿠키 획득
    except Exception as e:
        logger.warning(f'초기 쿠키 획득 실패 (무시하고 계속): {e}')

    page_need = max(2, (args.count * 3) // 20 + 1)
    posts = get_board_posts(http, page_count=page_need)
    logger.info(f'게시판에서 총 {len(posts)}개 게시물 발견\n')

    if not posts:
        logger.error('게시판에서 게시물을 찾지 못했습니다.')
        sys.exit(1)

    # 결과 추적
    stats = {'saved': 0, 'dry_run': 0, 'skip_exists': 0,
             'skip_no_attach': 0, 'fail': 0}
    detail_rows: list[dict] = []
    cc_used = 0  # 실제 CloudConvert 크레딧 소비 수

    for ntt_id_str, ntt_num in posts:
        if cc_used >= args.count:
            logger.info(f'목표 건수 {args.count}건 도달 → 종료')
            break

        logger.info(f'─── {ntt_id_str} ───')

        # 상세 페이지 → atchFileId
        atch = get_atch_id(http, ntt_id_str)
        if not atch:
            logger.info('  첨부파일 없음 (공휴일/공지 등), 스킵')
            stats['skip_no_attach'] += 1
            detail_rows.append({'ntt': ntt_id_str, 'date': '-', 'status': '⏭  첨부없음'})
            continue

        atch_id, detail_url = atch

        # HWP 다운로드
        hwp_path = download_hwp(http, atch_id, detail_url)
        if not hwp_path:
            stats['fail'] += 1
            detail_rows.append({'ntt': ntt_id_str, 'date': '-', 'status': '❌ HWP 다운 실패'})
            continue

        cleanup = [hwp_path]
        try:
            # HWP → PDF (1 크레딧)
            pdf_path = hwp_to_pdf(hwp_path)
            cc_used += 1  # 크레딧 소비 카운트 (성공/실패 무관)
            if not pdf_path:
                stats['fail'] += 1
                detail_rows.append({'ntt': ntt_id_str, 'date': '-', 'status': '❌ CC 변환 실패'})
                continue
            cleanup.append(pdf_path)

            # Groq 추출
            indicators = extract_indicators(pdf_path)
            if not indicators:
                stats['fail'] += 1
                detail_rows.append({'ntt': ntt_id_str, 'date': '-', 'status': '❌ 지표 추출 실패'})
                continue

            report_date = indicators.get('date', '?')
            logger.info(
                f'  날짜: {report_date} | '
                f'KOSPI: {indicators.get("kospi_close")} ({indicators.get("kospi_change_pct"):+}%) | '
                f'USD/KRW: {indicators.get("usd_krw")} | '
                f'외국인: {indicators.get("foreign_net_buy_kospi")} 억원'
            )

            # 이미 있는 날짜 체크
            if not args.force and report_date in existing_dates:
                logger.info(f'  → {report_date} 이미 DB 존재, 스킵')
                stats['skip_exists'] += 1
                detail_rows.append({'ntt': ntt_id_str, 'date': report_date, 'status': '⏭  이미존재'})
                continue

            if args.dry_run:
                logger.info('  → [DRY-RUN] 저장 건너뜀')
                stats['dry_run'] += 1
                detail_rows.append({'ntt': ntt_id_str, 'date': report_date, 'status': '🔵 DRY-RUN'})
            else:
                ok = save_to_db(indicators)
                if ok:
                    existing_dates.add(report_date)
                    stats['saved'] += 1
                    detail_rows.append({'ntt': ntt_id_str, 'date': report_date, 'status': '✅ 저장됨'})
                else:
                    stats['fail'] += 1
                    detail_rows.append({'ntt': ntt_id_str, 'date': report_date, 'status': '❌ DB 저장 실패'})

        finally:
            for f in cleanup:
                try:
                    Path(f).unlink(missing_ok=True)
                except Exception:
                    pass

        # 연속 호출 간 짧은 대기 (mofe.go.kr 부하 방지)
        time.sleep(1)

    # ── 결과 요약 ─────────────────────────────────────────────────────────────
    logger.info('\n' + '=' * 60)
    logger.info('결과 요약')
    logger.info('=' * 60)
    for row in detail_rows:
        logger.info(f"  {row['ntt']}  {row['date']:12s}  {row['status']}")

    logger.info('')
    logger.info(f"  ✅ 저장: {stats['saved']}건")
    if args.dry_run:
        logger.info(f"  🔵 DRY-RUN (미저장): {stats['dry_run']}건")
    logger.info(f"  ⏭  스킵(이미존재): {stats['skip_exists']}건")
    logger.info(f"  ⏭  스킵(첨부없음): {stats['skip_no_attach']}건")
    logger.info(f"  ❌ 실패: {stats['fail']}건")
    logger.info(f"  CloudConvert 크레딧 소비: {cc_used}건")


if __name__ == '__main__':
    main()
