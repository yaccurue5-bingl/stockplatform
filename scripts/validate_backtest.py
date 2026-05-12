"""
scripts/validate_backtest.py
============================
???? ?? ? ?? ????

Task 1  : Alpha ??? ??? ?? (stock t0 vs benchmark t0)
Task 2  : BUYBACK ??? ?? ?? (raw event ?? + return)
Task 3  : Worst 10 BUYBACK trades
Task 4  : Mean / Median / Trimmed ?? ???
Task 5  : Distribution metrics (pct+, pct-, >5%, <-10%, max/min)
Task 6  : Diagnostic summary (? ??? ??)

???:
  python scripts/validate_backtest.py
  python scripts/validate_backtest.py --event BUYBACK   # ?? ??? ??
"""

import os, sys, math, statistics
from pathlib import Path
from collections import defaultdict

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

from supabase import create_client

def get_sb():
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)

# ?? ?? ??????????????????????????????????????????????????????????????????????

def median(vals):
    if not vals: return None
    sv = sorted(vals); n = len(sv); m = n // 2
    return sv[m] if n % 2 else (sv[m-1] + sv[m]) / 2

def trimmed_mean(vals, pct=0.10):
    """?? pct/2 ? ?? ? ?? (?? 10% ? ? 5%)"""
    if not vals: return None
    sv = sorted(vals); n = len(sv)
    cut = max(1, int(n * pct / 2))
    trimmed = sv[cut:-cut] if cut * 2 < n else sv
    return sum(trimmed) / len(trimmed) if trimmed else None

def std(vals):
    if len(vals) < 2: return 0.0
    m = sum(vals) / len(vals)
    return math.sqrt(sum((v - m) ** 2 for v in vals) / (len(vals) - 1))

def pct_fmt(v):
    if v is None: return "   N/A"
    return f"{v:+7.2f}%"

def paginate(sb, table, filters_fn, page_size=1000):
    rows, offset = [], 0
    while True:
        q = sb.table(table); q = filters_fn(q)
        q = q.range(offset, offset + page_size - 1)
        page = q.execute().data or []
        rows.extend(page)
        if len(page) < page_size: break
        offset += page_size
    return rows

# ?? ??? ?? ???????????????????????????????????????????????????????????????

def load_scores_log(sb):
    """scores_log ?? (future_return_5d IS NOT NULL)"""
    def _f(q):
        return q.select(
            "disclosure_id, stock_code, date, "
            "future_return_5d, future_return_20d, future_return_5d_open, mdd_20d"
        ).not_.is_("future_return_5d", "null")
    return paginate(sb, "scores_log", _f)

def load_disclosures_map(sb, disc_ids):
    """disclosure_id ? {event_type, corp_name, report_nm, rcept_dt, stock_code}"""
    result = {}
    chunk = 500
    for i in range(0, len(disc_ids), chunk):
        batch = disc_ids[i:i+chunk]
        resp = sb.table("disclosure_insights") \
            .select("id, event_type, corp_name, report_nm, rcept_dt, stock_code") \
            .in_("id", batch).execute()
        for r in (resp.data or []):
            result[r["id"]] = r
    return result

def load_index_history(sb, code):
    resp = sb.table("market_index_history").select("date, close") \
        .eq("index_code", code).not_.is_("close", "null").order("date").execute()
    return [(r["date"], float(r["close"])) for r in (resp.data or [])]

def load_market_types(sb):
    resp = sb.table("companies").select("stock_code, market_type").execute()
    return {r["stock_code"]: (r["market_type"] or "KOSPI") for r in (resp.data or []) if r.get("stock_code")}

# ?? ?? ?? (backfill_prices.py ? ?? ??) ??????????????????????????????

def build_alpha_lookup(closes, disc_dates, n_days):
    all_dates = [d for d, _ in closes]
    close_map  = {d: c for d, c in closes}
    result = {}
    for disc_date in set(disc_dates):
        t0 = next((d for d in all_dates if d > disc_date), None)
        if t0 is None: result[disc_date] = None; continue
        t0_idx = all_dates.index(t0)
        tn_idx = t0_idx + n_days
        if tn_idx >= len(all_dates): result[disc_date] = None; continue
        tn = all_dates[tn_idx]
        c0 = close_map[t0]; cn = close_map[tn]
        if not c0: result[disc_date] = None; continue
        result[disc_date] = round((cn / c0 - 1) * 100, 4)
    return result

# ?? Task 1: ??? ??? ?????????????????????????????????????????????????????

def task1_timing_check(log_rows, disc_map, kospi_closes):
    print("\n" + "="*70)
    print("TASK 1 -- Alpha Timing Alignment Check (BUYBACK sample)")
    print("="*70)

    all_dates = [d for d, _ in kospi_closes]
    close_map  = {d: c for d, c in kospi_closes}

    samples = []
    for row in log_rows:
        eid = row.get("disclosure_id")
        di  = disc_map.get(eid, {})
        if di.get("event_type") != "BUYBACK": continue
        disc_date = row.get("date")    # scores_log.date = raw rcept_dt ISO
        r5  = row.get("future_return_5d")
        r20 = row.get("future_return_20d")
        if r5 is None or not disc_date: continue

        # ???? t0
        t0_idx_list = [i for i, d in enumerate(all_dates) if d > disc_date]
        if not t0_idx_list: continue
        t0_idx = t0_idx_list[0]
        t5_idx = t0_idx + 5
        t20_idx = t0_idx + 20
        if t5_idx >= len(all_dates): continue

        t0  = all_dates[t0_idx]
        t5  = all_dates[t5_idx]
        t20 = all_dates[t20_idx] if t20_idx < len(all_dates) else None

        bm5  = round((close_map[t5]  / close_map[t0] - 1) * 100, 4)
        bm20 = round((close_map[t20] / close_map[t0] - 1) * 100, 4) if t20 else None

        samples.append({
            "disc_date": disc_date, "t0": t0, "t5": t5,
            "r5": r5, "bm5": bm5, "alpha5": r5 - bm5,
            "r20": r20, "bm20": bm20,
            "alpha20": (r20 - bm20) if r20 and bm20 else None,
            "corp": di.get("corp_name", "?"),
        })

    if not samples:
        print("  BUYBACK ?? ??")
        return

    print(f"  BUYBACK ??? {len(samples)}? ? ?? 5? ??? ??:")
    print(f"  {'disc_date':<12} {'t0(bm)':<12} {'t5(bm)':<12} {'r5_stock':>10} {'bm5':>10} {'?5':>10}")
    print(f"  {'-'*70}")
    for s in samples[:5]:
        print(f"  {s['disc_date']:<12} {s['t0']:<12} {s['t5']:<12} "
              f"{s['r5']:>+9.2f}%  {s['bm5']:>+8.2f}%  {s['alpha5']:>+8.2f}%  "
              f"({s['corp'][:12]})")

    print(f"\n  [??? ??]")
    print(f"  scores_log.date = raw rcept_dt (???) ? benchmark t0 = ?? ? ?? ???")
    print(f"  stock t0 = next_business_day(rcept_dt + 1?) -- ?? ?? ??? ?")
    print(f"  stock return = close(t0) ? close(t0+7cal), bm = close(t0) ? close(t0+5TD)")
    print(f"  ? 7 calendar days = ~5 trading days (?? ?? ??). ??? ?? ?.")

# ?? Task 2+3: BUYBACK ?? + Worst 10 ????????????????????????????????????????

def task2_buyback_samples(log_rows, disc_map, kospi_closes, kosdaq_closes, mtype_map):
    print("\n" + "="*70)
    print("TASK 2+3 -- BUYBACK Event Sample & Worst 10 Trades")
    print("="*70)

    all_dates_k  = [d for d, _ in kospi_closes];  cm_k  = {d: c for d, c in kospi_closes}
    all_dates_kq = [d for d, _ in kosdaq_closes]; cm_kq = {d: c for d, c in kosdaq_closes}

    def get_bm(disc_date, code, n):
        mtype = mtype_map.get(code, "KOSPI")
        all_d = all_dates_k if mtype == "KOSPI" else all_dates_kq
        cm    = cm_k        if mtype == "KOSPI" else cm_kq
        t0_candidates = [d for d in all_d if d > disc_date]
        if not t0_candidates: return None
        t0 = t0_candidates[0]
        t0i = all_d.index(t0)
        tni = t0i + n
        if tni >= len(all_d): return None
        tn = all_d[tni]
        return round((cm[tn] / cm[t0] - 1) * 100, 4)

    records = []
    for row in log_rows:
        eid = row.get("disclosure_id")
        di  = disc_map.get(eid, {})
        if di.get("event_type") != "BUYBACK": continue
        disc_date = row.get("date")
        code = row.get("stock_code", "")
        r5  = row.get("future_return_5d")
        r20 = row.get("future_return_20d")
        if r5 is None or not disc_date: continue
        bm5  = get_bm(disc_date, code, 5)
        bm20 = get_bm(disc_date, code, 20)
        a5   = (r5  - bm5)  if bm5  is not None else None
        a20  = (r20 - bm20) if r20 is not None and bm20 is not None else None
        records.append({
            "disc_date": disc_date, "code": code,
            "corp": di.get("corp_name", "?"),
            "report_nm": (di.get("report_nm") or "")[:40],
            "r5": r5, "r20": r20,
            "bm5": bm5, "bm20": bm20,
            "a5": a5, "a20": a20,
        })

    print(f"\n  BUYBACK ? {len(records)}?")

    # ?? 20? -- report_nm ?? ?? ?? ??
    print(f"\n  [?? 20? -- ??? ?? ??]")
    print(f"  {'??':<12} {'??':>8} {'r5':>8} {'a5':>8} {'r20':>8} {'a20':>8}  ????")
    print(f"  {'-'*90}")
    for r in records[:20]:
        print(f"  {r['disc_date']:<12} {r['code']:>8} "
              f"{r['r5']:>+7.1f}% {(r['a5'] or 0):>+7.1f}% "
              f"{(r['r20'] or 0):>+7.1f}% {(r['a20'] or 0):>+7.1f}%  "
              f"{r['report_nm']}")

    # Worst 10 by alpha20
    with_a20 = [r for r in records if r["a20"] is not None]
    worst10 = sorted(with_a20, key=lambda x: x["a20"])[:10]
    print(f"\n  [Worst 10 BUYBACK by Alpha 20D]")
    print(f"  {'??':<12} {'??':>8} {'corp':>16} {'r20':>8} {'bm20':>8} {'?20':>8}  ????")
    print(f"  {'-'*90}")
    for r in worst10:
        print(f"  {r['disc_date']:<12} {r['code']:>8} {r['corp'][:16]:>16} "
              f"{r['r20']:>+7.1f}% {r['bm20']:>+7.1f}% {r['a20']:>+7.1f}%  "
              f"{r['report_nm']}")

    # Best 10 by alpha20
    best10 = sorted(with_a20, key=lambda x: x["a20"], reverse=True)[:10]
    print(f"\n  [Best 10 BUYBACK by Alpha 20D]")
    print(f"  {'??':<12} {'??':>8} {'r20':>8} {'bm20':>8} {'?20':>8}  ????")
    print(f"  {'-'*90}")
    for r in best10:
        print(f"  {r['disc_date']:<12} {r['code']:>8} "
              f"{r['r20']:>+7.1f}% {r['bm20']:>+7.1f}% {r['a20']:>+7.1f}%  "
              f"{r['report_nm']}")

# ?? Task 4+5: Distribution + Mean/Median/Trimmed ?????????????????????????????

def task4_distribution(log_rows, disc_map, kospi_closes, kosdaq_closes, mtype_map):
    print("\n" + "="*70)
    print("TASK 4+5 -- Distribution Metrics & Mean/Median/Trimmed Comparison")
    print("="*70)

    # alpha ???
    disc_dates_all = [r.get("date", "") for r in log_rows if r.get("date")]

    k5  = build_alpha_lookup(kospi_closes,  disc_dates_all, 5)
    k20 = build_alpha_lookup(kospi_closes,  disc_dates_all, 20)
    kq5  = build_alpha_lookup(kosdaq_closes, disc_dates_all, 5)
    kq20 = build_alpha_lookup(kosdaq_closes, disc_dates_all, 20)

    # disc_id ? event
    all_ids = list({r["disclosure_id"] for r in log_rows if r.get("disclosure_id")})
    id_to_ev = {}
    sb = get_sb()
    chunk = 500
    for i in range(0, len(all_ids), chunk):
        resp = sb.table("disclosure_insights").select("id, event_type") \
            .in_("id", all_ids[i:i+chunk]).not_.is_("event_type", "null").execute()
        for r in (resp.data or []): id_to_ev[r["id"]] = r["event_type"]

    # ???? ??? ??
    ev_data = defaultdict(lambda: {"r5": [], "r20": [], "a5": [], "a20": []})

    for row in log_rows:
        eid  = row.get("disclosure_id")
        ev   = id_to_ev.get(eid)
        if not ev: continue
        disc_date = row.get("date", "")
        code = row.get("stock_code", "")
        r5   = row.get("future_return_5d")
        r20  = row.get("future_return_20d")
        if r5 is None: continue

        mtype = mtype_map.get(code, "KOSPI")
        a5_map  = k5  if mtype == "KOSPI" else kq5
        a20_map = k20 if mtype == "KOSPI" else kq20

        ev_data[ev]["r5"].append(r5)
        if r20 is not None: ev_data[ev]["r20"].append(r20)

        idx5 = a5_map.get(disc_date)
        if idx5 is not None and r5 is not None:
            ev_data[ev]["a5"].append(r5 - idx5)

        idx20 = a20_map.get(disc_date)
        if idx20 is not None and r20 is not None:
            ev_data[ev]["a20"].append(r20 - idx20)

    # ??? ??
    print(f"\n  [Mean vs Median vs Trimmed -- Return 20D]")
    print(f"  {'Event':>12} {'n':>5} {'Mean%':>8} {'Median%':>9} {'Trimmed%':>10} {'Std%':>8} {'MinGain':>9} {'MaxGain':>9}")
    print(f"  {'-'*80}")
    for ev in sorted(ev_data):
        r20 = ev_data[ev]["r20"]
        if len(r20) < 20: continue
        print(f"  {ev:>12} {len(r20):>5} "
              f"{(sum(r20)/len(r20)):>+7.2f}%  "
              f"{(median(r20) or 0):>+7.2f}%  "
              f"{(trimmed_mean(r20) or 0):>+8.2f}%  "
              f"{std(r20):>7.2f}%  "
              f"{min(r20):>+8.2f}%  "
              f"{max(r20):>+8.2f}%")

    print(f"\n  [Mean vs Median vs Trimmed -- Alpha 20D]")
    print(f"  {'Event':>12} {'n':>5} {'Mean ?':>8} {'Median ?':>9} {'Trimmed ?':>10} {'Std ?':>8} {'MinAlpha':>9} {'MaxAlpha':>9}")
    print(f"  {'-'*80}")
    for ev in sorted(ev_data):
        a20 = ev_data[ev]["a20"]
        if len(a20) < 20: continue
        print(f"  {ev:>12} {len(a20):>5} "
              f"{(sum(a20)/len(a20)):>+7.2f}%  "
              f"{(median(a20) or 0):>+7.2f}%  "
              f"{(trimmed_mean(a20) or 0):>+8.2f}%  "
              f"{std(a20):>7.2f}%  "
              f"{min(a20):>+8.2f}%  "
              f"{max(a20):>+8.2f}%")

    print(f"\n  [Distribution Metrics -- BUYBACK 20D Return]")
    bb_r20 = ev_data.get("BUYBACK", {}).get("r20", [])
    bb_a20 = ev_data.get("BUYBACK", {}).get("a20", [])
    if bb_r20:
        pos  = sum(1 for r in bb_r20 if r > 0)
        neg  = sum(1 for r in bb_r20 if r < 0)
        gt5  = sum(1 for r in bb_r20 if r > 5)
        ltm10 = sum(1 for r in bb_r20 if r < -10)
        print(f"  n={len(bb_r20)}  positive={pos}({pos/len(bb_r20)*100:.1f}%)  "
              f"negative={neg}({neg/len(bb_r20)*100:.1f}%)")
        print(f"  >+5%: {gt5}?({gt5/len(bb_r20)*100:.1f}%)  "
              f"<-10%: {ltm10}?({ltm10/len(bb_r20)*100:.1f}%)")
        print(f"  min={min(bb_r20):+.1f}%  max={max(bb_r20):+.1f}%  "
              f"mean={sum(bb_r20)/len(bb_r20):+.2f}%  median={median(bb_r20):+.2f}%  "
              f"trimmed={trimmed_mean(bb_r20):+.2f}%")
    if bb_a20:
        pos  = sum(1 for r in bb_a20 if r > 0)
        neg  = sum(1 for r in bb_a20 if r < 0)
        print(f"\n  Alpha 20D (n={len(bb_a20)}):")
        print(f"  positive alpha: {pos}({pos/len(bb_a20)*100:.1f}%)  "
              f"negative alpha: {neg}({neg/len(bb_a20)*100:.1f}%)")
        print(f"  min={min(bb_a20):+.1f}%  max={max(bb_a20):+.1f}%  "
              f"mean={sum(bb_a20)/len(bb_a20):+.2f}%  median={median(bb_a20):+.2f}%  "
              f"trimmed={trimmed_mean(bb_a20):+.2f}%")

    return ev_data

# ?? Task 6: ?? Diagnostic Summary ??????????????????????????????????????????

def task6_diagnostic_summary(ev_data):
    print("\n" + "="*70)
    print("TASK 6 -- Full Diagnostic Summary (All Event Types)")
    print("="*70)

    header = (
        f"  {'Event':>12} {'n5':>5} {'n_?20':>6} "
        f"{'hit5%':>7} {'hit20%':>7} "
        f"{'mean?5':>8} {'med?5':>8} {'trim?5':>8} "
        f"{'mean?20':>8} {'med?20':>8} {'trim?20':>8} "
        f"{'std_?20':>8}"
    )
    print(header)
    print(f"  {'-'*100}")

    for ev in sorted(ev_data):
        r5  = ev_data[ev]["r5"]
        r20 = ev_data[ev]["r20"]
        a5  = ev_data[ev]["a5"]
        a20 = ev_data[ev]["a20"]
        if len(r5) < 20: continue

        hit5  = sum(1 for r in r5  if r > 0) / len(r5)  * 100 if r5  else None
        hit20 = sum(1 for r in r20 if r > 0) / len(r20) * 100 if r20 else None

        ma5  = sum(a5)  / len(a5)  if a5  else None
        med5 = median(a5) if a5 else None
        tr5  = trimmed_mean(a5) if a5 else None

        ma20  = sum(a20)  / len(a20)  if a20  else None
        med20 = median(a20) if a20 else None
        tr20  = trimmed_mean(a20) if a20 else None
        s20   = std(a20) if a20 else None

        def f(v): return f"{v:+7.2f}%" if v is not None else "    N/A"

        print(
            f"  {ev:>12} {len(r5):>5} {len(a20):>6} "
            f"  {hit5:>5.1f}%  {(hit20 or 0):>5.1f}% "
            f" {f(ma5)} {f(med5)} {f(tr5)} "
            f" {f(ma20)} {f(med20)} {f(tr20)} "
            f" {f(s20)}"
        )

# ?? ?? ??????????????????????????????????????????????????????????????????????

def main():
    print("Backtest Validation Script")
    print("Loading data from Supabase...")

    sb = get_sb()

    log_rows = load_scores_log(sb)
    print(f"  scores_log: {len(log_rows)}? ??")

    disc_ids = list({r["disclosure_id"] for r in log_rows if r.get("disclosure_id")})
    disc_map = load_disclosures_map(sb, disc_ids)
    print(f"  disclosure_insights: {len(disc_map)}? ??")

    print("  market_index_history ?? ?...")
    kospi_closes  = load_index_history(sb, "KOSPI")
    kosdaq_closes = load_index_history(sb, "KOSDAQ")
    print(f"  KOSPI {len(kospi_closes)}? / KOSDAQ {len(kosdaq_closes)}?")

    mtype_map = load_market_types(sb)
    print(f"  market_type: {len(mtype_map)}??")

    # ?? ??? ?? ??????????????????????????????????????????????????????????
    task1_timing_check(log_rows, disc_map, kospi_closes)
    task2_buyback_samples(log_rows, disc_map, kospi_closes, kosdaq_closes, mtype_map)
    ev_data = task4_distribution(log_rows, disc_map, kospi_closes, kosdaq_closes, mtype_map)
    task6_diagnostic_summary(ev_data)

    print("\n" + "="*70)
    print("?? ??.")

if __name__ == "__main__":
    main()
