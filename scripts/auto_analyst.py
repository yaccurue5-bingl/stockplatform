import os
import json
import logging
import time
from datetime import datetime
from typing import List, Dict, Any
from groq import Groq  # Groq 라이브러리 추가
from supabase import create_client, Client

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 환경 변수 로드
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# Groq 클라이언트 초기화
groq_client = Groq(api_key=GROQ_API_KEY)

class AIAnalyst:
    def __init__(self):
        # 사용자 제공 프롬프트를 Groq(Llama 3 등)에 최적화
        self.system_prompt = """
        You are a top-tier financial analyst for the Korean Stock Market.
        Analyze the given disclosure/news and provide a structured JSON response.

        # Rules:
        1. Headline: Catchy English headline (under 10 words).
        2. Summary: 3 factual bullet points in English.
        3. Sentiment Score: A float between -1.0 (Very Negative) and 1.0 (Very Positive).
        4. Importance: 'High', 'Medium', or 'Low'.
        5. Analysis: Brief impact on stock price.

        # Response Format (Strict JSON):
        {
          "headline": "string",
          "summary": ["string", "string", "string"],
          "sentiment_score": float,
          "importance": "string",
          "impact_analysis": "string"
        }
        """

    def analyze_content(self, corp_name: str, title: str) -> Dict[str, Any]:
        """Groq API를 사용하여 분석 수행"""
        try:
            # Llama 3 70B 모델은 성능이 뛰어나며 Groq에서 매우 빠릅니다.
            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Company: {corp_name}\nTitle: {title}"}
                ],
                model="llama3-70b-8192", # 또는 llama3-8b-8192
                response_format={"type": "json_object"}
            )
            
            return json.loads(chat_completion.choices[0].message.content)
        except Exception as e:
            logger.error(f"Groq Analysis Error: {e}")
            return None

def process_disclosures():
    analyst = AIAnalyst()
    
    # 1. 분석되지 않은 공시 데이터 조회
    res = supabase.table("disclosure_insights").select("*").is_("ai_summary", "null").limit(5).execute()
    items = res.data

    if not items:
        logger.info("✅ No new content to analyze.")
        return

    for item in items:
        logger.info(f"🔍 Analyzing: [{item['corp_name']}] {item['report_nm']}")
        
        # 2. AI 분석 실행
        result = analyst.analyze_content(item['corp_name'], item['report_nm'])
        
        if result:
            # 3. DB 업데이트
            update_payload = {
                "ai_summary": "\n".join(result.get("summary", [])),
                "sentiment": "Positive" if result.get("sentiment_score", 0) > 0.1 else ("Negative" if result.get("sentiment_score", 0) < -0.1 else "Neutral"),
                "sentiment_score": result.get("sentiment_score"),
                "importance": result.get("importance"),
                "updated_at": datetime.now().isoformat()
            }
            
            supabase.table("disclosure_insights").update(update_payload).eq("id", item['id']).execute()
            logger.info(f"✅ DB Updated for {item['corp_name']}")
        
        # Groq은 속도가 매우 빠르지만 Rate Limit 방지를 위해 짧게 대기
        time.sleep(0.5)

if __name__ == "__main__":
    process_disclosures()