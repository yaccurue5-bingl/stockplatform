#!/usr/bin/env python3
"""
Stock Platform FastAPI Server (Modified)
==============================
수정 사항:
1. 환경 변수 이름 불일치 해결 (NEXT_PUBLIC_... -> SUPABASE_...)
2. 서비스 롤 키(SERVICE_ROLE_KEY) 권한 강제 매핑 로직 추가
3. DB 쓰기 권한 확보로 422 에러 및 데이터 미반영 문제 해결
"""

import os
import sys
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

# ==================== 환경 변수 및 프록시 설정 ====================

# Supabase 접근을 위해 프록시 우회 설정
supabase_domains = ['supabase.co', '*.supabase.co']
current_no_proxy = os.environ.get('no_proxy', '')
if current_no_proxy:
    os.environ['no_proxy'] = f"{current_no_proxy},{','.join(supabase_domains)}"
    os.environ['NO_PROXY'] = f"{current_no_proxy},{','.join(supabase_domains)}"
else:
    os.environ['no_proxy'] = ','.join(supabase_domains)
    os.environ['NO_PROXY'] = ','.join(supabase_domains)

# 프로젝트 루트를 Python 경로에 추가
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# 환경변수 로드 (.env.local에서)
try:
    from utils.env_loader import load_env
    load_env()  
    
    # [수정] 환경 변수 이름 강제 매핑 (매우 중요)
    # 스크립트들이 'SUPABASE_SERVICE_KEY'와 'SUPABASE_URL'이라는 이름을 찾으므로 맞춰줍니다.
    if os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        os.environ["SUPABASE_SERVICE_KEY"] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    elif os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"):
        os.environ["SUPABASE_SERVICE_KEY"] = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        
except ImportError:
    print("Warning: 환경변수 로더를 불러올 수 없습니다.")

try:
    from fastapi import FastAPI, HTTPException, BackgroundTasks, Body
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel, Field
except ImportError:
    print("Error: FastAPI not installed")
    sys.exit(1)

# 스크립트 임포트
from scripts.import_ksic_data import KSICDataImporter
from scripts.validate_ksic_data import KSICValidator
from scripts.map_companies_to_ksic import CompanyKSICMapper

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI 앱 초기화
app = FastAPI(
    title="Stock Platform API",
    description="KSIC 데이터 관리 및 기업 분류 API (Service Role Key Enabled)",
    version="1.0.1",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ==================== Pydantic Models ====================

class ImportKSICRequest(BaseModel):
    use_excel: bool = Field(True, description="엑셀 파일 사용 여부")

class ValidateKSICRequest(BaseModel):
    verbose: bool = Field(False, description="상세 검증 활성화")

class MapCompaniesRequest(BaseModel):
    stock_codes: Optional[List[str]] = Field(None, description="특정 종목코드 리스트")
    unmapped_only: bool = Field(True, description="KSIC가 없는 기업만 매핑")
    batch_size: int = Field(100, description="배치 크기", ge=1, le=1000)
    dry_run: bool = Field(False, description="실제 업데이트 없이 테스트")

class SetupConfig(BaseModel):
    skip_import: bool = Field(False, description="임포트 단계 건너뛰기")
    skip_validation: bool = Field(False, description="검증 단계 건너뛰기")
    skip_mapping: bool = Field(False, description="매핑 단계 건너뛰기")
    unmapped_only: bool = Field(True, description="매핑 시 KSIC 없는 기업만")

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    return {"status": "online", "message": "Stock Platform API is running"}

@app.get("/health")
async def health_check():
    from utils.env_loader import get_supabase_config, get_dart_api_key
    # get_supabase_config(use_service_role=True)를 호출하여 실제 키가 로드되는지 확인
    url, key = get_supabase_config(use_service_role=True)
    return {
        "status": "healthy",
        "env_check": {
            "supabase_url": bool(url),
            "supabase_service_key": bool(key),
            "dart_api_key": bool(get_dart_api_key())
        }
    }

@app.post("/api/ksic/setup-all", response_model=APIResponse)
async def setup_all(config: SetupConfig = Body(default=SetupConfig())):
    """전체 셋업 실행 (DB 업데이트 권한 포함)"""
    logger.info("🚀 KSIC 전체 셋업 시작")
    results = {"import": {"skipped": True}, "validate": {"skipped": True}, "map": {"skipped": True}}
    failed_steps = []

    try:
        # 1. 임포트 단계
        if not config.skip_import:
            importer = KSICDataImporter()
            if not importer.run(): failed_steps.append("임포트")
            results["import"] = {"success": True}

        # 2. 검증 단계
        if not config.skip_validation:
            validator = KSICValidator()
            if not validator.run(): failed_steps.append("검증")
            results["validate"] = {"success": True, "stats": validator.stats}

        # 3. 매핑 단계 [이 부분이 실제 DB의 URL을 업종으로 고칩니다]
        if not config.skip_mapping:
            # [중요] dry_run=False로 설정하여 실제 DB에 반영
            mapper = CompanyKSICMapper(dry_run=False)
            map_success = mapper.run(unmapped_only=False, batch_size=100)
            results["map"] = {"success": map_success, "stats": mapper.stats}
            if not map_success: failed_steps.append("매핑")

        all_success = len(failed_steps) == 0
        return APIResponse(
            success=all_success,
            message="전체 셋업 완료" if all_success else f"실패 단계: {', '.join(failed_steps)}",
            data={**results, "failed_steps": failed_steps}
        )
    except Exception as e:
        logger.error(f"Setup-all error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ksic/stats", response_model=APIResponse)
async def get_ksic_stats():
    # 기존 코드와 동일 (Supabase 클라이언트 사용)
    try:
        from supabase import create_client
        from utils.env_loader import get_supabase_config
        url, key = get_supabase_config(use_service_role=True)
        supabase = create_client(url, key)
        
        # 통계 쿼리 실행...
        res = supabase.table('companies').select('code', count='exact').execute()
        total = res.count if hasattr(res, 'count') else 0
        return APIResponse(success=True, message="통계 조회 성공", data={"total_companies": total})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # 서버 시작 전 환경 변수 이름 체크 로직 수정
    print("Checking Environment Variables...")
    if not os.getenv("SUPABASE_SERVICE_KEY"):
        print("⚠️  Warning: SUPABASE_SERVICE_KEY (or ROLE_KEY) is missing!")
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)