"""
backend/routers/dart.py
=======================
DART 공시 수집 엔드포인트.

scripts/dart_crawler.py 를 subprocess로 실행합니다.
- 파일 최상단에서 supabase 클라이언트를 바로 생성하는 구조이므로
  직접 import 대신 subprocess 방식을 사용합니다.
- 부모 프로세스(main.py)에서 이미 환경변수가 로드되어 있으므로
  os.environ.copy()로 자식 프로세스에 그대로 전달됩니다.
"""

import os
import sys
import subprocess
import logging
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from backend.core.config import PROJECT_ROOT

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dart", tags=["dart"])

DART_SCRIPT = PROJECT_ROOT / "scripts" / "dart_crawler.py"


# ── 실행 상태 간이 추적 (메모리, 재시작 시 초기화) ──────────────────────────
_state: dict = {"running": False, "last_run": None, "last_result": None}


def _run_dart_subprocess() -> None:
    """BackgroundTask: dart_crawler.py를 subprocess로 실행"""
    global _state
    _state["running"] = True
    _state["last_run"] = datetime.now().isoformat()
    logger.info("📡 DART 수집 시작 (subprocess)")

    try:
        result = subprocess.run(
            [sys.executable, str(DART_SCRIPT)],
            capture_output=True,
            text=True,
            env=os.environ.copy(),   # 부모 환경변수 상속
            cwd=str(PROJECT_ROOT),   # 프로젝트 루트를 작업 디렉토리로
            timeout=600,             # 최대 10분
        )
        success = result.returncode == 0
        _state["last_result"] = {
            "success": success,
            "returncode": result.returncode,
            "stdout_tail": result.stdout[-500:] if result.stdout else "",
            "stderr_tail": result.stderr[-500:] if result.stderr else "",
        }
        if success:
            logger.info("✅ DART 수집 완료")
        else:
            logger.error(f"❌ DART 수집 실패 (code={result.returncode})\n{result.stderr[-300:]}")
    except subprocess.TimeoutExpired:
        logger.error("❌ DART 수집 타임아웃 (10분 초과)")
        _state["last_result"] = {"success": False, "error": "timeout"}
    except Exception as e:
        logger.exception(f"❌ DART 수집 오류: {e}")
        _state["last_result"] = {"success": False, "error": str(e)}
    finally:
        _state["running"] = False


# ── 엔드포인트 ─────────────────────────────────────────────────────────────

@router.post("/run")
async def run_dart_crawler(bg: BackgroundTasks):
    """DART 공시 수집 트리거 (백그라운드 실행)"""
    if _state["running"]:
        return {"message": "이미 실행 중입니다.", "state": _state}
    bg.add_task(_run_dart_subprocess)
    return {"message": "DART 수집 시작됨 (백그라운드)", "script": str(DART_SCRIPT)}


@router.get("/status")
async def dart_status():
    """마지막 DART 수집 실행 상태 확인"""
    return _state
