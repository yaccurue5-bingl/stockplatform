"""
backend/routers/market.py
=========================
시장 지수 업데이트 엔드포인트.

scripts/update_indices.py 를 subprocess로 실행합니다.
- 파일 최상단에서 supabase 클라이언트를 바로 생성하는 구조이므로
  직접 import 대신 subprocess 방식을 사용합니다.
"""

import os
import sys
import subprocess
import logging
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks
from backend.core.config import PROJECT_ROOT

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/market", tags=["market"])

MARKET_SCRIPT = PROJECT_ROOT / "scripts" / "update_indices.py"


# ── 실행 상태 간이 추적 ────────────────────────────────────────────────────
_state: dict = {"running": False, "last_run": None, "last_result": None}


def _run_market_subprocess() -> None:
    """BackgroundTask: update_indices.py를 subprocess로 실행"""
    global _state
    _state["running"] = True
    _state["last_run"] = datetime.now().isoformat()
    logger.info("📊 시장 지수 업데이트 시작 (subprocess)")

    try:
        result = subprocess.run(
            [sys.executable, str(MARKET_SCRIPT)],
            capture_output=True,
            text=True,
            env=os.environ.copy(),   # 부모 환경변수 상속
            cwd=str(PROJECT_ROOT),   # 프로젝트 루트를 작업 디렉토리로
            timeout=60,              # 최대 1분
        )
        success = result.returncode == 0
        _state["last_result"] = {
            "success": success,
            "returncode": result.returncode,
            "stdout": result.stdout[-500:] if result.stdout else "",
            "stderr": result.stderr[-300:] if result.stderr else "",
        }
        if success:
            logger.info("✅ 시장 지수 업데이트 완료")
        else:
            logger.error(f"❌ 시장 지수 업데이트 실패 (code={result.returncode})")
    except subprocess.TimeoutExpired:
        logger.error("❌ 시장 지수 타임아웃 (1분 초과)")
        _state["last_result"] = {"success": False, "error": "timeout"}
    except Exception as e:
        logger.exception(f"❌ 시장 지수 오류: {e}")
        _state["last_result"] = {"success": False, "error": str(e)}
    finally:
        _state["running"] = False


# ── 엔드포인트 ─────────────────────────────────────────────────────────────

@router.post("/update")
async def update_market_indices(bg: BackgroundTasks):
    """시장 지수 업데이트 트리거 (백그라운드 실행)"""
    if _state["running"]:
        return {"message": "이미 실행 중입니다.", "state": _state}
    bg.add_task(_run_market_subprocess)
    return {"message": "시장 지수 업데이트 시작됨 (백그라운드)", "script": str(MARKET_SCRIPT)}


@router.get("/status")
async def market_status():
    """마지막 시장 지수 업데이트 상태 확인"""
    return _state
