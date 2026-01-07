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

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

class AIAnalyst:
    def __init__(self):
        self.system_prompt = """
        Analyze the Korean stock disclosure and provide a JSON response.
        1. Headline: English (max 10 words).
        2. Summary: 3 bullet points in English.
        3. Sentiment Score: -1.0 to 1.0.
        4. Importance: High/Medium/Low.
        """

    def analyze_content(self, corp_name, title):
        try:
            # 중단된 llama3-70b-8192 대신 llama-3.3-70b-versatile 사용
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile", 
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Company: {corp_name}\nTitle: {title}"}
                ],
                response_format={"type": "json_object"}
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Groq Analysis Error: {e}")
            return None

def run():
    analyst = AIAnalyst()
    res = supabase.table("disclosure_insights").select("*").is_("ai_summary", "null").limit(5).execute()
    
    for item in res.data:
        result = analyst.analyze_content(item['corp_name'], item['report_nm'])
        if result:
            update_data = {
                "ai_summary": "\n".join(result.get("summary", [])),
                "sentiment_score": result.get("sentiment_score"),
                "importance": result.get("importance"),
                "updated_at": datetime.now().isoformat()
            }
            supabase.table("disclosure_insights").update(update_data).eq("id", item['id']).execute()
            logger.info(f"✅ 분석 성공: {item['corp_name']}")
        time.sleep(1)

if __name__ == "__main__":
    run()