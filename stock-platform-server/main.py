# stock-platform-server/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
import logging
from datetime import datetime

# 로컬 모듈 import
try:
    from auto_analyst import run_analysis_for_api
    from market_data import MarketDataScraper
except ImportError:
    # 패키지 형태로 실행될 경우
    from .auto_analyst import run_analysis_for_api
    from .market_data import MarketDataScraper

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI 애플리케이션 생성
app = FastAPI()

# CORS 설정
origins = [
    "http://localhost:3000",
    "http://localhost:3001"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 스크래퍼 인스턴스 생성
market_scraper = MarketDataScraper()

# 기본 상태 확인 엔드포인트
@app.get("/")
def read_root():
    return {"status": "ok", "message": "FastAPI Server is running"}

# ✨ 실시간 시장 데이터 API
@app.get("/api/market/live")
def get_live_market_data():
    """
    실시간 시장 데이터 반환 (KOSPI, KOSDAQ, USD/KRW, 주요 종목)
    5분 지연 데이터 (네이버 금융 기준)
    """
    try:
        # 주요 종목 리스트
        major_stocks = ["005930", "000660", "035420", "005380"]
        
        market_data = market_scraper.get_all_market_data(major_stocks)
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "data": market_data
        }
    except Exception as e:
        logger.error(f"Market data API error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().isoformat()
        }

# 개별 종목 실시간 가격
@app.get("/api/stock/price/{ticker}")
def get_stock_price(ticker: str):
    """
    개별 종목의 실시간 가격 반환
    """
    try:
        price_data = market_scraper.get_stock_price(ticker)
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "data": price_data
        }
    except Exception as e:
        logger.error(f"Stock price API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 전체 분석 실행 API
@app.post("/api/run_full_analysis")
def run_full_analysis():
    target_stocks = ["005930", "000660"]
    analysis_results = run_analysis_for_api(target_stocks)
    
    return {
        "status": "success", 
        "count": len(analysis_results),
        "results": analysis_results
    }

# ✨ 실시간 종목 상세 데이터 엔드포인트
@app.get("/api/stock/details/{ticker}")
def get_stock_details(ticker: str) -> Dict[str, Any]:
    """
    특정 종목 코드에 대한 실시간 상세 데이터를 반환합니다.
    """
    
    logger.info(f"Fetching real-time data for ticker: {ticker}")
    
    try:
        # 실시간 뉴스 분석 실행
        analysis_results = run_analysis_for_api([ticker])
        
        if not analysis_results or len(analysis_results) == 0:
            raise HTTPException(status_code=404, detail=f"No data found for ticker {ticker}")
        
        result = analysis_results[0]
        
        # 에러 체크
        if "error" in result.get("original_data", {}):
            logger.warning(f"Scraping failed for {ticker}")
            scraped_news = {"error": "Failed to fetch news"}
            ai_insight = {"error": "No AI analysis available"}
        else:
            scraped_news = result.get("original_data", {})
            ai_insight = result.get("ai_insight", {})
        
        # 재무 데이터 (목업)
        mock_financials = [
            {"name": "23.3Q", "rev": 67, "op": 2.4},
            {"name": "23.4Q", "rev": 69, "op": 2.8},
            {"name": "24.1Q", "rev": 71, "op": 6.6},
            {"name": "24.2Q(E)", "rev": 74, "op": 7.2},
        ]
        
        # 종목명 매핑
        stock_names = {
            "005930": "Samsung Electronics",
            "000660": "SK Hynix",
            "005380": "Hyundai Motor",
            "005490": "POSCO Holdings",
            "086520": "EcoPro",
            "035720": "Kakao"
        }
        
        company_name = stock_names.get(ticker, f"Stock {ticker}")
        
        return {
            "status": "success",
            "ticker": ticker,
            "companyName": company_name,
            "financials": mock_financials,
            "scrapedNews": {
                "title_kr": scraped_news.get("title_kr", ""),
                "content_kr": scraped_news.get("content_kr", "")[:500],
                "source": scraped_news.get("source", ""),
                "url": scraped_news.get("original_url", "")
            },
            "aiInsight": {
                "title_en": ai_insight.get("title_en", ""),
                "summary_en": ai_insight.get("summary_en", ""),
                "sentiment": ai_insight.get("sentiment", "neutral"),
                "key_points": ai_insight.get("key_points", []),
                "analyst_view": ai_insight.get("analyst_view", "")
            },
            "scraped_at": result.get("scraped_at", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching stock details: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Health check
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": str(datetime.now())}