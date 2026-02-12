import os
import requests
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

# DART API 세션 (연결 재사용 + 헤더 설정)
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json, application/xml, application/zip, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
})
session.verify = False

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

def get_clean_content(rcept_no, max_retries=3):
    """ZIP 압축 해제, 상세 에러 로깅 및 정밀 정제 로직 통합 (014 에러 재시도 포함)"""
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
                # 1. 정상적인 ZIP 파일 응답인 경우 (PK로 시작)
                if response.content.startswith(b'PK'):
                    try:
                        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                            xml_name = z.namelist()[0]
                            with z.open(xml_name) as f:
                                raw_text = f.read().decode('utf-8', errors='ignore')

                        # 2. 정밀 정제 로직 (Style, Script 및 HTML 태그 제거)
                        clean_text = re.sub(r'<(style|script)[^>]*>.*?</\1>', '', raw_text, flags=re.DOTALL | re.IGNORECASE)
                        clean_text = re.sub(r'<[^>]*>', '', clean_text)

                        # Null 바이트 및 특수 문자 제거
                        clean_text = clean_text.replace('\x00', '').replace('\u0000', '')
                        # 연속된 공백 하나로 통합
                        clean_text = re.sub(r'\s+', ' ', clean_text).strip()

                        return clean_text[:2500]

                    except Exception as zip_err:
                        logger.error(f"ZIP 처리 중 오류 ({rcept_no}): {zip_err}")
                        return "CONTENT_NOT_AVAILABLE"

                # 3. ZIP이 아닌 경우 (DART 에러 XML 응답)
                else:
                    response_text = response.text
                    dart_status = None
                    dart_message = None

                    if "<?xml" in response_text:
                        try:
                            root = ET.fromstring(response_text)
                            dart_status = root.find('status').text if root.find('status') is not None else None
                            dart_message = root.find('message').text if root.find('message') is not None else None
                        except Exception:
                            pass

                    # 014(파일 미존재) 또는 020(요청 제한 초과): 재시도 대상
                    if dart_status in ("014", "020") and attempt < max_retries:
                        wait_time = 3.0 * attempt
                        logger.warning(f"[시도 {attempt}/{max_retries}] {rcept_no} 상태 {dart_status}: {dart_message} -> {wait_time}초 후 재시도")
                        time.sleep(wait_time)
                        continue

                    if dart_status:
                        logger.warning(f"{rcept_no} 수집 불가 - DART 응답 [상태: {dart_status}] [메시지: {dart_message}]")
                    else:
                        logger.warning(f"{rcept_no} 수집 불가 (알 수 없는 응답 형식)")

                    return "CONTENT_NOT_AVAILABLE"

        except requests.exceptions.ConnectionError as e:
            if attempt < max_retries:
                wait_time = 3.0 * attempt
                logger.warning(f"[시도 {attempt}/{max_retries}] {rcept_no} 연결 오류 -> {wait_time}초 후 재시도: {e}")
                time.sleep(wait_time)
                continue
            logger.warning(f"본문 수집 중 연결 오류 ({rcept_no}): {e}")
            return "CONTENT_NOT_AVAILABLE"
        except Exception as e:
            logger.warning(f"본문 수집 중 시스템 에러 발생 ({rcept_no}): {e}")
            return "CONTENT_NOT_AVAILABLE"

    return None

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