import os
import json
import logging
import time
from datetime import datetime
from groq import Groq
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 환경 변수 로드
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

if not GROQ_API_KEY:
    logger.error("❌ GROQ_API_KEY가 설정되지 않았습니다. GitHub Secrets를 확인하세요.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

class AIAnalyst:
    def __init__(self):
        self.system_prompt = """
You are an expert Korean stock market analyst. Analyze the disclosure and respond ONLY with valid JSON.

Required JSON format:
{
  "headline": "Brief English headline (max 10 words)",
  "summary": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
  "sentiment": "POSITIVE or NEGATIVE or NEUTRAL",
  "sentiment_score": 0.75,
  "importance": "HIGH or MEDIUM or LOW"
}

Rules:
- sentiment_score: -1.0 (very negative) to 1.0 (very positive)
- POSITIVE: good news (earnings up, partnerships, expansion)
- NEGATIVE: bad news (losses, lawsuits, recalls)
- NEUTRAL: routine filings
- HIGH importance: M&A, major contracts, earnings surprises
- MEDIUM: regular earnings, minor partnerships
- LOW: procedural filings, routine updates
        """

    def analyze_content(self, corp_name, title):
        try:
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile", 
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Company: {corp_name}\nDisclosure Title: {title}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.3  # 일관성 있는 분석을 위해 낮은 온도 사용
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # ✅ 필수 필드 검증
            required_fields = ["sentiment", "sentiment_score", "importance", "summary"]
            for field in required_fields:
                if field not in result:
                    logger.warning(f"⚠️ Missing field '{field}' in Groq response, using default")
                    if field == "sentiment":
                        result[field] = "NEUTRAL"
                    elif field == "sentiment_score":
                        result[field] = 0.0
                    elif field == "importance":
                        result[field] = "MEDIUM"
                    elif field == "summary":
                        result[field] = ["분석 정보 없음"]
            
            # ✅ sentiment_score 범위 검증 (-1.0 ~ 1.0)
            score = float(result.get("sentiment_score", 0.0))
            result["sentiment_score"] = max(-1.0, min(1.0, score))
            
            # ✅ sentiment 대문자 변환
            result["sentiment"] = result.get("sentiment", "NEUTRAL").upper()
            
            # ✅ importance 대문자 변환
            result["importance"] = result.get("importance", "MEDIUM").upper()
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON Parse Error: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Groq Analysis Error: {e}")
            return None

def run():
    analyst = AIAnalyst()
    
    # ✅ ai_summary가 NULL인 항목만 가져오기 (dart_crawler가 NULL로 저장하므로 작동함)
    res = supabase.table("disclosure_insights") \
        .select("*") \
        .is_("ai_summary", "null") \
        .order("created_at", desc=True) \
        .limit(20) \
        .execute()
    
    if not res.data:
        logger.info("✅ 분석할 새로운 공시가 없습니다.")
        return

    logger.info(f"🔍 {len(res.data)}건의 공시를 분석합니다...")
    
    success_count = 0
    fail_count = 0
    
    for item in res.data:
        logger.info(f"📊 분석 중: {item['corp_name']} - {item['report_nm'][:50]}...")
        
        # Groq API 호출
        result = analyst.analyze_content(item['corp_name'], item['report_nm'])
        
        if result:
            # ✅ summary 리스트를 줄바꿈 문자열로 변환
            summary_text = "\n".join(result.get("summary", []))
            
            update_data = {
                "ai_summary": summary_text,
                "sentiment": result.get("sentiment", "NEUTRAL"),
                "sentiment_score": result.get("sentiment_score", 0.0),
                "importance": result.get("importance", "MEDIUM"),
                "updated_at": datetime.now().isoformat()
            }
            
            # DB 업데이트
            try:
                supabase.table("disclosure_insights").update(update_data).eq("id", item['id']).execute()
                logger.info(f"✅ 분석 성공: {item['corp_name']} | Sentiment: {update_data['sentiment']} ({update_data['sentiment_score']:.2f}) | Importance: {update_data['importance']}")
                success_count += 1
            except Exception as e:
                logger.error(f"❌ DB 업데이트 실패 (ID: {item['id']}): {e}")
                fail_count += 1
        else:
            logger.warning(f"⚠️ 분석 실패: {item['corp_name']}")
            fail_count += 1
        
        # Groq API 속도 제한 방지 (분당 30회 제한 대비)
        time.sleep(2.5)
    
    logger.info(f"🎉 분석 완료 - 성공: {success_count}건, 실패: {fail_count}건")

if __name__ == "__main__":
    run()