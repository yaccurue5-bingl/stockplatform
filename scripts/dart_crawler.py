import asyncio
import argparse
import os
import sys
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import time
from datetime import datetime, timedelta, date as date_type
from pathlib import Path
from supabase import create_client, Client
import urllib3
import logging
import hashlib
import re
import zipfile
import io
import xml.etree.ElementTree as ET

# ── env 로드 (backfill 실행 시 .env.local 자동 인식) ──────────────────────────
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
try:
    from utils.env_loader import load_env
    load_env()
except Exception:
    pass

# SSL 경고 비활성화
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# DART API 세션 (연결 재사용 + 헤더 + HTTP 레벨 재시도)
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/zip,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://opendart.fss.or.kr",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
})
session.verify = False

# HTTP 레벨 자동 재시도 (503/502 등 서버 에러 시)
retry_strategy = Retry(
    total=2,
    backoff_factor=2,
    status_forcelist=[429, 500, 502, 503, 504],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("https://", adapter)
session.mount("http://", adapter)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") # URL 환경변수 사용 권장
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# ── 노이즈 필터 ───────────────────────────────────────────────────────────────
# 투자 시그널 가치가 낮은 공시 유형 — Groq 토큰 낭비 방지
_NOISE_KEYWORDS = [
    "주주총회소집공고", "주주총회결과", "투자설명서",
    "기업설명회", "증권발행실적보고서", "의결권대리행사권유", "소액공모",
    "주주명부폐쇄기준일", "배당기준일", "명의개서정지",
    "사외이사의선임", "사외이사의해임", "사외이사의중도퇴임",
    # "임원의변동"    ← 제거: CEO 취임/외부영입은 핵심 재료 — is_executive_noise()로 2차 필터링
    # "대표이사의변동" ← 제거: CEO 변동은 핵심 재료
]

# 종목명 필터 — 스팩/펀드/부동산리츠 등 투자 시그널 무의미 종목 제외
_NOISE_CORP_KEYWORDS = [
    "전문유한회사", "부동산투자회사", "스팩", "자산운용", "자산운영", "펀드",
    "기업인수목적", "투자증권", "투자자문",
]

def is_noise_disclosure(report_nm: str) -> bool:
    t = (report_nm or "").lower()
    return any(kw.lower() in t for kw in _NOISE_KEYWORDS)


# ── 임원 변동 2차 필터 ────────────────────────────────────────────────────────
# "임원의변동" / "대표이사의변동" 공시 중 사외이사·감사만 언급 → 노이즈
# CEO / C-Level 포함 공시 → 신호로 통과

_EXEC_SIGNAL_KEYWORDS = [
    "대표이사", "CEO", "사장", "부사장",
    "CFO", "COO", "CTO", "CSO", "CCO",
    "전무이사", "전무", "상무이사", "상무",
]
_EXEC_CHANGE_REPORT_NMS = ("임원의변동", "대표이사의변동")

def is_executive_noise(report_nm: str, content: str = "") -> bool:
    """
    임원 변동 공시 중 CEO/C-Level 신호가 없는 경우 True(노이즈) 반환.
    - report_nm이 임원변동 계열이 아니면 False (해당 없음)
    - 본문 없으면 일단 통과(False) — 내용 확인 불가
    - CEO/C-Level 키워드 존재 → False (신호, 통과)
    - 없으면 True (사외이사/감사만 → 노이즈)
    """
    if not any(nm in (report_nm or "") for nm in _EXEC_CHANGE_REPORT_NMS):
        return False
    if not content:
        return False
    return not any(kw in content for kw in _EXEC_SIGNAL_KEYWORDS)


def is_noise_corp(corp_name: str) -> bool:
    t = (corp_name or "").lower()
    return any(kw.lower() in t for kw in _NOISE_CORP_KEYWORDS)


# ── 핵심 섹션 추출 (truncate 대신 사용) ──────────────────────────────────────
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
    # 키워드 매칭 결과가 너무 적으면 원본 앞부분 fallback
    if len(result) < 200 and len(text) > 200:
        return text[:6000]
    return result

def generate_hash_key(corp_code: str, rcept_no: str) -> str:
    """공시 hash key 생성"""
    return hashlib.sha256(f"{corp_code}_{rcept_no}".encode()).hexdigest()

def is_disclosure_processed(corp_code: str, rcept_no: str) -> bool:
    """이미 처리된 공시인지 확인"""
    try:
        hash_key = generate_hash_key(corp_code, rcept_no)
        result = supabase.table("disclosure_hashes") \
            .select("id") \
            .eq("hash_key", hash_key) \
            .gt("expires_at", datetime.now().isoformat()) \
            .execute()
        return len(result.data) > 0
    except Exception as e:
        logger.warning(f"해시 확인 실패 (처리 진행): {e}")
        return False

def _clean_html_text(raw_html):
    """HTML → 투자 분석용 마크다운 텍스트 변환

    테이블은 | 구분자로, 제목은 ## 으로 변환해 AI가 구조를 파악하기 쉽게 처리.
    script/style 블록 제거 후 의미 있는 텍스트만 추출.
    """
    # 1) script/style/head 블록 전체 제거
    clean = re.sub(r'<(script|style|head)[^>]*>.*?</\1>', '', raw_html, flags=re.DOTALL | re.IGNORECASE)

    # 2) 테이블 → 마크다운 변환 (tr/td/th 구조)
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

    # 테이블 블록을 MD로 교체
    clean = re.sub(
        r'<table[^>]*>(.*?)</table>',
        lambda m: '\n' + table_to_md(m.group(0)) + '\n',
        clean, flags=re.DOTALL | re.IGNORECASE
    )

    # 3) 제목 태그 → ## 마크다운
    clean = re.sub(r'<h[1-3][^>]*>(.*?)</h[1-3]>', lambda m: '\n## ' + re.sub(r'<[^>]+>', '', m.group(1)).strip() + '\n', clean, flags=re.DOTALL | re.IGNORECASE)

    # 4) <br> / <p> → 줄바꿈
    clean = re.sub(r'<br\s*/?>', '\n', clean, flags=re.IGNORECASE)
    clean = re.sub(r'</p>', '\n', clean, flags=re.IGNORECASE)

    # 5) 나머지 HTML 태그 제거
    clean = re.sub(r'<[^>]+>', ' ', clean)

    # 6) null 바이트 제거
    clean = clean.replace('\x00', '').replace('\u0000', '')

    # 7) 과도한 공백/줄바꿈 정리
    clean = re.sub(r'[ \t]+', ' ', clean)
    clean = re.sub(r'\n{3,}', '\n\n', clean)
    clean = clean.strip()

    return clean


def _fetch_from_viewer(rcept_no):
    """document.xml 014 시 DART 웹 뷰어에서 본문 직접 스크래핑 (폴백)"""
    try:
        # 1단계: 메인 페이지 접근 (DART 뷰어 파라미터명은 rcpNo)
        main_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"
        resp = session.get(main_url, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"{rcept_no} 뷰어 메인 접근 실패: HTTP {resp.status_code}")
            return None

        # dcmNo 추출 (여러 패턴 시도)
        dcm_match = (
            re.search(r"dcmNo['\"]?\s*[=:]\s*['\"]?(\d+)", resp.text) or
            re.search(r"dcm_no[=:](\d+)", resp.text, re.IGNORECASE) or
            re.search(r"viewer\.do[^'\"]*dcm_no=(\d+)", resp.text, re.IGNORECASE)
        )

        if not dcm_match:
            logger.warning(f"{rcept_no} dcmNo 추출 실패 - 메인 페이지 텍스트 시도")
            text = _clean_html_text(resp.text)
            if len(text) > 100:
                return extract_key_sections(text)
            return None

        dcm_no = dcm_match.group(1)

        # 2단계: 뷰어 페이지에서 본문 가져오기
        time.sleep(1.5)
        viewer_url = (
            f"https://dart.fss.or.kr/report/viewer.do"
            f"?rcept_no={rcept_no}&dcm_no={dcm_no}"
            f"&eleId=0&offset=0&length=0&dtd=dart3.xsd"
        )
        resp2 = session.get(viewer_url, timeout=15)
        if resp2.status_code != 200:
            logger.warning(f"{rcept_no} 뷰어 본문 접근 실패: HTTP {resp2.status_code}")
            return None

        text = _clean_html_text(resp2.text)
        if len(text) > 100:
            logger.info(f"{rcept_no} 뷰어 폴백 성공 ({len(text)}자)")
            return extract_key_sections(text)

        return None

    except Exception as e:
        logger.warning(f"{rcept_no} 뷰어 폴백 실패: {e}")
        return None


def get_clean_content(rcept_no, max_retries=2):
    """본문 수집: document.xml 우선 → 014 시 뷰어 폴백"""
    dart_key = os.environ.get("DART_API_KEY")
    if not dart_key:
        logger.error("DART_API_KEY가 설정되지 않았습니다.")
        return None

    content_url = f"https://opendart.fss.or.kr/api/document.xml?crtfc_key={dart_key}&rcept_no={rcept_no}"

    for attempt in range(1, max_retries + 1):
        time.sleep(3.0)

        try:
            response = session.get(content_url, timeout=30)

            if response.status_code == 200:
                # 정상 ZIP 응답
                if response.content.startswith(b'PK'):
                    try:
                        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                            xml_name = z.namelist()[0]
                            with z.open(xml_name) as f:
                                raw_bytes = f.read()
                        # XML 선언부에서 인코딩 감지 (EUC-KR / UTF-8 등)
                        enc_match = re.search(rb'encoding=["\']([^"\']+)["\']', raw_bytes[:500])
                        encoding = enc_match.group(1).decode('ascii').lower() if enc_match else 'utf-8'
                        if encoding in ('euc-kr', 'ks_c_5601-1987', 'ms949', 'cp949'):
                            encoding = 'euc-kr'
                        raw_text = raw_bytes.decode(encoding, errors='ignore')
                        text = _clean_html_text(raw_text)
                        logger.info(f"{rcept_no} ZIP 추출 성공 (인코딩: {encoding}, {len(text)}자)")
                        return extract_key_sections(text)
                    except Exception as zip_err:
                        logger.error(f"ZIP 처리 중 오류 ({rcept_no}): {zip_err}")
                        return "CONTENT_NOT_AVAILABLE"

                # DART 에러 XML 응답
                dart_status, dart_message = None, None
                if "<?xml" in response.text:
                    try:
                        root = ET.fromstring(response.text)
                        dart_status = root.find('status').text if root.find('status') is not None else None
                        dart_message = root.find('message').text if root.find('message') is not None else None
                    except Exception:
                        pass

                # 014: 파일 미존재 → 재시도 없이 즉시 뷰어 폴백
                if dart_status == "014":
                    logger.info(f"{rcept_no} document.xml 없음(014) -> 뷰어 스크래핑 폴백 시도")
                    return _fetch_from_viewer(rcept_no) # ✅ 단순히 마킹하지 말고 바로 스크래핑 함수 호출
                    
                    #return "CONTENT_NOT_AVAILABLE"

                # 020: 요청 제한 초과 → 재시도
                if dart_status == "020" and attempt < max_retries:
                    wait_time = 5.0 * attempt
                    logger.warning(f"[시도 {attempt}/{max_retries}] {rcept_no} 요청 제한(020) -> {wait_time}초 후 재시도")
                    time.sleep(wait_time)
                    continue

                logger.warning(f"{rcept_no} 수집 불가 - DART [상태: {dart_status}] [메시지: {dart_message}]")
                return "CONTENT_NOT_AVAILABLE"

        except requests.exceptions.ConnectionError as e:
            if attempt < max_retries:
                wait_time = 5.0 * attempt
                logger.warning(f"[시도 {attempt}/{max_retries}] {rcept_no} 연결 오류 -> {wait_time}초 후 재시도")
                time.sleep(wait_time)
                continue
            logger.warning(f"본문 수집 중 연결 오류 ({rcept_no}): {e}")
            return "CONTENT_NOT_AVAILABLE"
        except Exception as e:
            logger.warning(f"본문 수집 중 시스템 에러 ({rcept_no}): {e}")
            return "CONTENT_NOT_AVAILABLE"

    return "CONTENT_NOT_AVAILABLE"

def _fetch_dart_page(dart_key: str, bgnde: str, endde: str, page_no: int) -> dict:
    """DART list API 단일 페이지 호출."""
    # DART API 파라미터: bgn_de / end_de (언더스코어 필수 — bgnde/endde는 무시됨)
    api_url = (
        f"https://opendart.fss.or.kr/api/list.json"
        f"?crtfc_key={dart_key}&bgn_de={bgnde}&end_de={endde}"
        f"&page_count=100&page_no={page_no}"
    )
    res = session.get(api_url, timeout=30)
    return res.json()


def _fetch_all_dart_items(dart_key: str, bgnde: str, endde: str) -> list[dict]:
    """
    DART list API 전체 페이지 순회.
    page_count=100 기준으로 total_count 초과까지 반복.
    """
    all_items: list[dict] = []
    page_no = 1

    while True:
        try:
            data = _fetch_dart_page(dart_key, bgnde, endde, page_no)
        except Exception as e:
            logger.error(f"DART API 호출 실패 (page {page_no}): {e}")
            break

        status = data.get("status")
        if status == "013":  # 조회 결과 없음
            break
        if status != "000":
            logger.warning(f"DART API 오류 [{bgnde}~{endde} p{page_no}]: {status} {data.get('message', '')}")
            break

        items = data.get("list", [])
        if not items:
            break

        all_items.extend(items)

        total_count = int(data.get("total_count", 0))
        if len(all_items) >= total_count:
            break

        page_no += 1
        time.sleep(0.5)   # DART API 부하 방지

    return all_items


def _batch_fetch_existing(rcept_nos: list[str]) -> set[str]:
    """
    disclosure_insights 에서 이미 저장된 rcept_no를 배치 조회.
    단 1회 Supabase 호출로 수백 건 중복 체크 → per-item DB 호출 제거.
    """
    existing: set[str] = set()
    for i in range(0, len(rcept_nos), 500):
        chunk = rcept_nos[i:i+500]
        try:
            res = supabase.table("disclosure_insights") \
                .select("rcept_no") \
                .in_("rcept_no", chunk) \
                .execute()
            for r in (res.data or []):
                existing.add(r["rcept_no"])
        except Exception as e:
            logger.warning(f"배치 중복 체크 실패 (무시): {e}")
    return existing


def _process_items(items: list[dict], date_label: str) -> tuple[int, set[str]]:
    """
    공시 목록 → 필터링 → 본문 수집 → DB 저장.
    반환: (저장 건수, 저장된 stock_code 집합)
    """
    count = 0
    saved_codes: set[str] = set()

    # ── 1차: 인메모리 필터 (공짜) ─────────────────────────────────────────────
    candidates = []
    for item in items:
        rcept_no       = item.get("rcept_no")
        corp_code      = item.get("corp_code", "").strip()
        report_nm      = item.get("report_nm", "")
        corp_name_val  = item.get("corp_name", "")
        stock_code_val = item.get("stock_code", "").strip()

        if not corp_code:
            continue
        if not stock_code_val:
            logger.info(f"skip unlisted: {corp_name_val}")
            continue
        if is_noise_disclosure(report_nm):
            logger.info(f"skip noise: {report_nm}")
            continue
        if is_noise_corp(corp_name_val):
            logger.info(f"skip corp: {corp_name_val}")
            continue

        candidates.append(item)

    logger.info(f"  [{date_label}] 인메모리 필터 후: {len(candidates)}/{len(items)}건")

    if not candidates:
        return 0, set()

    # ── 2차: 배치 중복 체크 — Supabase 1회 호출 ────────────────────────────────
    candidate_rcept_nos = [i.get("rcept_no") for i in candidates]
    existing = _batch_fetch_existing(candidate_rcept_nos)
    new_candidates = [i for i in candidates if i.get("rcept_no") not in existing]
    logger.info(f"  [{date_label}] 신규 처리 대상: {len(new_candidates)}건 (기존 {len(existing)}건 skip)")

    # ── 3차: DART ZIP 다운로드 + DB 저장 ─────────────────────────────────────
    for item in new_candidates:
        rcept_no       = item.get("rcept_no")
        corp_code      = item.get("corp_code", "").strip()
        report_nm      = item.get("report_nm", "")
        corp_name_val  = item.get("corp_name", "")
        stock_code_val = item.get("stock_code", "").strip()

        content = get_clean_content(rcept_no)

        # 임원 변동 2차 필터 (content 필요)
        if is_executive_noise(report_nm, content):
            logger.info(f"skip exec noise: {report_nm} / {corp_name_val}")
            continue

        payload = {
            "is_visible":      True,
            "rcept_no":        rcept_no,
            "corp_code":       corp_code,
            "corp_name":       item.get("corp_name"),
            "stock_code":      stock_code_val,
            "rcept_dt":        item.get("rcept_dt"),
            "report_nm":       item.get("report_nm"),
            "content":         content,
            "analysis_status": "pending",
            "created_at":      datetime.now().isoformat(),
        }

        try:
            supabase.table("disclosure_insights").upsert(payload, on_conflict="rcept_no").execute()
            count += 1
            saved_codes.add(stock_code_val)
            logger.info(f"[{date_label}][{count}] {corp_name_val} saved")

            # disclosure_hashes 에도 기록 — 다음 실행 시 is_disclosure_processed() 활용
            try:
                hash_key = generate_hash_key(corp_code, rcept_no)
                expires = (datetime.now() + timedelta(days=730)).isoformat()
                supabase.table("disclosure_hashes").upsert(
                    {"hash_key": hash_key, "expires_at": expires},
                    on_conflict="hash_key",
                ).execute()
            except Exception:
                pass  # 해시 저장 실패는 무시 (disclosure_insights 저장이 우선)

        except Exception as e:
            logger.error(f"DB 저장 실패: {e}")

    return count, saved_codes


def run_crawler(start_date: str | None = None, end_date: str | None = None):
    """
    DART 공시 수집.

    start_date / end_date : YYYYMMDD 문자열.
      - 둘 다 None  → 오늘 하루만 수집 (기존 동작)
      - 범위 지정   → start ~ end 를 하루씩 루프 (backfill 용)

    날짜별 루프를 쓰는 이유:
      DART list API의 bgnde~endde 범위가 넓을수록 누락이 발생할 수 있어
      안전하게 하루 단위로 순회한다.
    """
    dart_key = os.environ.get("DART_API_KEY")
    if not dart_key:
        logger.error("DART_API_KEY 환경변수 누락")
        return

    # 날짜 범위 결정
    if start_date and end_date:
        d_start = datetime.strptime(start_date, "%Y%m%d").date()
        d_end   = datetime.strptime(end_date,   "%Y%m%d").date()
    else:
        today   = datetime.now().date()
        d_start = today
        d_end   = today

    # 순회할 영업일 목록 (주말 제외 — 공휴일은 API가 빈 결과로 자연 처리)
    days: list[date_type] = []
    d = d_start
    while d <= d_end:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)

    logger.info(f"DART 수집 시작: {d_start} ~ {d_end} ({len(days)}일)")

    total_saved  = 0
    all_saved_codes: set[str] = set()

    for idx, day in enumerate(days, 1):
        ds = day.strftime("%Y%m%d")
        logger.info(f"[{idx}/{len(days)}] {ds} 수집 중...")

        items = _fetch_all_dart_items(dart_key, ds, ds)
        if not items:
            logger.info(f"  {ds} 데이터 없음 (공휴일 또는 무공시)")
            continue

        logger.info(f"  {ds} API 응답: {len(items)}건")
        saved, codes = _process_items(items, ds)
        total_saved += saved
        all_saved_codes |= codes
        logger.info(f"  {ds} 저장: {saved}건")

        time.sleep(1.0)  # 날짜 간 DART API 부하 방지

    logger.info(f"[DONE] 총 저장: {total_saved}건 / 종목: {len(all_saved_codes)}개")

    # 캐시 무효화 (신규 공시 저장된 경우)
    if all_saved_codes:
        try:
            from backend.core.cache import cache_delete_pattern
            deleted = asyncio.run(cache_delete_pattern("v1:disclosures:*"))
            logger.info(f"[cache] 무효화: v1:disclosures:* ({deleted}개 삭제)")
        except Exception as e:
            logger.warning(f"[cache] 무효화 실패 (무시): {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DART 공시 수집")
    parser.add_argument("--start", help="시작일 YYYYMMDD (기본: 오늘)")
    parser.add_argument("--end",   help="종료일 YYYYMMDD (기본: 오늘)")
    args = parser.parse_args()

    run_crawler(start_date=args.start, end_date=args.end)
