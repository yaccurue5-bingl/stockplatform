#!/usr/bin/env python3
"""
Stock Platform FastAPI Server
==============================

KSIC 데이터 관리 및 기업 분류를 위한 통합 API 서버

주요 기능:
1. KSIC 코드 데이터 임포트
2. KSIC 데이터 검증
3. 기업-KSIC 자동 매핑
4. 전체 셋업 자동화

사용법:
    # 서버 시작
    python main.py

    # 또는 uvicorn 직접 실행
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

API 엔드포인트:
    GET  /                          - API 정보
    GET  /health                    - 헬스 체크
    POST /api/ksic/import           - KSIC 데이터 임포트
    GET  /api/ksic/validate         - KSIC 데이터 검증
    POST /api/ksic/map-companies    - 기업-KSIC 매핑
    POST /api/ksic/setup-all        - 전체 셋업 (1,2,3 모두 실행)
    GET  /api/ksic/stats            - KSIC 통계 조회
"""

import os
import sys
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

# 프로젝트 루트를 Python 경로에 추가
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed")

try:
    from fastapi import FastAPI, HTTPException, BackgroundTasks
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel, Field
except ImportError:
    print("Error: FastAPI not installed")
    print("Install: pip install fastapi uvicorn[standard]")
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
    description="KSIC 데이터 관리 및 기업 분류 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)


# ==================== Pydantic Models ====================

class ImportKSICRequest(BaseModel):
    """KSIC 임포트 요청 모델"""
    use_excel: bool = Field(True, description="엑셀 파일 사용 여부")


class ValidateKSICRequest(BaseModel):
    """KSIC 검증 요청 모델"""
    verbose: bool = Field(False, description="상세 검증 활성화")


class MapCompaniesRequest(BaseModel):
    """기업 매핑 요청 모델"""
    stock_codes: Optional[List[str]] = Field(None, description="특정 종목코드 리스트")
    unmapped_only: bool = Field(True, description="KSIC가 없는 기업만 매핑")
    batch_size: int = Field(100, description="배치 크기", ge=1, le=1000)
    dry_run: bool = Field(False, description="실제 업데이트 없이 테스트")


class SetupAllRequest(BaseModel):
    """전체 셋업 요청 모델"""
    skip_import: bool = Field(False, description="임포트 단계 건너뛰기")
    skip_validation: bool = Field(False, description="검증 단계 건너뛰기")
    skip_mapping: bool = Field(False, description="매핑 단계 건너뛰기")
    unmapped_only: bool = Field(True, description="매핑 시 KSIC 없는 기업만")


class APIResponse(BaseModel):
    """표준 API 응답 모델"""
    success: bool
    message: str
    data: Optional[Dict] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ==================== API Endpoints ====================

@app.get("/", response_model=Dict)
async def root():
    """API 정보"""
    return {
        "name": "Stock Platform API",
        "version": "1.0.0",
        "description": "KSIC 데이터 관리 및 기업 분류 API",
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "ksic_import": "POST /api/ksic/import",
            "ksic_validate": "GET /api/ksic/validate",
            "ksic_map_companies": "POST /api/ksic/map-companies",
            "ksic_setup_all": "POST /api/ksic/setup-all",
            "ksic_stats": "GET /api/ksic/stats"
        }
    }


@app.get("/health")
async def health_check():
    """헬스 체크"""
    try:
        # 환경변수 확인
        supabase_url = os.getenv("SUPABASE_URL")
        dart_api_key = os.getenv("DART_API_KEY")

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "env_check": {
                "supabase_url": bool(supabase_url),
                "dart_api_key": bool(dart_api_key)
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ksic/import", response_model=APIResponse)
async def import_ksic_data(request: ImportKSICRequest = None):
    """
    KSIC 코드 데이터 임포트

    - KSIC 엑셀 파일 또는 기본 데이터를 데이터베이스에 임포트
    - rule_table.py의 중분류 데이터와 통합
    """
    logger.info("KSIC 데이터 임포트 API 호출")

    try:
        # 임포터 초기화
        importer = KSICDataImporter()

        # 임포트 실행
        success = importer.run()

        if success:
            return APIResponse(
                success=True,
                message="KSIC 데이터 임포트 완료",
                data={
                    "imported": True,
                    "use_excel": request.use_excel if request else True
                }
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="KSIC 데이터 임포트 실패"
            )

    except Exception as e:
        logger.error(f"KSIC 임포트 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ksic/validate", response_model=APIResponse)
async def validate_ksic_data(verbose: bool = False):
    """
    KSIC 데이터 검증

    - KSIC 코드 형식 검증
    - 필수 필드 누락 검사
    - rule_table과 DB 일관성 검증
    - 기업-KSIC 매핑 상태 확인
    """
    logger.info("KSIC 데이터 검증 API 호출")

    try:
        # 검증기 초기화
        validator = KSICValidator(verbose=verbose)

        # 검증 실행
        success = validator.run()

        return APIResponse(
            success=success,
            message="KSIC 데이터 검증 완료" if success else "KSIC 데이터 검증 실패",
            data={
                "stats": validator.stats,
                "errors": validator.errors[:10],  # 최대 10개
                "warnings": validator.warnings[:10],  # 최대 10개
                "total_errors": len(validator.errors),
                "total_warnings": len(validator.warnings)
            }
        )

    except Exception as e:
        logger.error(f"KSIC 검증 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ksic/map-companies", response_model=APIResponse)
async def map_companies_to_ksic(request: MapCompaniesRequest):
    """
    기업-KSIC 자동 매핑

    - DART API를 통해 기업의 KSIC 코드 조회
    - companies 테이블 업데이트 (ksic_code, industry_category)
    - 배치 처리 및 진행률 추적
    """
    logger.info("기업-KSIC 매핑 API 호출")

    try:
        # 매퍼 초기화
        mapper = CompanyKSICMapper(dry_run=request.dry_run)

        # 매핑 실행
        success = mapper.run(
            stock_codes=request.stock_codes,
            unmapped_only=request.unmapped_only,
            batch_size=request.batch_size
        )

        return APIResponse(
            success=success,
            message="기업-KSIC 매핑 완료" if success else "기업-KSIC 매핑 실패",
            data={
                "stats": mapper.stats,
                "dry_run": request.dry_run
            }
        )

    except Exception as e:
        logger.error(f"기업-KSIC 매핑 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ksic/setup-all", response_model=APIResponse)
async def setup_all(request: SetupAllRequest = None):
    """
    KSIC 전체 셋업 (1, 2, 3 모두 실행)

    순서:
    1. KSIC 데이터 임포트 (import_ksic_data.py)
    2. KSIC 데이터 검증 (validate_ksic_data.py)
    3. 기업-KSIC 매핑 (map_companies_to_ksic.py)
    """
    logger.info("KSIC 전체 셋업 시작")

    if request is None:
        request = SetupAllRequest()

    results = {
        "import": {"skipped": True},
        "validate": {"skipped": True},
        "map": {"skipped": True}
    }

    try:
        # 1. KSIC 데이터 임포트
        if not request.skip_import:
            logger.info("Step 1/3: KSIC 데이터 임포트 중...")
            try:
                importer = KSICDataImporter()
                import_success = importer.run()
                results["import"] = {
                    "success": import_success,
                    "skipped": False
                }

                if not import_success:
                    logger.warning("KSIC 임포트 실패, 계속 진행...")

            except Exception as e:
                logger.error(f"KSIC 임포트 중 오류: {e}")
                results["import"] = {
                    "success": False,
                    "error": str(e),
                    "skipped": False
                }

        # 2. KSIC 데이터 검증
        if not request.skip_validation:
            logger.info("Step 2/3: KSIC 데이터 검증 중...")
            try:
                validator = KSICValidator()
                validate_success = validator.run()
                results["validate"] = {
                    "success": validate_success,
                    "stats": validator.stats,
                    "errors_count": len(validator.errors),
                    "warnings_count": len(validator.warnings),
                    "skipped": False
                }

                if not validate_success:
                    logger.warning("KSIC 검증 실패, 계속 진행...")

            except Exception as e:
                logger.error(f"KSIC 검증 중 오류: {e}")
                results["validate"] = {
                    "success": False,
                    "error": str(e),
                    "skipped": False
                }

        # 3. 기업-KSIC 매핑
        if not request.skip_mapping:
            logger.info("Step 3/3: 기업-KSIC 매핑 중...")
            try:
                mapper = CompanyKSICMapper(dry_run=False)
                map_success = mapper.run(
                    unmapped_only=request.unmapped_only,
                    batch_size=100
                )
                results["map"] = {
                    "success": map_success,
                    "stats": mapper.stats,
                    "skipped": False
                }

            except Exception as e:
                logger.error(f"기업-KSIC 매핑 중 오류: {e}")
                results["map"] = {
                    "success": False,
                    "error": str(e),
                    "skipped": False
                }

        # 전체 성공 여부 판단
        all_success = True
        for step, result in results.items():
            if not result.get("skipped", False):
                if not result.get("success", False):
                    all_success = False
                    break

        logger.info("KSIC 전체 셋업 완료")

        return APIResponse(
            success=all_success,
            message="KSIC 전체 셋업 완료" if all_success else "KSIC 셋업 중 일부 단계 실패",
            data=results
        )

    except Exception as e:
        logger.error(f"KSIC 전체 셋업 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ksic/stats", response_model=APIResponse)
async def get_ksic_stats():
    """
    KSIC 통계 조회

    - 전체 KSIC 코드 수
    - 업종별 분포
    - 기업 매핑 현황
    """
    logger.info("KSIC 통계 조회 API 호출")

    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise HTTPException(
                status_code=500,
                detail="SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 환경변수 누락"
            )

        supabase = create_client(supabase_url, supabase_key)

        # KSIC 코드 수
        ksic_response = supabase.table('ksic_codes').select('ksic_code', count='exact').execute()
        total_ksic = ksic_response.count if hasattr(ksic_response, 'count') else len(ksic_response.data or [])

        # 기업 수
        companies_response = supabase.table('companies').select('code', count='exact').execute()
        total_companies = companies_response.count if hasattr(companies_response, 'count') else len(companies_response.data or [])

        # 매핑된 기업 수
        mapped_response = supabase.table('companies')\
            .select('code', count='exact')\
            .not_.is_('ksic_code', 'null')\
            .execute()
        mapped_companies = mapped_response.count if hasattr(mapped_response, 'count') else len(mapped_response.data or [])

        # 매핑률
        mapping_rate = (mapped_companies / total_companies * 100) if total_companies > 0 else 0

        # 업종별 분포
        industry_response = supabase.table('ksic_codes').select('top_industry').execute()
        industry_dist = {}
        for record in (industry_response.data or []):
            industry = record.get('top_industry', '미분류')
            industry_dist[industry] = industry_dist.get(industry, 0) + 1

        return APIResponse(
            success=True,
            message="KSIC 통계 조회 완료",
            data={
                "ksic": {
                    "total_codes": total_ksic,
                    "industry_distribution": industry_dist
                },
                "companies": {
                    "total": total_companies,
                    "mapped": mapped_companies,
                    "unmapped": total_companies - mapped_companies,
                    "mapping_rate": round(mapping_rate, 2)
                }
            }
        )

    except Exception as e:
        logger.error(f"KSIC 통계 조회 중 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 서버 실행 ====================

if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 70)
    print("Stock Platform FastAPI Server")
    print("=" * 70)
    print()
    print("API 문서: http://localhost:8000/docs")
    print("ReDoc: http://localhost:8000/redoc")
    print()
    print("주요 엔드포인트:")
    print("  POST /api/ksic/setup-all       - 전체 셋업 (1,2,3 모두 실행)")
    print("  POST /api/ksic/import          - KSIC 데이터 임포트")
    print("  GET  /api/ksic/validate        - KSIC 데이터 검증")
    print("  POST /api/ksic/map-companies   - 기업-KSIC 매핑")
    print("  GET  /api/ksic/stats           - KSIC 통계")
    print()
    print("=" * 70)
    print()

    # 환경변수 확인
    required_vars = ["SUPABASE_URL", "DART_API_KEY"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        print(f"⚠️  경고: 다음 환경변수가 설정되지 않았습니다: {', '.join(missing_vars)}")
        print("   일부 기능이 작동하지 않을 수 있습니다.")
        print()

    # 서버 시작
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
