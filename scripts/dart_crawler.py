import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import time
from datetime import datetime, timedelta
from supabase import create_client, Client
import urllib3
import logging
import hashlib
import re
import zipfile
import io
import xml.etree.ElementTree as ET

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
    """HTML에서 텍스트만 추출하는 공통 정제 함수"""
    clean = re.sub(r'<(style|script|head)[^>]*>.*?</\1>', '', raw_html, flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r'<[^>]*>', '', clean)
    clean = clean.replace('\x00', '').replace('\u0000', '')
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def _fetch_from_viewer(rcept_no):
    """document.xml 014 시 DART 웹 뷰어에서 본문 직접 스크래핑 (폴백)"""
    try:
        # 1단계: 메인 페이지에서 dcm_no 추출
        main_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcept_no={rcept_no}"
        resp = session.get(main_url, timeout=15)
        if resp.status_code != 200:
            return None

        dcm_match = re.search(r"dcmNo\s*[=:]\s*['\"]?(\d+)", resp.text)
        if not dcm_match:
            # dcmNo 못 찾으면 메인 페이지 자체에서 텍스트 추출 시도
            text = _clean_html_text(resp.text)
            if len(text) > 100:
                return text[:2500]
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
            return None

        text = _clean_html_text(resp2.text)
        if len(text) > 100:
            logger.info(f"{rcept_no} 뷰어 폴백 성공 ({len(text)}자)")
            return text[:2500]

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
                                raw_text = f.read().decode('utf-8', errors='ignore')
                        return _clean_html_text(raw_text)[:2500]
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
                    logger.info(f"{rcept_no} document.xml 없음(014) -> 뷰어 폴백 시도")
                    fallback = _fetch_from_viewer(rcept_no)
                    return fallback if fallback else "CONTENT_NOT_AVAILABLE"

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

def run_crawler():
    today = datetime.now().strftime('%Y%m%d')
    dart_key = os.environ.get("DART_API_KEY")
    api_url = f"https://opendart.fss.or.kr/api/list.json?crtfc_key={dart_key}&bgnde={today}&endde={today}&page_count=100"

    logger.info(f"📡 DART 데이터 수집 시작: {today}")

    # ... (데이터 호출부 생략) ...
    try:
        res = session.get(api_url, timeout=30)
        data = res.json()
    except Exception as e:
        logger.error(f"❌ DART API 호출 실패: {e}")
        return

    if data.get("status") == "000":
        count = 0
        for item in data.get("list", []):
            # ... (중복 체크 및 데이터 정리 생략) ...
            rcept_no = item.get("rcept_no")
            corp_code = item.get("corp_code", "").strip()
            
            if not corp_code or is_disclosure_processed(corp_code, rcept_no):
                continue
            
            # 정제된 본문 추출 함수 호출 (내부에서 sleep + 재시도 처리)
            content = get_clean_content(rcept_no)

            payload = {
                "rcept_no": rcept_no,
                "corp_code": corp_code,
                "corp_name": item.get("corp_name"),
                "stock_code": item.get("stock_code", "").strip(),
                "rcept_dt": item.get("rcept_dt"),
                "report_nm": item.get("report_nm"),
                "content": content, # 정제된 텍스트 또는 마킹값
                "analysis_status": "pending",
                "created_at": datetime.now().isoformat()
            }

            try:
                supabase.table("disclosure_insights").upsert(payload, on_conflict="rcept_no").execute()
                # (해시 기록 로직 생략)
                count += 1
                logger.info(f"✅ [{count}] {item.get('corp_name')} 저장 완료")
            except Exception as e:
                logger.error(f"❌ DB 저장 실패: {e}")

if __name__ == "__main__":
    run_crawler()
