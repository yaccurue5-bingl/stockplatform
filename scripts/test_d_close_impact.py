"""
scripts/test_d_close_impact.py
==============================
이벤트 타입별 gap / post 분리 테스트.

  return_gap  = (D+1 open - D close) / D close  → 이벤트 충격 (E_impact 기반)
  return_post = (D+5 close - D+1 open) / D+1 open → 이후 흐름 (E_rebound 기반, 현재 E-score)

목적:
  - gap / post 가 이벤트별로 의미있게 분리되는지 확인
  - E_impact (gap 기반) vs E_rebound (post 기반) 유효성 검토
"""

import os
import sys
import time
import math
import requests
from datetime import datetime, timedelta
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

try:
    from supabase import create_client
except ImportError:
    print("[ERROR] supabase 패키지 필요")
    sys.exit(1)

API_BASE  = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo"
PAGE_SIZE = 3000
SAMPLE_PER_TYPE = 30   # 이벤트 타입별 샘플 수

TARGET_EVENTS = ["DILUTION", "CONTRACT", "EARNINGS", "BUYBACK", "MNA"]


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def get_supabase():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def next_biz(d):
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def fetch_prices(bas_dt: str, api_key: str) -> dict[str, dict]:
    params = {
        "serviceKey": api_key,
        "numOfRows":  PAGE_SIZE,
        "pageNo":     1,
        "resultType": "json",
        "basDt":      bas_dt,
    }
    try:
        resp = requests.get(API_BASE, params=params, timeout=30)
        resp.raise_for_status()
        items = (resp.json()
                 .get("response", {})
                 .get("body", {})
                 .get("items", {})
                 .get("item", []))
    except Exception as e:
        print(f"  API 오류 [{bas_dt}]: {e}")
        return {}

    prices = {}
    for item in items:
        code = str(item.get("srtnCd") or "").strip().lstrip("A")
        clpr = item.get("clpr")
        mkp  = item.get("mkp")
        if code and clpr is not None:
            try:
                prices[code] = {
                    "close": float(clpr),
                    "open":  float(mkp) if mkp is not None else None,
                }
            except (ValueError, TypeError):
                pass
    return prices


def stats(vals: list[float]) -> dict:
    if not vals:
        return {"n": 0, "avg": 0, "med": 0, "hit": 0, "std": 0}
    n   = len(vals)
    avg = sum(vals) / n
    sv  = sorted(vals)
    med = sv[n // 2]
    std = math.sqrt(sum((v - avg) ** 2 for v in vals) / max(n - 1, 1))
    hit = sum(1 for v in vals if v > 0) / n * 100
    return {"n": n, "avg": round(avg, 2), "med": round(med, 2),
            "hit": round(hit, 1), "std": round(std, 2)}


def fmt(s: dict) -> str:
    if s["n"] == 0:
        return "데이터 없음"
    return (f"n={s['n']:3d}  avg={s['avg']:+6.2f}%  med={s['med']:+6.2f}%  "
            f"hit={s['hit']:5.1f}%  std={s['std']:.2f}")


# ── 데이터 로드 ───────────────────────────────────────────────────────────────

def load_samples(sb) -> dict[str, list[dict]]:
    """이벤트 타입별 샘플 로드 (중복 제거)."""

    # scores_log에서 future_return_5d_open 있는 것 풀 로드
    all_rows = []
    offset = 0
    while True:
        resp = (
            sb.table("scores_log")
            .select("stock_code, date, future_return_5d_open, disclosure_id")
            .not_.is_("future_return_5d_open", "null")
            .range(offset, offset + 999)
            .execute()
        )
        page = resp.data or []
        all_rows.extend(page)
        if len(page) < 1000:
            break
        offset += 1000

    # disclosure_id → (event_type, rcept_dt)
    disc_ids = list({r["disclosure_id"] for r in all_rows if r.get("disclosure_id")})
    id_to_info: dict[str, tuple[str, str]] = {}
    for i in range(0, len(disc_ids), 500):
        batch = disc_ids[i:i+500]
        dr = (
            sb.table("disclosure_insights")
            .select("id, event_type, rcept_dt")
            .in_("id", batch)
            .not_.is_("event_type", "null")
            .execute()
        )
        for r in (dr.data or []):
            if r.get("event_type") and r.get("rcept_dt"):
                id_to_info[r["id"]] = (r["event_type"], r["rcept_dt"])

    # 이벤트 타입별 분류 (중복 제거)
    by_type: dict[str, list[dict]] = {ev: [] for ev in TARGET_EVENTS}
    seen: set[tuple] = set()

    for row in all_rows:
        disc_id = row.get("disclosure_id")
        info = id_to_info.get(disc_id)
        if not info:
            continue
        ev_type, rcept_dt = info
        if ev_type not in TARGET_EVENTS:
            continue

        key = (row["stock_code"], rcept_dt)
        if key in seen:
            continue
        seen.add(key)

        d_date   = datetime.strptime(rcept_dt, "%Y%m%d").date()
        d1_date  = next_biz(d_date + timedelta(days=1))

        by_type[ev_type].append({
            "stock_code":  row["stock_code"],
            "rcept_dt":    rcept_dt,
            "d_date":      d_date.strftime("%Y%m%d"),
            "d1_date":     d1_date.strftime("%Y%m%d"),
            "post":        row["future_return_5d_open"],   # D+1 open → D+5 close
        })

    # 각 타입 SAMPLE_PER_TYPE건 제한
    return {ev: rows[:SAMPLE_PER_TYPE] for ev, rows in by_type.items()}


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    api_key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not api_key:
        print("[ERROR] PUBLIC_DATA_API_KEY 누락")
        sys.exit(1)

    sb = get_supabase()

    print("=" * 65)
    print("  이벤트별 gap / post 분리 테스트")
    print("  gap  = (D+1 open - D close) / D close  → E_impact")
    print("  post = (D+5 close - D+1 open) / D+1 open → E_rebound")
    print("=" * 65)

    # 1. 샘플 로드
    print("\n[1] DB 샘플 로드...")
    samples = load_samples(sb)
    for ev, rows in samples.items():
        print(f"  {ev}: {len(rows)}건")

    # 2. 필요한 날짜 수집
    needed: set[str] = set()
    for rows in samples.values():
        for r in rows:
            needed.add(r["d_date"])
            needed.add(r["d1_date"])

    # 3. 가격 조회
    print(f"\n[2] data.go.kr 가격 조회 ({len(needed)}일)...")
    price_cache: dict[str, dict] = {}
    for i, bas_dt in enumerate(sorted(needed), 1):
        print(f"  ({i}/{len(needed)}) {bas_dt}...", end=" ", flush=True)
        p = fetch_prices(bas_dt, api_key)
        price_cache[bas_dt] = p
        print(f"{len(p)}종목")
        time.sleep(1.0)

    # 4. gap / post 계산
    print("\n[3] 계산 중...")
    results: dict[str, dict] = {}

    for ev_type, rows in samples.items():
        gaps  = []
        posts = []

        for r in rows:
            d_entry  = price_cache.get(r["d_date"],  {}).get(r["stock_code"])
            d1_entry = price_cache.get(r["d1_date"], {}).get(r["stock_code"])

            d_close = (d_entry  or {}).get("close")
            d1_open = (d1_entry or {}).get("open")

            if not d_close or not d1_open:
                continue

            gap  = (d1_open - d_close) / d_close * 100
            post = r["post"]  # already in DB

            # ±50% 이상 이상치 제외
            if abs(gap) > 50 or abs(post) > 100:
                continue

            gaps.append(gap)
            posts.append(post)

        results[ev_type] = {"gap": stats(gaps), "post": stats(posts)}

    # 5. 출력
    print("\n" + "=" * 65)
    print(f"  {'':20s}  {'gap (E_impact)':^30s}  {'post (E_rebound)':^30s}")
    print(f"  {'이벤트 타입':20s}  {'avg':>7} {'med':>7} {'hit':>7}   {'avg':>7} {'med':>7} {'hit':>7}")
    print("  " + "-" * 61)

    for ev in TARGET_EVENTS:
        r = results.get(ev, {})
        g = r.get("gap",  {"n": 0, "avg": 0, "med": 0, "hit": 0})
        p = r.get("post", {"n": 0, "avg": 0, "med": 0, "hit": 0})
        if g["n"] == 0:
            continue
        print(f"  {ev:20s}  "
              f"{g['avg']:>+6.2f}% {g['med']:>+6.2f}% {g['hit']:>5.1f}%   "
              f"{p['avg']:>+6.2f}% {p['med']:>+6.2f}% {p['hit']:>5.1f}%")

    print("\n  ── 상세 ─────────────────────────────────────────────────")
    for ev in TARGET_EVENTS:
        r = results.get(ev, {})
        g = r.get("gap",  {})
        p = r.get("post", {})
        if not g.get("n"):
            continue
        print(f"\n  [{ev}]")
        print(f"    gap  (E_impact) : {fmt(g)}")
        print(f"    post (E_rebound): {fmt(p)}")

    print("\n" + "=" * 65)
    print("  해석 가이드")
    print("  gap  < 0 → 공시 후 갭다운 (시장 충격)")
    print("  gap  > 0 → 공시 후 갭업  (시장 호응)")
    print("  post > 0 → 진입 후 상승 (회복/추세)")
    print("  post < 0 → 진입 후 하락 (추가 하락)")
    print("=" * 65)


if __name__ == "__main__":
    main()
