import os
import json
import logging
import time
import hashlib
from datetime import datetime
from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 1. 로컬 경로 설정
local_env_path = r"C:\stockplatform\.env.local"

# 2. 로컬 경로에 파일이 있을 때만 로드 (Windows 로컬 환경)
if os.path.exists(local_env_path):
    load_dotenv(local_env_path)
    logger.info(f"Loaded config from {local_env_path}")
else:
    # 3. 로컬 파일이 없으면 시스템 환경 변수(온라인 서비스 설정값)를 자동으로 사용
    load_dotenv() 
    logger.info("Using system environment variables")

def generate_hash_key(corp_code: str, rcept_no: str) -> str:
    """공시 hash key 생성"""
    return hashlib.sha256(f"{corp_code}_{rcept_no}".encode()).hexdigest()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

if not GROQ_API_KEY:
    logger.error("❌ GROQ_API_KEY가 설정되지 않았습니다.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

class AIAnalyst:
    def __init__(self):
        self.system_prompt = """
You are a Korean stock market analyst. Analyze disclosures and respond with JSON.

Required format:
{
  "headline": "Brief English headline (max 10 words)",
  "summary": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "sentiment": "POSITIVE or NEGATIVE or NEUTRAL",
  "sentiment_score": 0.75,
  "importance": "HIGH or MEDIUM or LOW"
}

Scoring rules:
- sentiment_score: -1.0 (very negative) to 1.0 (very positive)
- POSITIVE: good news (profits up, partnerships, expansion)
- NEGATIVE: bad news (losses, lawsuits, recalls)
- NEUTRAL: routine filings
- HIGH: M&A, major contracts, large earnings changes
- MEDIUM: regular earnings, minor partnerships
- LOW: procedural filings
"""

    def analyze_content(self, corp_name, title):
        try:
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Company: {corp_name}\nDisclosure: {title}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_completion_tokens=1000 # 토큰 제한 추가
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # 필수 필드 검증 및 기본값 설정
            if "sentiment" not in result:
                result["sentiment"] = "NEUTRAL"
            if "sentiment_score" not in result:
                result["sentiment_score"] = 0.0
            if "importance" not in result:
                result["importance"] = "MEDIUM"
            if "summary" not in result or not isinstance(result["summary"], list):
                result["summary"] = ["분석 데이터 생성 중"]
            
            # 값 정규화
            result["sentiment_score"] = max(-1.0, min(1.0, float(result["sentiment_score"])))
            result["sentiment"] = result["sentiment"].upper()
            result["importance"] = result["importance"].upper()
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON 파싱 오류: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Groq API Error: {e}")
            return None

def run():
    analyst = AIAnalyst()
    
    # ✅ pending 상태이고 재시도 횟수가 3회 미만인 항목만 조회
    res = supabase.table("disclosure_insights") \
        .select("*") \
        .eq("analysis_status", "pending") \
        .or_("analysis_retry_count.is.null,analysis_retry_count.lt.3") \
        .order("created_at", desc=True) \
        .limit(200) \
        .execute()
    
    if not res.data:
        logger.info("✅ 분석할 공시가 없습니다.")
        return

    logger.info(f"🔍 {len(res.data)}건 분석 시작...")
    
    success_count = 0
    fail_count = 0
    
    for item in res.data:
        # 📄 분석 시작 - 상태를 'processing'으로 변경
        try:
            supabase.table("disclosure_insights") \
                .update({
                    "analysis_status": "processing",
                    "updated_at": datetime.now().isoformat()
                }) \
                .eq("id", item['id']) \
                .execute()
        except Exception as e:
            logger.error(f"❌ 상태 업데이트 실패: {e}")
            continue
        
        logger.info(f"📊 분석 중: {item['corp_name']} - {item['report_nm'][:50]}...")
        
        result = analyst.analyze_content(item['corp_name'], item['report_nm'])
        
        if result:
            summary_text = "\n".join(result.get("summary", []))

            update_data = {
                "ai_summary": summary_text,
                "sentiment": result.get("sentiment", "NEUTRAL"),
                "sentiment_score": result.get("sentiment_score", 0.0),
                "importance": result.get("importance", "MEDIUM"),
                "analysis_status": "completed",  # ✅ 분석 완료
                "updated_at": datetime.now().isoformat()
            }

            try:
                # disclosure_insights 업데이트
                supabase.table("disclosure_insights") \
                    .update(update_data) \
                    .eq("id", item['id']) \
                    .execute()

                # ✅ disclosure_hashes에 Groq 분석 완료 기록
                try:
                    corp_code = item.get('corp_code', '')
                    rcept_no = item.get('rcept_no', '')

                    if corp_code and rcept_no:
                        hash_key = generate_hash_key(corp_code, rcept_no)
                        supabase.table("disclosure_hashes") \
                            .update({
                                "groq_analyzed": True,
                                "groq_analyzed_at": datetime.now().isoformat()
                            }) \
                            .eq("hash_key", hash_key) \
                            .execute()
                        logger.debug(f"✅ Hash 업데이트: {hash_key[:16]}...")
                except Exception as hash_err:
                    logger.warning(f"⚠️ Hash 업데이트 실패 (분석은 완료): {hash_err}")

                success_count += 1
                logger.info(f"✅ 완료: {item['corp_name']} | {update_data['sentiment']} ({update_data['sentiment_score']:.2f}) | {update_data['importance']}")
            except Exception as e:
                fail_count += 1
                logger.error(f"❌ DB 업데이트 실패: {e}")
                # 실패 시 상태를 'failed'로 변경
                try:
                    retry_count = item.get('analysis_retry_count', 0) + 1
                    supabase.table("disclosure_insights") \
                        .update({
                            "analysis_status": "failed",
                            "analysis_retry_count": retry_count,
                            "updated_at": datetime.now().isoformat()
                        }) \
                        .eq("id", item['id']) \
                        .execute()
                except:
                    pass
        else:
            fail_count += 1
            logger.warning(f"⚠️ 분석 실패: {item['corp_name']}")
            # 분석 실패 시 상태 업데이트
            try:
                retry_count = item.get('analysis_retry_count', 0) + 1
                # 3회 이상 실패 시 failed, 그 이하면 pending으로 복원
                new_status = "failed" if retry_count >= 3 else "pending"
                
                supabase.table("disclosure_insights") \
                    .update({
                        "analysis_status": new_status,
                        "analysis_retry_count": retry_count,
                        "updated_at": datetime.now().isoformat()
                    }) \
                    .eq("id", item['id']) \
                    .execute()
                
                logger.info(f"   재시도 횟수: {retry_count}/3 | 상태: {new_status}")
            except:
                pass
        
        # API 속도 제한 방지
        time.sleep(2.5)
    
    logger.info(f"\n{'='*70}")
    logger.info(f"🎉 분석 완료")
    logger.info(f"   - 성공: {success_count}건")
    logger.info(f"   - 실패: {fail_count}건")
    logger.info(f"{'='*70}\n")

if __name__ == "__main__":
    run()