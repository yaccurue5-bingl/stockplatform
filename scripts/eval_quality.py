"""
scripts/eval_quality.py
=======================
고위험 케이스 집중 품질 평가 — Gemini 2.5 Flash vs Groq llama-3.3-70b

샘플 구성 (100건):
  고위험 49건  : Groq가 틀리던 유형 (CAPEX→MNA오분류, DIVIDEND 오분류, DISPOSAL혼합, MNA혼합)
  정상 30건    : CONTRACT/BUYBACK/LEGAL (Groq 정확도 높던 유형)
  엣지케이스 21건: CAPEX일반(Groq도 MNA 오분류), DILUTION

사용법:
  python scripts/eval_quality.py              # 100건 전체
  python scripts/eval_quality.py --limit 20  # 빠른 테스트
  python scripts/eval_quality.py --dry-run   # DB 조회만, AI 호출 없음
  python scripts/eval_quality.py --out eval_result.json
"""

import os, sys, json, time, logging, argparse
from pathlib import Path
from datetime import datetime

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

try:
    from utils.env_loader import load_env
    load_env()
except Exception:
    from dotenv import load_dotenv
    for p in [_ROOT / ".env.local", _ROOT / ".env"]:
        if p.exists():
            load_dotenv(p); break

from supabase import create_client
from auto_analyst import AIAnalyst, _VALID_EVENT_TYPES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("eval_quality")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── 타겟 샘플 100건 (ID + label + expected_event_type) ────────────────────────
# label    : 샘플 그룹명
# expected : report_nm 기반 정답 (ground truth)
# groq_et  : DB에 저장된 Groq 분류 (analysis 당시)
TARGET_SAMPLES = [

    # ════ 고위험: CAPEX→MNA 오분류 (15건) ══════════════════════════════════════
    # 타법인주식및출자증권취득결정 → Groq가 MNA로 잘못 분류
    {"id":"183fc2be-6ecf-4ed2-9518-d1d26beefff8","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"3035ce50-9c99-4170-97f7-a6f0c8b013ff","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"3f78d246-0f8f-485f-b2d3-6d024a3b8e03","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"ac375270-408b-4c3c-ae9f-421d24367418","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"e24d0f23-9ca7-42aa-a999-dc72702b5fed","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"650d7c87-480f-4343-af3d-642c3e9c573b","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"4e611343-9a92-40eb-8bd4-268be44591a3","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"412c2577-27e1-427b-95e1-c6151508a989","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"94758eb2-bfca-40c3-bab0-6adbffc12375","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"c8aadf4a-e24e-4858-9258-8ca1fadc927e","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"bb5830bb-f82f-4cd6-878d-6083014a48ca","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"05a18b22-aaa5-4432-a7f5-74700290d1ae","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"83c1a1da-e179-4201-ab11-e5cfc5d9068b","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"0c29aee3-e9ed-4080-b343-6a6e76243b27","label":"CAPEX→MNA","expected":"CAPEX"},
    {"id":"20ac5187-3e89-4575-a587-b602de90716b","label":"CAPEX→MNA","expected":"CAPEX"},

    # ════ 고위험: 배당결정 → Groq가 OTHER로 분류 (10건) ════════════════════════
    {"id":"c040bc60-8e72-426e-8ff5-031f204b7986","label":"DIVIDEND→OTHER","expected":"DIVIDEND"},
    {"id":"83dd5b07-dc5c-4b98-b9d2-e1b92e857025","label":"DIVIDEND→OTHER","expected":"DIVIDEND"},
    {"id":"dfa4501e-2bad-4822-9fc1-740bcb354663","label":"DIVIDEND→OTHER","expected":"DIVIDEND"},
    {"id":"019703ed-6bb8-49a2-8691-4a3edfef9433","label":"DIVIDEND→OTHER","expected":"DIVIDEND"},
    {"id":"f9b3e46d-25c4-4f23-8bb3-2ff6caa3d5fd","label":"DIVIDEND→OTHER","expected":"DIVIDEND"},
    {"id":"3d7c4ee3-9818-42b2-ae6d-e96f6492725b","label":"DIVIDEND→OTHER","expected":"DIVIDEND"},
    {"id":"beb7d6fa-13b1-4746-8194-ffa79e93e1c8","label":"DIVIDEND→OTHER","expected":"DIVIDEND"},
    {"id":"15daec48-66f9-44d8-84d8-94d387439edb","label":"DIVIDEND→OTHER","expected":"DIVIDEND"},
    {"id":"8c52a454-38a1-4723-99ef-3108fff1eb11","label":"DIVIDEND→OTHER","expected":"DIVIDEND"},
    {"id":"d2f5b727-08cc-4522-b00b-4c7adda67de3","label":"DIVIDEND→OTHER","expected":"DIVIDEND"},

    # ════ 고위험: 배당결정 → Groq가 EARNINGS로 분류 (8건) ══════════════════════
    {"id":"5a4b2184-23d5-4bae-8a0e-6db9f57cdd29","label":"DIVIDEND→EARNINGS","expected":"DIVIDEND"},
    {"id":"e433c344-a9b6-4685-96d2-314cf9f8694d","label":"DIVIDEND→EARNINGS","expected":"DIVIDEND"},
    {"id":"a3be2827-aa3c-47f1-91a9-9e2ad57aaeb7","label":"DIVIDEND→EARNINGS","expected":"DIVIDEND"},
    {"id":"b02af83f-fd1e-4eeb-844f-b039ac0c1373","label":"DIVIDEND→EARNINGS","expected":"DIVIDEND"},
    {"id":"d4d8bd62-e24a-4a37-af03-5fd560efc107","label":"DIVIDEND→EARNINGS","expected":"DIVIDEND"},
    {"id":"beacfdab-094f-492d-bd02-c83ecece36ce","label":"DIVIDEND→EARNINGS","expected":"DIVIDEND"},
    {"id":"5e747afb-778e-4ff0-9ed8-e721a9909211","label":"DIVIDEND→EARNINGS","expected":"DIVIDEND"},
    {"id":"598682bb-9fe8-4007-9180-f6f17f3f8f16","label":"DIVIDEND→EARNINGS","expected":"DIVIDEND"},

    # ════ 고위험: 자기주식처분결정 혼합 (10건, 정답·오답 섞임) ═════════════════
    {"id":"549af1d2-9e68-48fd-b93d-104afe618b16","label":"DISPOSAL혼합","expected":"DISPOSAL"},
    {"id":"5179e989-8e42-4cfd-9f75-c82f0efaedd1","label":"DISPOSAL혼합","expected":"DISPOSAL"},
    {"id":"29442f65-7299-4a14-b588-18b7423c7333","label":"DISPOSAL혼합","expected":"DISPOSAL"},
    {"id":"a099a678-716b-402d-8f36-3b243af9bda9","label":"DISPOSAL혼합","expected":"DISPOSAL"},
    {"id":"57d9f4f4-3775-4613-98c3-5f876780b50e","label":"DISPOSAL혼합","expected":"DISPOSAL"},
    {"id":"6ce2139b-939d-4aa8-ae30-f8ec6623474b","label":"DISPOSAL혼합","expected":"DISPOSAL"},
    {"id":"81fef20a-c19b-4afd-89a7-5132c2e08769","label":"DISPOSAL혼합","expected":"DISPOSAL"},
    {"id":"4475736e-1987-4e94-9098-c38c8c64d085","label":"DISPOSAL혼합","expected":"DISPOSAL"},
    {"id":"be2b959c-13f5-4f11-9ba7-95bc75b76644","label":"DISPOSAL혼합","expected":"DISPOSAL"},
    {"id":"084bd368-f0b1-4d3d-98d1-b032bc9bb316","label":"DISPOSAL혼합","expected":"DISPOSAL"},

    # ════ 고위험: 합병결정 혼합 (6건) ══════════════════════════════════════════
    {"id":"ae997a3d-7147-49c6-90a9-0d8966d3b32e","label":"MNA혼합","expected":"MNA"},
    {"id":"dbea6944-23fd-4bde-8fa9-13759dcce6bd","label":"MNA혼합","expected":"MNA"},
    {"id":"425b49c7-1788-44db-800b-32795559fa2a","label":"MNA혼합","expected":"MNA"},
    {"id":"37fe7841-9091-4a60-af8e-53ec37cdf22f","label":"MNA혼합","expected":"MNA"},
    {"id":"c155059e-96ed-4421-b764-ca8cd2285c31","label":"MNA혼합","expected":"MNA"},
    {"id":"e6c8c129-6dc8-4cb0-834f-931a14e322b7","label":"MNA혼합","expected":"MNA"},

    # ════ 정상: 단일판매·공급계약 (10건, Groq 99.9% 정확) ══════════════════════
    {"id":"471a1eb4-edbd-4f9b-aa8a-190acfefb081","label":"CONTRACT정상","expected":"CONTRACT"},
    {"id":"c1206057-4ba6-467b-b587-9bf34c9d8677","label":"CONTRACT정상","expected":"CONTRACT"},
    {"id":"39d2eae3-7daa-4507-a486-841cf3b4afb1","label":"CONTRACT정상","expected":"CONTRACT"},
    {"id":"7466747e-2b4d-44d1-b89a-1503561bea64","label":"CONTRACT정상","expected":"CONTRACT"},
    {"id":"dc7b312c-e077-451d-9148-3f1ac48f3942","label":"CONTRACT정상","expected":"CONTRACT"},
    {"id":"f622eb64-3f93-4a49-8d07-e2bd1a6f57cf","label":"CONTRACT정상","expected":"CONTRACT"},
    {"id":"72d58cde-240e-43e6-abd6-f23eaa393b85","label":"CONTRACT정상","expected":"CONTRACT"},
    {"id":"11bac267-d46f-44e4-b10e-b30e423ae075","label":"CONTRACT정상","expected":"CONTRACT"},
    {"id":"68746c3b-94c9-44f8-96cd-62c23418e556","label":"CONTRACT정상","expected":"CONTRACT"},
    {"id":"f41ee53f-b17e-4143-873e-4aa0e5ee4b37","label":"CONTRACT정상","expected":"CONTRACT"},

    # ════ 정상: 자기주식취득 (10건, Groq 100% 정확) ════════════════════════════
    {"id":"95be5e37-bdd4-454b-a004-d334eea41404","label":"BUYBACK정상","expected":"BUYBACK"},
    {"id":"9e43ff67-b7ed-41d4-80c8-c06d94d89518","label":"BUYBACK정상","expected":"BUYBACK"},
    {"id":"7fdbaded-e829-4f6c-9917-588aec97a266","label":"BUYBACK정상","expected":"BUYBACK"},
    {"id":"ba2e6fb4-79e3-42ee-b90c-f69fd62b909b","label":"BUYBACK정상","expected":"BUYBACK"},
    {"id":"592d6426-5dae-49d7-865c-814481c2c42a","label":"BUYBACK정상","expected":"BUYBACK"},
    {"id":"e1f710c1-f772-43f2-bc47-c7f9a8b1859f","label":"BUYBACK정상","expected":"BUYBACK"},
    {"id":"24d89fbb-3ccb-4130-a656-1438c2377f08","label":"BUYBACK정상","expected":"BUYBACK"},
    {"id":"945b8e50-ffcf-4aa6-bf23-c8c4a9416de9","label":"BUYBACK정상","expected":"BUYBACK"},
    {"id":"1dd662b0-98d5-424b-ab62-9a36d51e5e0b","label":"BUYBACK정상","expected":"BUYBACK"},
    {"id":"e03e3435-a12f-4ba1-a9ad-b107346bc7a7","label":"BUYBACK정상","expected":"BUYBACK"},

    # ════ 정상: 소송판결 (10건, Groq 100% 정확) ════════════════════════════════
    {"id":"b409b319-51fe-48cd-a46b-477a3f35fbe9","label":"LEGAL정상","expected":"LEGAL"},
    {"id":"25839de6-201b-407a-9942-09f6d7c729d0","label":"LEGAL정상","expected":"LEGAL"},
    {"id":"1c95ae43-9ea3-4804-80b2-be7acfdb6cd1","label":"LEGAL정상","expected":"LEGAL"},
    {"id":"af4460a7-e91a-4f98-98b3-f9fdd38d8d92","label":"LEGAL정상","expected":"LEGAL"},
    {"id":"92ce749f-9405-4d45-8d8a-050d46504169","label":"LEGAL정상","expected":"LEGAL"},
    {"id":"5fcd6ce1-9462-4751-a67d-423f1321ad03","label":"LEGAL정상","expected":"LEGAL"},
    {"id":"59e7f52e-f97d-4ba3-b9e4-58cdd4e0fb25","label":"LEGAL정상","expected":"LEGAL"},
    {"id":"4110f08b-a9ca-4705-a2c1-e82c5c5e8781","label":"LEGAL정상","expected":"LEGAL"},
    {"id":"0896d666-c56d-4744-b000-9536f4da39d5","label":"LEGAL정상","expected":"LEGAL"},
    {"id":"ee0b7961-6f89-44d5-8504-e6110edc9e26","label":"LEGAL정상","expected":"LEGAL"},

    # ════ 엣지케이스: 유형자산취득결정 (10건, Groq도 MNA로 오분류 다수) ══════════
    {"id":"ebaeef16-763b-4a29-afa0-1b3d19f79f36","label":"CAPEX일반","expected":"CAPEX"},
    {"id":"de344d3f-0db5-4fd8-a283-7345a22a35ba","label":"CAPEX일반","expected":"CAPEX"},
    {"id":"980a773f-d8a2-4664-a5e2-0256bb22efb3","label":"CAPEX일반","expected":"CAPEX"},
    {"id":"a365bd18-0049-4a4c-ace0-b12b28d4968c","label":"CAPEX일반","expected":"CAPEX"},
    {"id":"c80a6ee4-6067-487c-8343-30eca5561fc1","label":"CAPEX일반","expected":"CAPEX"},
    {"id":"3d6d1c82-1773-4eba-aab2-7c38971d717e","label":"CAPEX일반","expected":"CAPEX"},
    {"id":"0125f1b5-69fa-40b6-8911-25c1b8e33883","label":"CAPEX일반","expected":"CAPEX"},
    {"id":"7fcc28e3-a9b9-4346-8965-91d08c051d64","label":"CAPEX일반","expected":"CAPEX"},
    {"id":"60fdbd4b-7a71-495b-89ca-8408c81c02e3","label":"CAPEX일반","expected":"CAPEX"},
    {"id":"c0ce1e2e-d25a-4d97-9a6b-6a09a6e98ce5","label":"CAPEX일반","expected":"CAPEX"},

    # ════ 엣지케이스: 유상증자결정 (11건, Groq 99.7% 정확 — baseline) ════════════
    {"id":"121c6a40-6fd9-4586-9f8f-e94cdf57f6fd","label":"DILUTION정상","expected":"DILUTION"},
    {"id":"ed7a303c-4fa3-484a-9ef2-c3f258ff1f34","label":"DILUTION정상","expected":"DILUTION"},
    {"id":"8ac8de0e-b0cd-4765-b336-01dc5ebe3aa3","label":"DILUTION정상","expected":"DILUTION"},
    {"id":"4d7ac0ae-57fa-4250-9939-78e5b948add1","label":"DILUTION정상","expected":"DILUTION"},
    {"id":"44198b9d-9625-43bf-82cc-b9a41304e587","label":"DILUTION정상","expected":"DILUTION"},
    {"id":"ff91c5c0-3e91-41b7-a33a-ca227668f23a","label":"DILUTION정상","expected":"DILUTION"},
    {"id":"8ca15e0a-9f0c-4556-851a-eb8435248eb5","label":"DILUTION정상","expected":"DILUTION"},
    {"id":"fc6bcd87-3674-4b47-bb82-f421efcd46c8","label":"DILUTION정상","expected":"DILUTION"},
    {"id":"3140393e-7fbb-4c74-9382-7d95b031d109","label":"DILUTION정상","expected":"DILUTION"},
    {"id":"3c4203a5-6ab6-42ec-959b-1fa0a7dec696","label":"DILUTION정상","expected":"DILUTION"},
    {"id":"91b7bb46-1a56-498f-827b-59dd2939386f","label":"DILUTION정상","expected":"DILUTION"},
]

# ── DB 조회 (ID 기반, 빠름) ────────────────────────────────────────────────────
def fetch_by_ids(samples: list[dict]) -> list[dict]:
    """ID로 content + 메타데이터 일괄 조회. 50건씩 배치."""
    id_meta = {s["id"]: s for s in samples}
    all_ids = list(id_meta.keys())
    result_map: dict[str, dict] = {}

    batch_size = 50
    for i in range(0, len(all_ids), batch_size):
        batch = all_ids[i:i+batch_size]
        rows = sb.table("disclosure_insights") \
            .select("id,corp_name,stock_code,report_nm,event_type,content,rcept_dt,final_score") \
            .in_("id", batch) \
            .execute().data or []
        for r in rows:
            meta = id_meta[r["id"]]
            r["_label"]    = meta["label"]
            r["_expected"] = meta["expected"]
            r["_groq_et"]  = r.get("event_type")
            result_map[r["id"]] = r

    # 원래 순서 유지
    ordered = []
    for s in samples:
        if s["id"] in result_map:
            ordered.append(result_map[s["id"]])
        else:
            log.warning(f"  ID 없음: {s['id']} ({s['label']})")
    return ordered


# ── Gemini 호출 (DB 쓰기 없음) ───────────────────────────────────────────────
def gemini_classify(analyst: AIAnalyst, row: dict) -> dict | None:
    try:
        result = analyst.analyze_content(
            corp_name=row.get("corp_name", "?"),
            report_nm=row.get("report_nm", ""),
            content=row.get("content", ""),
        )
        if not result:
            return None
        raw_et = (result.get("event_type") or "").strip().upper()
        if raw_et not in _VALID_EVENT_TYPES:
            result["_invalid_raw"] = raw_et
            result["event_type"] = "OTHER"
        return result
    except Exception as e:
        log.error(f"  Gemini 오류 [{row.get('corp_name')}]: {e}")
        return None


# ── 결과 출력 ─────────────────────────────────────────────────────────────────
def print_results(records: list[dict]) -> None:
    done_records = [r for r in records if r.get("_gemini_et")]
    n_done = len(done_records)
    n_total = len(records)

    print("\n" + "=" * 120)
    print(f"{'#':>3}  {'label':<18} {'종목':<14} {'report_nm':<32} {'expected':<14} {'Groq':<14} {'Gemini':<14} 판정")
    print("=" * 120)

    groq_correct  = 0
    gemini_correct = 0
    groq_invalid_raw = 0
    gemini_invalid_raw = 0

    type_stats: dict[str, dict] = {}

    for i, r in enumerate(records, 1):
        exp       = r.get("_expected") or "?"
        groq_et   = r.get("_groq_et")  or "?"
        gemini_et = r.get("_gemini_et") or "—"
        label     = r.get("_label", "")
        inv_raw   = r.get("_gemini_inv_raw", "")

        g_ok = (groq_et   == exp)
        m_ok = (gemini_et == exp)
        if g_ok: groq_correct   += 1
        if m_ok: gemini_correct += 1
        if inv_raw: gemini_invalid_raw += 1

        # 판정 기호
        if gemini_et == "—":
            sym = "💀FAIL"
        elif m_ok and g_ok:
            sym = "✅둘다OK"
        elif m_ok and not g_ok:
            sym = "🔧GEM고침"   # Gemini가 Groq 오류 수정
        elif not m_ok and g_ok:
            sym = "⚠️GEM틀림"   # Gemini가 새로 틀림
        elif groq_et == gemini_et:
            sym = "❌둘다틀"
        else:
            sym = "🔄둘다틀(다)"

        corp  = (r.get("corp_name") or "")[:12]
        rnm   = (r.get("report_nm") or "").strip()[:30]
        print(f"{i:>3}  {label:<18} {corp:<14} {rnm:<32} {exp:<14} {groq_et:<14} {gemini_et:<14} {sym}")

        ts = type_stats.setdefault(label, {"n":0,"groq_ok":0,"gem_ok":0,"groq_fail":0,"gem_fix":0,"gem_break":0,"fail":0})
        ts["n"] += 1
        if g_ok:  ts["groq_ok"] += 1
        if m_ok:  ts["gem_ok"]  += 1
        if not g_ok: ts["groq_fail"] += 1
        if m_ok and not g_ok: ts["gem_fix"]   += 1  # Gemini가 Groq 오류 수정
        if not m_ok and g_ok: ts["gem_break"] += 1  # Gemini가 새로 틀림
        if gemini_et == "—":  ts["fail"]      += 1

    print("=" * 120)
    n_eff = n_done or 1

    print(f"""
📊 전체 결과 ({n_done}/{n_total}건 Gemini 완료)
{'─'*60}
모델                  정확도(vs report_nm)     invalid enum (강제→OTHER 전)
Groq llama-3.3-70b   {groq_correct:>3}/{n_total} = {groq_correct/n_total*100:.1f}%         0 (DB 저장 기준, 이미 강제)
Gemini 2.5 Flash     {gemini_correct:>3}/{n_eff} = {gemini_correct/n_eff*100:.1f}%         {gemini_invalid_raw} raw invalid (→OTHER 강제됨)
""")

    print("📋 유형별 상세\n")
    print(f"{'label':<20} {'N':>4} {'Groq%':>7} {'Gem%':>7} {'Gem수정':>7} {'Gem신규오류':>10} 해설")
    print("─" * 75)
    for lbl, ts in type_stats.items():
        n2 = ts["n"] or 1
        groq_pct = ts["groq_ok"]/n2*100
        gem_pct  = ts["gem_ok"] /n2*100
        fix_pct  = ts["gem_fix"]/n2*100
        brk_pct  = ts["gem_break"]/n2*100

        if lbl.endswith("정상"):
            note = "✅ baseline" if gem_pct >= groq_pct - 5 else "⚠️ 퇴보"
        elif "오분류" in lbl or "→" in lbl:
            note = f"🔧 {ts['gem_fix']}건 수정" if ts["gem_fix"] > 0 else "❌ 미개선"
        else:
            note = ""

        print(
            f"{lbl:<20} {ts['n']:>4} "
            f"{groq_pct:>6.1f}% "
            f"{gem_pct:>6.1f}% "
            f"{fix_pct:>6.1f}% "
            f"{brk_pct:>9.1f}%  {note}"
        )

    print("\n💡 핵심 지표")
    total_groq_fail = sum(ts["groq_fail"] for ts in type_stats.values())
    total_gem_fix   = sum(ts["gem_fix"]   for ts in type_stats.values())
    total_gem_break = sum(ts["gem_break"] for ts in type_stats.values())
    print(f"  Groq 오류 총 {total_groq_fail}건 중 Gemini가 수정한 건: {total_gem_fix}건 ({total_gem_fix/max(total_groq_fail,1)*100:.1f}%)")
    print(f"  Groq가 맞췄지만 Gemini가 틀린 건(신규 오류): {total_gem_break}건")
    net = total_gem_fix - total_gem_break
    print(f"  순 개선: {net:+d}건 ({'✅ Gemini 우세' if net > 0 else '⚠️ 동등/퇴보'})")


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    # Windows 콘솔 인코딩 문제 방지 (Korean/emoji UnicodeEncodeError)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit",   type=int,   default=100, help="실행할 샘플 수 (기본 100)")
    parser.add_argument("--sleep",   type=float, default=4.0, help="API 콜 간격(초)")
    parser.add_argument("--out",     type=str,   default="eval_result.json",  help="결과 JSON 파일 경로")
    parser.add_argument("--dry-run", action="store_true",     help="DB 조회만, Gemini 미호출")
    args = parser.parse_args()

    samples = TARGET_SAMPLES[:args.limit]
    log.info(f"Target quality eval | {len(samples)} samples | dry_run={args.dry_run}")

    log.info("  Fetching content from DB...")
    records = fetch_by_ids(samples)
    log.info(f"  Loaded {len(records)} records")

    if args.dry_run:
        print(f"\n{'label':<20} {'corp_name':<16} {'report_nm':<34} groq_et     expected")
        print("-" * 90)
        for r in records:
            print(f"{r['_label']:<20} {r.get('corp_name','')[:14]:<16} {(r.get('report_nm') or '').strip()[:32]:<34} {r['_groq_et']:<12} {r['_expected']}")
        print(f"\nTotal {len(records)} records. --dry-run: no Gemini calls.")
        return

    analyst = AIAnalyst()
    total = len(records)

    for i, row in enumerate(records, 1):
        log.info(f"  [{i:>3}/{total}] {row.get('corp_name','')[:14]:<14} | {(row.get('report_nm') or '').strip()[:32]}")
        result = gemini_classify(analyst, row)
        if result:
            row["_gemini_et"]      = result.get("event_type", "OTHER")
            row["_gemini_score"]   = result.get("sentiment_score")
            row["_gemini_inv_raw"] = result.get("_invalid_raw", "")
        else:
            row["_gemini_et"] = None
        time.sleep(args.sleep)

    # JSON 저장 먼저 (print 오류와 무관하게 데이터 보존)
    if args.out:
        out_path = Path(args.out)
        safe = [{k: v for k, v in r.items() if k != "content"} for r in records]
        out_path.write_text(json.dumps(safe, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info(f"Saved: {out_path}")

    try:
        print_results(records)
    except Exception as e:
        log.error(f"print_results error: {e}")
        log.info(f"Data saved to {args.out} — open it for full results.")


if __name__ == "__main__":
    main()
