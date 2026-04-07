"""
content가 비어있는(None/빈문자열) 완료 공시의 본문을 재수집해
analysis_status를 pending으로 되돌려 재분석 대기열에 넣는 스크립트.

사용법:
  python refetch_empty_content.py           # content=0인 completed 공시 재수집
  python refetch_empty_content.py --dry-run # 대상 목록만 출력
  python refetch_empty_content.py --limit 50
"""
import os, sys, re, zipfile, io, time, argparse, logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

for line in open(os.path.join(os.path.dirname(__file__), '../frontend/.env.local'), encoding='utf-8'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import requests, urllib3
urllib3.disable_warnings()
from supabase import create_client

sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
DART_KEY = os.environ['DART_API_KEY']

session = requests.Session()
session.verify = False
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/zip,*/*;q=0.8',
    'Referer': 'https://opendart.fss.or.kr',
})


_IMPORTANT_KEYWORDS = [
    "매출", "영업이익", "당기순이익", "순이익",
    "계약", "금액", "발행", "증자", "취득", "처분",
    "손실", "감소", "증가", "%", "억원", "백만원", "KRW",
    "보증", "채무", "주식수", "주당", "전환가",
    "수주", "납품", "공급", "투자", "배당", "자본금",
]

def extract_key_sections(text: str) -> str:
    """키워드 포함 줄 + 마크다운 테이블/헤딩만 추출 (truncate 금지)"""
    if not text:
        return text
    lines = text.split("\n")
    filtered = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if any(k in stripped for k in _IMPORTANT_KEYWORDS):
            filtered.append(stripped)
        elif stripped.startswith("|") or stripped.startswith("##"):
            filtered.append(stripped)
    result = "\n".join(filtered[:300])
    if len(result) < 200 and len(text) > 200:
        return text[:6000]
    return result


def _clean_html_to_md(raw_html: str) -> str:
    """HTML → 투자 분석용 마크다운 텍스트"""
    clean = re.sub(r'<(script|style|head)[^>]*>.*?</\1>', '', raw_html, flags=re.DOTALL | re.IGNORECASE)

    def table_to_md(html):
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, flags=re.DOTALL | re.IGNORECASE)
        md_rows = []
        for row in rows:
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, flags=re.DOTALL | re.IGNORECASE)
            cells = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
            cells = [re.sub(r'\s+', ' ', c) for c in cells if c]
            if cells:
                md_rows.append('| ' + ' | '.join(cells) + ' |')
        return '\n'.join(md_rows)

    clean = re.sub(r'<table[^>]*>(.*?)</table>', lambda m: '\n' + table_to_md(m.group(0)) + '\n', clean, flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r'<h[1-3][^>]*>(.*?)</h[1-3]>', lambda m: '\n## ' + re.sub(r'<[^>]+>', '', m.group(1)).strip() + '\n', clean, flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r'<br\s*/?>', '\n', clean, flags=re.IGNORECASE)
    clean = re.sub(r'</p>', '\n', clean, flags=re.IGNORECASE)
    clean = re.sub(r'<[^>]+>', ' ', clean)
    clean = clean.replace('\x00', '').replace('\u0000', '')
    clean = re.sub(r'[ \t]+', ' ', clean)
    clean = re.sub(r'\n{3,}', '\n\n', clean)
    return clean.strip()


def fetch_content(rcept_no: str) -> str | None:
    url = f'https://opendart.fss.or.kr/api/document.xml?crtfc_key={DART_KEY}&rcept_no={rcept_no}'
    try:
        resp = session.get(url, timeout=30)
        if resp.status_code != 200:
            return None

        if resp.content[:4] == b'PK\x03\x04':
            with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
                with z.open(z.namelist()[0]) as f:
                    raw_bytes = f.read()
            raw = raw_bytes.decode('utf-8', errors='ignore')
            text = _clean_html_to_md(raw)
            korean = len(re.findall(r'[\uAC00-\uD7A3]', text))
            logger.info(f"  ZIP OK: {len(text)}자, 한글 {korean}자")
            return extract_key_sections(text) if len(text) > 0 else None

        # XML 오류 응답
        status_match = re.search(r'<status>(\d+)</status>', resp.text)
        status = status_match.group(1) if status_match else '?'
        logger.warning(f"  DART 오류 status={status}")
        return None

    except Exception as e:
        logger.warning(f"  수집 실패: {e}")
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--limit', type=int, default=500)
    parser.add_argument('--days', type=int, default=None, help='최근 N일 공시만 대상 (rcept_dt 기준)')
    args = parser.parse_args()

    # content가 비어있는 completed 공시 조회
    query = sb.table('disclosure_insights') \
        .select('id,rcept_no,corp_name,report_nm') \
        .eq('analysis_status', 'completed') \
        .eq('is_visible', True) \
        .or_('content.is.null,content.eq.')

    if args.days:
        from datetime import datetime, timedelta
        since = (datetime.now() - timedelta(days=args.days)).strftime('%Y%m%d')
        query = query.gte('rcept_dt', since)
        logger.info(f"rcept_dt 필터: {since} 이후")

    # 투자 시그널 없는 공시 제외
    SKIP_TYPES = ['감사보고서', '효력발생', 'IR공고', '기업설명회', '증권발행실적']
    for skip in SKIP_TYPES:
        query = query.not_.ilike('report_nm', f'%{skip}%')

    r = query.order('rcept_dt', desc=True).limit(args.limit).execute()

    items = r.data
    logger.info(f"대상: {len(items)}개")

    if args.dry_run:
        for d in items:
            print(f"  {d['corp_name']:15} | {(d['report_nm'] or '').strip()[:35]} | {d['rcept_no']}")
        return

    ok, fail = 0, 0
    for i, d in enumerate(items, 1):
        rcept_no = d['rcept_no']
        logger.info(f"[{i}/{len(items)}] {d['corp_name']} | {(d['report_nm'] or '').strip()[:30]}")

        time.sleep(2)
        content = fetch_content(rcept_no)

        if content:
            sb.table('disclosure_insights').update({
                'content': content,
                'analysis_status': 'pending',  # 재분석 대기열
                'updated_at': datetime.now().isoformat(),
            }).eq('id', d['id']).execute()
            logger.info(f"  ✅ 업데이트 완료 → pending")
            ok += 1
        else:
            fail += 1
            logger.warning(f"  ❌ 본문 없음 (스킵)")

    logger.info(f"\n완료: 성공 {ok}개, 실패 {fail}개")
    logger.info("auto_analyst.py를 실행해 재분석 처리하세요.")


if __name__ == '__main__':
    main()
