"""
backend/core/cache.py
=====================
비동기 캐시 레이어.

Redis 가 있으면 Redis, 없으면 in-process TTL dict 폴백.

환경변수:
  REDIS_URL   redis://host:port/db  (없으면 로컬 in-process 캐시 사용)

공개 API:
  make_cache_key(prefix, **params)  -> str
  cache_get(key)                    -> Any | None
  cache_set(key, value, ttl)        -> None
  cache_delete_pattern(pattern)     -> int  (삭제된 키 수)

TTL 상수 (엔드포인트별):
  TTL_DISCLOSURES    = 300    # 5 min  – 장 중 신규 공시 주기
  TTL_SECTOR_SIGNALS = 600    # 10 min – EOD 1회 갱신
  TTL_MARKET_RADAR   = 900    # 15 min – EOD 1회 갱신
  TTL_EVENTS         = 3600   # 60 min – event_stats 거의 불변

사용 예시:
  from backend.core.cache import make_cache_key, cache_get, cache_set, TTL_DISCLOSURES

  key = make_cache_key("v1:disclosures", plan=plan, dt_from=dt_from, ...)
  cached = await cache_get(key)
  if cached:
      return MyResponse(**cached)

  # ... Supabase 쿼리 ...

  await cache_set(key, result.model_dump(), TTL_DISCLOSURES)
  return result
"""

import hashlib
import json
import logging
import os
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ── Hit/Miss 집계 ─────────────────────────────────────────────────────────────
# 프로세스 재시작 시 초기화됨 (in-memory 통계)

_STATS: dict[str, int] = {"hit": 0, "miss": 0}


def get_cache_stats() -> dict:
    """현재 hit/miss 통계 반환."""
    total = _STATS["hit"] + _STATS["miss"]
    ratio = (_STATS["hit"] / total * 100) if total else 0.0
    return {"hit": _STATS["hit"], "miss": _STATS["miss"], "total": total, "hit_ratio": round(ratio, 1)}


# ── TTL 상수 ──────────────────────────────────────────────────────────────────

TTL_DISCLOSURES    = 300    # 5 min  — 장 중에도 신규 공시 유입 가능
TTL_SECTOR_SIGNALS = 600    # 10 min — compute_sector_signals 가 EOD에 1회 갱신
TTL_MARKET_RADAR   = 900    # 15 min — market_radar 는 EOD에 1회 갱신
TTL_EVENTS         = 3600   # 60 min — event_stats 는 backfill_prices --stats-only 후 갱신


def _log_ratio_if_needed() -> None:
    """100회마다 hit ratio를 INFO 로그로 출력."""
    total = _STATS["hit"] + _STATS["miss"]
    if total > 0 and total % 100 == 0:
        ratio = _STATS["hit"] / total * 100
        logger.info(f"[cache] hit ratio: {ratio:.1f}%  ({_STATS['hit']} hit / {total} total)")


# ── in-process TTL dict (Redis 없을 때 폴백) ──────────────────────────────────
# { key: (value, expire_at_monotonic) }
_LOCAL: dict[str, tuple[Any, float]] = {}


def _local_get(key: str) -> Optional[Any]:
    entry = _LOCAL.get(key)
    if entry:
        value, expire_at = entry
        if time.monotonic() < expire_at:
            return value
        del _LOCAL[key]
    return None


def _local_set(key: str, value: Any, ttl: int) -> None:
    _LOCAL[key] = (value, time.monotonic() + ttl)


def _local_delete_pattern(pattern: str) -> int:
    """단순 prefix* 패턴 삭제."""
    prefix = pattern.rstrip("*")
    targets = [k for k in list(_LOCAL.keys()) if k.startswith(prefix)]
    for k in targets:
        _LOCAL.pop(k, None)
    return len(targets)


# ── Redis 클라이언트 (lazy init, 1회만 연결 시도) ─────────────────────────────

_redis: Any = None           # redis.asyncio.Redis | None
_redis_initialized: bool = False


async def _get_redis():
    """
    Redis 클라이언트 반환.
    - REDIS_URL 없음 → None (로컬 캐시 사용)
    - 연결 실패      → None (로컬 캐시 폴백, 재시도 없음)
    - 연결 성공      → redis.asyncio.Redis 인스턴스 (이후 재사용)
    """
    global _redis, _redis_initialized
    if _redis_initialized:
        return _redis

    _redis_initialized = True
    url = os.getenv("REDIS_URL")
    if not url:
        logger.info("[cache] REDIS_URL 미설정 → in-process 캐시 사용")
        return None

    # Upstash REST URL(https://)은 Redis 프로토콜(rediss://)로 자동 변환
    token = os.getenv("REDIS_TOKEN")
    if url.startswith("https://") and token:
        host = url.replace("https://", "").rstrip("/")
        url = f"rediss://default:{token}@{host}:6379"
    elif url.startswith("https://"):
        logger.warning("[cache] Upstash REST URL이지만 REDIS_TOKEN 없음 → 로컬 캐시 사용")
        return None

    try:
        import redis.asyncio as aioredis  # type: ignore[import]

        client = aioredis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        await client.ping()
        _redis = client
        logger.info(f"[cache] Redis 연결 성공: {url[:30]}...")
    except ImportError:
        logger.warning("[cache] redis 패키지 없음 (pip install redis) → 로컬 캐시 사용")
    except Exception as e:
        logger.warning(f"[cache] Redis 연결 실패 ({e}) → 로컬 캐시 사용")

    return _redis


# ── 공개 API ──────────────────────────────────────────────────────────────────

def make_cache_key(prefix: str, **params) -> str:
    """
    캐시 키를 생성합니다.

    Args:
        prefix: 엔드포인트 식별자  (예: "v1:disclosures")
        **params: 쿼리 파라미터 전부 (plan 포함)

    Returns:
        "v1:disclosures:a3f9c12e8d41"  형태의 문자열

    Example:
        make_cache_key("v1:disclosures",
                       plan="pro", dt_from="20260301", dt_to="20260322",
                       stock_code="", sentiment="", sort_by="rcept_dt", limit=50)
    """
    raw = json.dumps(params, sort_keys=True, ensure_ascii=False, default=str)
    h = hashlib.sha256(raw.encode()).hexdigest()[:12]
    return f"{prefix}:{h}"


async def cache_get(key: str) -> Optional[Any]:
    """
    캐시에서 값을 조회합니다.
    Returns:
        저장된 Python 객체 (dict/list) 또는 None (미스/만료)
    """
    r = await _get_redis()
    if r:
        try:
            raw = await r.get(key)
            if raw:
                _STATS["hit"] += 1
                _log_ratio_if_needed()
                logger.debug(f"[cache] HIT (redis) {key}")
                return json.loads(raw)
        except Exception as e:
            logger.debug(f"[cache] redis get 오류: {e}")

    val = _local_get(key)
    if val is not None:
        _STATS["hit"] += 1
        _log_ratio_if_needed()
        logger.debug(f"[cache] HIT (local) {key}")
        return val

    _STATS["miss"] += 1
    _log_ratio_if_needed()
    return val


async def cache_set(key: str, value: Any, ttl: int) -> None:
    """
    캐시에 값을 저장합니다.

    Args:
        key:   make_cache_key() 로 생성한 키
        value: JSON 직렬화 가능한 Python 객체 (Pydantic .model_dump() 결과)
        ttl:   만료 시간 (초)
    """
    r = await _get_redis()
    if r:
        try:
            await r.setex(key, ttl, json.dumps(value, ensure_ascii=False, default=str))
            logger.debug(f"[cache] SET (redis) {key}  ttl={ttl}s")
            return
        except Exception as e:
            logger.debug(f"[cache] redis set 오류: {e}")

    _local_set(key, value, ttl)
    logger.debug(f"[cache] SET (local) {key}  ttl={ttl}s")


async def cache_delete_pattern(pattern: str) -> int:
    """
    패턴에 매칭되는 캐시 키를 일괄 삭제합니다.
    EOD 배치 완료 후 특정 엔드포인트 캐시를 강제 무효화할 때 사용합니다.

    Args:
        pattern: Redis KEYS 패턴  (예: "v1:disclosures:*", "v1:*")

    Returns:
        삭제된 키 수

    Example (배치 스크립트 맨 끝에서 호출):
        import asyncio
        from backend.core.cache import cache_delete_pattern
        asyncio.run(cache_delete_pattern("v1:disclosures:*"))
    """
    count = 0
    r = await _get_redis()
    if r:
        try:
            keys = [k async for k in r.scan_iter(match=pattern, count=200)]
            if keys:
                count = await r.delete(*keys)
                logger.info(f"[cache] 삭제 (redis) pattern={pattern!r} count={count}")
        except Exception as e:
            logger.debug(f"[cache] redis delete_pattern 오류: {e}")
        return count

    count = _local_delete_pattern(pattern)
    logger.info(f"[cache] 삭제 (local) pattern={pattern!r} count={count}")
    return count
