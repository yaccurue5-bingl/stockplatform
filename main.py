#!/usr/bin/env python3
"""
Stock Platform FastAPI Server
==============================
main.py 는 앱 초기화와 라우터 등록만 담당합니다.
실제 비즈니스 로직은 backend/routers/ 아래 각 모듈에 있습니다.

실행:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import sys
import logging
from pathlib import Path

# ── 프로젝트 루트를 Python path 에 추가 ─────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# ── 환경변수 로드 (서버 시작 시 1회) ──────────────────────────────────────
from backend.core.config import load_env
load_env()

# ── FastAPI ───────────────────────────────────────────────────────────────
try:
    from fastapi import FastAPI
except ImportError:
    print("Error: FastAPI가 설치되지 않았습니다. pip install fastapi uvicorn 을 실행하세요.")
    sys.exit(1)

# ── 로깅 ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ── 앱 생성 ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Stock Platform API",
    description="K-Market Insight 백엔드 API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── 라우터 등록 ───────────────────────────────────────────────────────────
from backend.routers.health import router as health_router
from backend.routers.dart   import router as dart_router
from backend.routers.market import router as market_router
from backend.routers.paddle import router as paddle_router

# ── B2B /v1/ 라우터 ───────────────────────────────────────────────────────
from backend.routers.v1.market_radar    import router as v1_market_radar_router
from backend.routers.v1.sector_signals  import router as v1_sector_signals_router
from backend.routers.v1.disclosures     import router as v1_disclosures_router
from backend.routers.v1.events          import router as v1_events_router

app.include_router(health_router)
app.include_router(dart_router)
app.include_router(market_router)
app.include_router(paddle_router)  # POST /paddle-webhook

# B2B API (API 키 인증 필요)
app.include_router(v1_market_radar_router)
app.include_router(v1_sector_signals_router)
app.include_router(v1_disclosures_router)
app.include_router(v1_events_router)

logger.info("[OK] Stock Platform API 초기화 완료 (v1 B2B 라우터 포함)")

# ── 개발 서버 직접 실행 ───────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
