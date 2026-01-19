import os
import requests
from datetime import datetime, timedelta
from supabase import create_client, Client
import urllib3
import logging
import hashlib

# SSL 경고 비활성화
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

url = "https://rxcwqsolfrjhomeusyza.supabase.co"
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

def run_crawler():
    today = datetime.now().strftime('%Y%m%d')
    dart_key = os.environ.get("DART_API_KEY")
    api_url = f"https://opendart.fss.or.kr/api/list.json?crtfc_key={dart_key}&bgnde={today}&endde={today}&page_count=100"

    logger.info(f"📡 DART 데이터 수집 시작: {today}")

    try:
        # SSL/TLS HandshakeFailure 해결: verify=False 사용
        res = requests.get(api_url, verify=False, timeout=30)
        res.raise_for_status()
        data = res.json()
    except requests.exceptions.SSLError as ssl_err:
        logger.error(f"❌ SSL/TLS 에러: {ssl_err}")
        logger.info("💡 verify=False로 재시도 중...")
        res = requests.get(api_url, verify=False, timeout=30)
        data = res.json()
    except Exception as e:
        logger.error(f"❌ DART API 호출 실패: {e}")
        return

    if data.get("status") == "000":
        count = 0
        skipped = 0
        duplicates = 0

        for item in data.get("list", []):
            stock_code = item.get("stock_code")
            corp_code = item.get("corp_code", "")
            rcept_no = item.get("rcept_no")
            corp_name = item.get("corp_name", "Unknown")
            rcept_dt = item.get("rcept_dt", "")  # ✅ 접수일자 추출 (예: "20260119")

            # ✅ corp_code가 없으면 건너뛰기 (DB constraint 위반 방지)
            if not corp_code or corp_code.strip() == "":
                logger.warning(f"⏭️ corp_code 없음 - 건너뜀: {corp_name} (rcept_no: {rcept_no})")
                skipped += 1
                continue

            # ✅ 종목코드가 없거나 공백이면 건너뛰기
            if not stock_code or stock_code.strip() == "" or stock_code == " ":
                logger.debug(f"⏭️ 종목코드 없음 - 건너뜀: {corp_name}")
                skipped += 1
                continue

            # ✅ rcept_dt가 없으면 오늘 날짜 사용 (NOT NULL 제약 조건 대응)
            if not rcept_dt or rcept_dt.strip() == "":
                rcept_dt = datetime.now().strftime('%Y%m%d')
                logger.warning(f"⚠️ rcept_dt 없음 - 오늘 날짜로 대체: {corp_name} (rcept_no: {rcept_no})")

            # ✅ 종목코드, 회사코드, 접수일자 정리 (공백 제거)
            stock_code = stock_code.strip()
            corp_code = corp_code.strip()
            rcept_dt = rcept_dt.strip()

            # ✅ 중복 체크 (disclosure_hashes 테이블)
            if is_disclosure_processed(corp_code, rcept_no):
                logger.debug(f"⏭️ 이미 처리됨 - 건너뜀: {corp_name} ({rcept_no})")
                duplicates += 1
                continue

            payload = {
                "rcept_no": rcept_no,
                "corp_code": corp_code,
                "corp_name": corp_name,
                "stock_code": stock_code,
                "rcept_dt": rcept_dt,  # ✅ 접수일자 추가
                "report_nm": item.get("report_nm"),
                "analysis_status": "pending",  # 분석 대기 상태
                "created_at": datetime.now().isoformat()
            }

            try:
                # disclosure_insights 저장
                supabase.table("disclosure_insights").upsert(payload, on_conflict="rcept_no").execute()

                # ✅ disclosure_hashes에 hash 저장
                hash_key = generate_hash_key(corp_code, rcept_no)
                hash_payload = {
                    "hash_key": hash_key,
                    "corp_code": corp_code,
                    "rcept_no": rcept_no,
                    "corp_name": corp_name,
                    "report_name": item.get("report_nm"),
                    "groq_analyzed": False,  # 아직 분석 전
                    "sonnet_analyzed": False,
                    "created_at": datetime.now().isoformat(),
                    "expires_at": (datetime.now() + timedelta(days=30)).isoformat()
                }

                supabase.table("disclosure_hashes").upsert(hash_payload, on_conflict="hash_key").execute()

                count += 1
                logger.info(f"✅ [{count}] {corp_name} ({stock_code}) - {item.get('report_nm')[:40]}...")
            except Exception as e:
                logger.error(f"❌ DB 저장 실패: {e}")

        logger.info(f"\n{'='*70}")
        logger.info(f"🎉 수집 완료")
        logger.info(f"   - 저장: {count}건")
        logger.info(f"   - 건너뜀 (corp_code/종목코드 없음): {skipped}건")
        logger.info(f"   - 건너뜀 (중복): {duplicates}건")
        logger.info(f"   - 총: {count + skipped + duplicates}건")
        logger.info(f"{'='*70}\n")
    else:
        logger.warning(f"⚠️ DART API 응답 오류: {data.get('message', 'Unknown error')}")

if __name__ == "__main__":
    run_crawler()