"""
backend/routers/health.py
=========================
서버 상태 확인 엔드포인트.
"""

from fastapi import APIRouter
from backend.core.config import get_supabase_url, get_supabase_service_key, get_dart_api_key

router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    return {"status": "online", "message": "Stock Platform API is running"}


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "env": {
            "supabase_url":         bool(get_supabase_url()),
            "supabase_service_key": bool(get_supabase_service_key()),
            "dart_api_key":         bool(get_dart_api_key()),
        },
    }
