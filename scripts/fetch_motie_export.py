"""
산업통상자원부 수출입 동향 PDF → Groq 분석 → sector_macro DB 저장

실행: python scripts/fetch_motie_export.py
      python scripts/fetch_motie_export.py --url https://... (특정 게시물 지정)
      python scripts/fetch_motie_export.py --pdf trade_report.pdf (로컬 PDF 지정)

출처: 산업통상자원부 (www.motir.go.kr)
사용 방침: 원문 재배포 ❌  /  수치 추출 후 지표화 ⭕
"""

import os
import re
import json
import time
import logging
import tempfile
from datetime import datetime, date
from pathlib import Path

import requests
import pdfplumber
from groq import Groq
from dotenv import load_dotenv
from supabase import create_client

# ── 환경변수 ─────────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent.parent / 'frontend' / '.env.local', override=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

supabase = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY'],
)
groq_client = Groq(api_key=os.environ['GROQ_API_KEY'])

BASE_URL   = 'https://www.motir.go.kr'
BOARD_ID   = 'ATCL3f49a5a8c'   # 수출입 동향 게시판 고정 ID
SEARCH_URL = (
    f'{BASE_URL}/kor/search'
    '?site=main'
    '&kwd=%EC%88%98%EC%B6%9C%EC%9E%85+%EB%8F%99%ED%96%A5'
    '&ppkFlag=weekly&rowPerPage=10&currentPage=1'
)
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': BASE_URL,
}

# 공유 세션 (쿠키 유지)
http_session = requests.Session()
http_session.headers.update(HEADERS)

# ── 섹션 분할 기준 키워드 ────────────────────────────────────────────────────
SECTOR_KEYWORDS = [
    '반도체', '자동차', '석유제품', '이차전지', '철강',
    '디스플레이', '바이오', '의약', 'ICT', '선박',
    '기계', '섬유', '화장품', '농수산', '석유화학',
]

# ── 8대 대분류 매핑 (Groq 추출 결과 → 표준 섹터) ───────────────────────────
MACRO_SECTOR_MAP: dict[str, str] = {
    # Semiconductor
    'Semiconductor':          'Semiconductor',
    'Display':                'Semiconductor',
    'LCD':                    'Semiconductor',
    'Electronic Components':  'Semiconductor',
    'IT Software':            'Semiconductor',
    'Wireless':               'Semiconductor',
    'Computer':               'Semiconductor',
    'Industrial Electronics': 'Semiconductor',
    # Battery
    'Battery':                'Battery',
    'Secondary Battery':      'Battery',
    # Automotive
    'Automotive':             'Automotive',
    'Passenger Car':          'Automotive',
    'Passenger Cars':         'Automotive',
    'Transportation Machinery':'Automotive',
    # Energy
    'Petroleum':              'Energy',
    'Oil':                    'Energy',
    'LNG':                    'Energy',
    'Gas':                    'Energy',
    'Energy':                 'Energy',
    'Petroleum Chemicals':    'Energy',
    # Biotech
    'Biotech':                'Biotech',
    'Bio':                    'Biotech',
    'Pharmaceutical':         'Biotech',
    'Healthcare':             'Biotech',
    'Medical':                'Biotech',
    # Finance
    'Finance':                'Finance',
    'Insurance':              'Finance',
    # Consumer
    'Consumer':               'Consumer',
    'Food':                   'Consumer',
    'Cosmetics':              'Consumer',
    'Apparel':                'Consumer',
    'Textile':                'Consumer',
    'Textiles':               'Consumer',
    'Home Appliances':        'Consumer',
    'Home Electronics':       'Consumer',
    'Living Goods':           'Consumer',
    # Industrial
    'Steel':                  'Industrial',
    'Iron':                   'Industrial',
    'Machinery':              'Industrial',
    'Shipbuilding':           'Industrial',
    'Ship':                   'Industrial',
    'Chemical':               'Industrial',
    'Plastics':               'Industrial',
    'Non-Ferrous':            'Industrial',
    'Metal':                  'Industrial',
}

# 지역/국가명 필터 (섹터가 아닌 항목 제거)
REGION_KEYWORDS = [
    'Asia', 'Europe', 'America', 'Africa', 'China', 'Japan', 'USA',
    'Hong Kong', 'Singapore', 'Indonesia', 'Vietnam', 'India',
    'Advanced Countries', 'Developing Countries', 'Middle East',
    'ASEAN', 'EU', 'OPEC',
]


def map_to_macro_sector(sector_name: str) -> str | None:
    """추출된 섹터명을 8대 대분류로 매핑. 지역명이면 None 반환."""
    # 지역/국가명 제거
    for region in REGION_KEYWORDS:
        if region.lower() in sector_name.lower():
            return None
    # 매핑 테이블에서 찾기
    for keyword, macro in MACRO_SECTOR_MAP.items():
        if keyword.lower() in sector_name.lower():
            return macro
    return 'Industrial'  # 매핑 안 되면 Industrial로


def consolidate_to_macro(records: list[dict]) -> list[dict]:
    """세부 섹터 결과를 8대 대분류로 집계 (YoY 평균, signal 다수결)"""
    from collections import defaultdict

    buckets: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        macro = map_to_macro_sector(r.get('sector', ''))
        if macro:
            buckets[macro].append(r)

    consolidated = []
    for macro, items in buckets.items():
        yoy_vals = [i['export_yoy'] for i in items if i.get('export_yoy') is not None]
        avg_yoy = round(sum(yoy_vals) / len(yoy_vals), 1) if yoy_vals else None

        signals = [i.get('signal', 'neutral') for i in items]
        signal = max(set(signals), key=signals.count)  # 다수결

        consolidated.append({
            'sector':       macro,
            'export_yoy':   avg_yoy,
            'signal':       signal,
            'sub_count':    len(items),
        })

    consolidated.sort(key=lambda x: x['sector'])
    return consolidated


# ── STEP 1: 게시물 URL 탐색 ──────────────────────────────────────────────────
def find_latest_article_url() -> str | None:
    try:
        resp = http_session.get(SEARCH_URL, timeout=15)
        resp.raise_for_status()
        pattern = rf'/kor/article/{BOARD_ID}/(\d+)/view'
        ids = re.findall(pattern, resp.text)
        if not ids:
            logger.error('게시물 URL 패턴 미발견')
            return None
        latest = max(ids, key=int)
        url = f'{BASE_URL}/kor/article/{BOARD_ID}/{latest}/view'
        logger.info(f'최신 게시물: {url}')
        return url
    except Exception as e:
        logger.error(f'게시물 목록 조회 실패: {e}')
        return None


# ── STEP 2: PDF 링크 추출 ────────────────────────────────────────────────────
def find_pdf_url(article_url: str) -> str | None:
    try:
        # 게시물 페이지 방문 → 세션 쿠키 획득 (다운로드 인증에 필요)
        resp = http_session.get(article_url, timeout=15)
        resp.raise_for_status()
        http_session.headers.update({'Referer': article_url})

        pattern = r'/attach/down/[a-f0-9]{32}/[a-f0-9]{32}/[a-f0-9]{32}'
        links = re.findall(pattern, resp.text)
        if not links:
            logger.error('첨부파일 링크 미발견')
            return None
        # .pdf 확장자 근처에 있는 링크 우선
        text = resp.text
        for link in links:
            idx = text.find(link)
            if '.pdf' in text[max(0, idx - 50):idx + 100].lower():
                return f'{BASE_URL}{link}'
        return f'{BASE_URL}{links[0]}'
    except Exception as e:
        logger.error(f'PDF 링크 추출 실패: {e}')
        return None


# ── STEP 3: PDF 다운로드 ─────────────────────────────────────────────────────
def download_pdf(pdf_url: str) -> str | None:
    try:
        resp = http_session.get(pdf_url, timeout=60, stream=True)
        resp.raise_for_status()
        tmp = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
        for chunk in resp.iter_content(chunk_size=8192):
            tmp.write(chunk)
        tmp.close()
        size_kb = Path(tmp.name).stat().st_size // 1024
        logger.info(f'PDF 다운로드 완료: {size_kb} KB → {tmp.name}')
        return tmp.name
    except Exception as e:
        logger.error(f'PDF 다운로드 실패: {e}')
        return None


# ── STEP 4: 텍스트 추출 ──────────────────────────────────────────────────────
def extract_text(pdf_path: str) -> str:
    full_text = ''
    with pdfplumber.open(pdf_path) as pdf:
        logger.info(f'PDF 총 {len(pdf.pages)}페이지')
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + '\n'
    return full_text


# ── STEP 5: 섹션 분할 ────────────────────────────────────────────────────────
def split_sections(text: str) -> list[str]:
    """섹터 키워드 기준으로 텍스트를 섹션으로 분리"""
    sections: list[str] = []
    current = ''
    for line in text.split('\n'):
        if any(k in line for k in SECTOR_KEYWORDS):
            if current.strip():
                sections.append(current)
            current = ''
        current += line + '\n'
    if current.strip():
        sections.append(current)

    # 너무 짧은 섹션(50자 미만) 제거
    sections = [s for s in sections if len(s.strip()) >= 50]
    logger.info(f'섹션 분할: {len(sections)}개')
    return sections


# ── STEP 6: Groq 분석 프롬프트 ───────────────────────────────────────────────
SYSTEM_PROMPT = """You are a financial data extraction engine for Korean trade statistics.

STRICT RULES:
1. Extract ONLY factual numeric data — do NOT summarize
2. Do NOT omit numbers
3. Return valid JSON only — no markdown, no explanation
4. If a field is unavailable, use null

OUTPUT FORMAT (JSON array, one object per sector found):
[
  {
    "sector": "<English sector name>",
    "export_yoy": <float, YoY change %>  or null,
    "export_value": <integer, export amount in 100M USD> or null,
    "signal": "positive" | "neutral" | "negative"
  }
]

signal rules:
- positive : export_yoy > 5%  or clear growth language
- negative : export_yoy < -5% or clear decline language
- neutral  : otherwise"""


def analyze_section(text: str) -> list[dict]:
    """Groq로 섹션 텍스트에서 섹터 데이터 추출"""
    try:
        response = groq_client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=[
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': f'TEXT:\n{text[:3000]}'},
            ],
            temperature=0.2,
            max_completion_tokens=500,
            response_format={'type': 'json_object'},
        )
        raw = response.choices[0].message.content
        parsed = json.loads(raw)

        # 응답이 배열 or {"data": [...]} 형태 모두 처리
        if isinstance(parsed, list):
            return parsed
        for key in ('data', 'sectors', 'results'):
            if isinstance(parsed.get(key), list):
                return parsed[key]
        # 단일 객체인 경우
        if 'sector' in parsed:
            return [parsed]
        return []

    except Exception as e:
        logger.warning(f'Groq 분석 실패 (섹션 건너뜀): {e}')
        return []


# ── STEP 7: Supabase 저장 ────────────────────────────────────────────────────
def save_to_db(records: list[dict], report_date: date) -> int:
    saved = 0
    for row in records:
        sector = row.get('sector')
        if not sector:
            continue
        try:
            supabase.table('sector_macro').upsert({
                'sector':       sector,
                'report_date':  report_date.isoformat(),
                'export_yoy':   row.get('export_yoy'),
                'export_value': row.get('export_value'),
                'signal':       row.get('signal', 'neutral'),
                'source':       '산업통상자원부_수출입동향',
                'updated_at':   datetime.now().isoformat(),
            }, on_conflict='sector,report_date').execute()
            saved += 1
        except Exception as e:
            logger.warning(f"저장 실패 ({sector}): {e}")
    return saved


# ── 메인 실행 ────────────────────────────────────────────────────────────────
def run(target_url: str | None = None, local_pdf: str | None = None,
        dry_run: bool = False):
    logger.info('=== 산업통상자원부 수출입 동향 파이프라인 시작 ===')

    # PDF 경로 확보
    pdf_path = None
    cleanup = False

    if local_pdf:
        pdf_path = local_pdf
        logger.info(f'로컬 PDF 사용: {pdf_path}')
    else:
        article_url = target_url or find_latest_article_url()
        if not article_url:
            logger.error('게시물 URL 확보 실패')
            return
        pdf_url = find_pdf_url(article_url)
        if not pdf_url:
            logger.error('PDF URL 확보 실패')
            return
        pdf_path = download_pdf(pdf_url)
        cleanup = True

    if not pdf_path:
        logger.error('PDF 경로 없음')
        return

    try:
        # 발표 월 계산 (이번 달 발표 = 전달 실적)
        today = date.today()
        report_month = today.month - 1 if today.month > 1 else 12
        report_year  = today.year if today.month > 1 else today.year - 1
        report_date  = date(report_year, report_month, 1)
        logger.info(f'리포트 기준월: {report_date}')

        # 텍스트 추출 → 섹션 분할
        text     = extract_text(pdf_path)
        sections = split_sections(text)

        if not sections:
            logger.error('섹션 분할 결과 없음')
            return

        # Groq 분석
        all_results: list[dict] = []
        for i, section in enumerate(sections):
            logger.info(f'[{i+1}/{len(sections)}] Groq 분석 중...')
            results = analyze_section(section)
            all_results.extend(results)
            time.sleep(1.0)  # rate limit 방지

        # 중복 섹터 제거 (첫 번째 우선)
        seen: set[str] = set()
        unique: list[dict] = []
        for r in all_results:
            s = r.get('sector', '')
            if s and s not in seen:
                seen.add(s)
                unique.append(r)

        logger.info(f'추출 결과: {len(unique)}개 세부 섹터')

        # 8대 대분류로 집계
        macro_results = consolidate_to_macro(unique)
        logger.info(f'\n=== 8대 대분류 집계 결과 ({report_date}) ===')
        for r in macro_results:
            yoy = r.get('export_yoy')
            yoy_str = f"{yoy:+.1f}%" if yoy is not None else 'N/A'
            logger.info(f"  {r['sector']:15s} | YoY: {yoy_str:10s} | Signal: {r['signal']:8s} | 세부 {r['sub_count']}개")

        if dry_run:
            logger.info('[DRY-RUN] DB 저장 건너뜀')
            return

        saved = save_to_db(macro_results, report_date)
        logger.info(f'Supabase 저장 완료: {saved}/{len(unique)}건')
        logger.info('=== 완료 ===')

    finally:
        if cleanup and pdf_path:
            try:
                Path(pdf_path).unlink()
            except Exception:
                pass


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='산업통상자원부 수출입 동향 수집')
    parser.add_argument('--url',     type=str, default=None, help='특정 게시물 URL')
    parser.add_argument('--pdf',     type=str, default=None, help='로컬 PDF 파일 경로')
    parser.add_argument('--dry-run', action='store_true',    help='DB 저장 없이 결과만 출력')
    args = parser.parse_args()
    run(target_url=args.url, local_pdf=args.pdf, dry_run=args.dry_run)
