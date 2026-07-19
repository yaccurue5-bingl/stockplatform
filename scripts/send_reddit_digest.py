"""
scripts/send_reddit_digest.py
==============================
Reddit용 초안(제목+본문) 이메일 다이제스트 — 매일 발송 (X 다이제스트와 동일 주기).

X 트윗과 달리 Reddit은 해시태그/이모지 위주 홍보체를 스팸으로 간주해 자동 삭제되거나
계정이 밴될 수 있어 (self-promotion 규정), 완전히 다른 포맷을 쓴다:
  - 해시태그 없음, 이모지 최소화
  - 디스커션 스타일 본문 (무슨 일이 있었는지 → 핵심 수치 → 왜 중요한지)
  - 가장 눈에 띄는 시그널 1건만 선정

Reddit 게시 여부는 tweeted_at과 별개로 reddit_posted_at 컬럼으로 추적한다
(같은 시그널이 X/Reddit 양쪽에 골라져도 무방 — 플랫폼이 다르므로 중복 게시 아님).

Usage
-----
  python scripts/send_reddit_digest.py               # 매일 실제 발송
  python scripts/send_reddit_digest.py --dry-run     # 미리보기만
  python scripts/send_reddit_digest.py --min-score 0.5 --lookback-days 5

Required env vars (.env.local)
------------------------------
  RESEND_API_KEY=re_...
  NEXT_PUBLIC_SUPABASE_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...
"""

import os
import sys
import re
import time
import hmac
import hashlib
import argparse
import logging
from datetime import date, timedelta
from pathlib import Path

# ── Path / env setup ─────────────────────────────────────────────────────────
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

try:
    from utils.env_loader import load_env
    load_env()
except Exception:
    from dotenv import load_dotenv
    local_env = _ROOT / ".env.local"
    load_dotenv(local_env if local_env.exists() else None)

# Reuse formatting helpers from post_tweet.py (company name cleanup, KRW compaction, etc.)
from post_tweet import (  # noqa: E402
    clean_corp_name, compact_krw, _strip_corp_prefix, _strengthen_headline,
    _normalize_headline_case, _KR, _trunc,
)

import requests
from supabase import create_client, Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("reddit_digest")

_sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
_sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(_sb_url, _sb_key)

RECIPIENT  = "yaccurue5@gmail.com"
FROM_EMAIL = "KMI Signals <noreply@k-marketinsight.com>"
SIGNAL_URL = "https://k-marketinsight.com/signal"
DART_URL   = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo="

EVENT_LABELS: dict[str, str] = {
    "EARNINGS":         "Earnings Release",
    "CONTRACT":         "Strategic Contract",
    "DILUTION":         "Capital Increase / Dilution",
    "BUYBACK":          "Share Buyback",
    "DISPOSAL":         "Treasury Share Disposal",
    "DIVIDEND":         "Dividend",
    "MNA":              "M&A / Merger",
    "LEGAL":            "Legal / Regulatory",
    "CAPEX":            "Capital Investment",
    "EXECUTIVE_CHANGE": "Executive Change",
}
# OTHER 제외 (X와 동일 — 노이즈성 공시)
REDDIT_EVENT_TYPES = frozenset(EVENT_LABELS.keys())


# ── Fetch pending queue (reddit_posted_at 기준, tweeted_at과 독립) ────────────

def fetch_reddit_queue(min_score: float, lookback_days: int, limit: int) -> list[dict]:
    cutoff_dt = (date.today() - timedelta(days=lookback_days)).strftime("%Y%m%d")

    res = (
        supabase.table("disclosure_insights")
        .select(
            "id, corp_name, corp_name_en, stock_code, rcept_no, "
            "headline, key_numbers, event_type, ai_summary, financial_impact, "
            "sentiment_score, final_score, rcept_dt"
        )
        .eq("analysis_status", "completed")
        .eq("is_visible", True)
        .is_("reddit_posted_at", "null")
        .gte("rcept_dt", cutoff_dt)
        .in_("event_type", list(REDDIT_EVENT_TYPES))
        .order("final_score", desc=True)
        .limit(limit * 5)  # 클라이언트 필터링 여유분
        .execute()
    )

    rows = res.data or []
    filtered = []
    for r in rows:
        if r.get("sentiment_score") is None:
            continue
        if abs(float(r["sentiment_score"])) < min_score:
            continue

        corp_en = (r.get("corp_name_en") or "").strip()
        if not corp_en:
            continue

        headline_text = r.get("headline") or ""
        summary_text = r.get("ai_summary") or ""
        kn_text = " ".join(r.get("key_numbers") or [])
        if _KR.search(corp_en) or _KR.search(headline_text) or _KR.search(kn_text) or _KR.search(summary_text):
            continue

        # Reddit은 실제 분석 내용(ai_summary)이 있어야 토론형 본문 작성 가능
        if not summary_text.strip():
            continue

        filtered.append(r)

    return filtered[:limit]


# ── Build Reddit post (title, body) ──────────────────────────────────────────

def build_reddit_post(row: dict) -> tuple[str, str]:
    corp = (row.get("corp_name_en") or row.get("corp_name") or "Unknown").strip()
    corp_display = clean_corp_name(corp)
    code = (row.get("stock_code") or "").strip()
    event = (row.get("event_type") or "OTHER").strip()
    event_label = EVENT_LABELS.get(event, "Corporate Disclosure")
    key_numbers: list = row.get("key_numbers") or []
    sig_id = row["id"]
    rcept_no = (row.get("rcept_no") or "").strip()

    raw_hl = (row.get("headline") or "").strip()
    raw_hl = _strip_corp_prefix(raw_hl, corp)
    raw_hl = _strengthen_headline(raw_hl, event, key_numbers)
    raw_hl = _normalize_headline_case(raw_hl)
    headline = _trunc(raw_hl, 90)

    # ── 제목 (해시태그/이모지 없음 — 뉴스 헤드라인 톤) ──────────────────────────
    ticker_part = f" ({code})" if code else ""
    title = f"{corp_display}{ticker_part} — {headline}" if headline else f"{corp_display}{ticker_part} — {event_label}"
    title = _trunc(title, 280)  # Reddit 제목 한도(300)에 여유

    # ── 본문 ──────────────────────────────────────────────────────────────────
    summary = compact_krw((row.get("ai_summary") or "").strip())
    impact = compact_krw((row.get("financial_impact") or "").strip())

    # 트윗용 _simplify_kn()은 글자수 제한 때문에 괄호/쉼표 뒷부분을 잘라내는데,
    # Reddit 본문은 길이 제약이 없으니 KRW 단위 축약만 하고 원문은 그대로 둔다
    # (예: "Recent Annual Revenue (2025): 116.6B KRW"가 "Recent Annual Revenue"로
    # 잘려버리는 문제 방지).
    kn_lines = []
    for kn in key_numbers[:5]:
        kn_str = compact_krw(str(kn).strip()).lstrip("•-").strip()
        kn_lines.append(f"- {kn_str}")

    signal_url = f"{SIGNAL_URL}/{sig_id}"
    dart_link = f"{DART_URL}{rcept_no}" if rcept_no else None

    body_parts = [
        f"**Event type:** {event_label}",
        "",
        "**What happened:**",
        summary or headline,
        "",
    ]
    if kn_lines:
        body_parts += ["**Key numbers:**", *kn_lines, ""]
    # financial_impact는 "POSITIVE"/"NEGATIVE" 같은 단순 라벨인 경우가 많음 —
    # 실제 문장(공백 포함, 일정 길이 이상)일 때만 별도 섹션으로 노출
    if impact and impact != summary and " " in impact and len(impact) >= 20:
        body_parts += ["**Why it matters:**", impact, ""]

    body_parts.append("---")
    source_line = f"Source: [DART filing]({dart_link})" if dart_link else "Source: DART (Korea Financial Supervisory Service)"
    body_parts.append(f"{source_line} · Full analysis: {signal_url}")
    body_parts.append("")
    body_parts.append(
        "*Not financial advice. All data sourced from public DART filings; "
        "shared for discussion purposes only.*"
    )

    body = "\n".join(body_parts)
    return title, body


# ── Mark-as-posted link (클릭 한 번 — 터미널 명령 수동 실행 대신) ──────────────
# approve-api-key와 동일한 HMAC 토큰 링크 패턴. CRON_SECRET_TOKEN 재사용.

MARK_POSTED_TTL_MS = 7 * 24 * 60 * 60 * 1000  # 7일

def build_mark_posted_url(sig_id: str) -> str | None:
    secret = os.environ.get("CRON_SECRET_TOKEN")
    if not secret:
        logger.warning("CRON_SECRET_TOKEN not set — Mark as Posted 링크 생성 불가")
        return None
    exp = str(int(time.time() * 1000) + MARK_POSTED_TTL_MS)
    token = hmac.new(secret.encode(), f"{sig_id}:{exp}".encode(), hashlib.sha256).hexdigest()
    return f"https://k-marketinsight.com/api/admin/mark-reddit-posted?id={sig_id}&exp={exp}&token={token}"


# ── Build email body ──────────────────────────────────────────────────────────

def build_email_body(row: dict) -> tuple[str, str]:
    title, body = build_reddit_post(row)
    corp = (row.get("corp_name_en") or row.get("corp_name") or "?")
    today = date.today().strftime("%Y-%m-%d")
    sig_id = row["id"]
    mark_url = build_mark_posted_url(sig_id)

    # ── Plain text ────────────────────────────────────────────────────────────
    plain = "\n".join([
        f"[KMI] Reddit Draft Post — {today}",
        "=" * 60,
        "",
        f"Company: {corp}  ·  {row.get('event_type')}",
        "",
        "TITLE:",
        "-" * 60,
        title,
        "",
        "BODY:",
        "-" * 60,
        body,
        "",
        "Mark as Posted (click after posting to Reddit):",
        mark_url or "(CRON_SECRET_TOKEN not set — mark manually in Supabase)",
        "",
    ])

    # ── HTML ─────────────────────────────────────────────────────────────────
    title_html = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    body_html = (
        body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace("\n", "<br>")
    )

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div style="max-width:640px;margin:32px auto;padding:0 16px;">

    <div style="
        background:linear-gradient(135deg,#ff4500,#ff8717);
        border-radius:12px 12px 0 0;
        padding:20px 28px;
    ">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;font-family:-apple-system,sans-serif;">
            👽 Reddit Draft Post — {today}
        </h1>
        <p style="margin:6px 0 0;color:#ffe4d1;font-size:13px;">
            {corp} · {row.get('event_type')}
        </p>
    </div>

    <div style="
        background:#fff7ed;border:1px solid #fed7aa;
        padding:12px 20px;
        font-size:13px;color:#9a3412;margin-bottom:20px;
        font-family:-apple-system,sans-serif;
    ">
        📋 Title/Body 각각 복사 → 서브레딧 규칙(특히 self-promotion) 먼저 확인 후 게시 → 게시 후 "Mark as Posted" 실행
    </div>

    <div style="
        background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;
        padding:20px 24px;margin-bottom:16px;font-family:-apple-system,sans-serif;
    ">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Title</p>
        <div style="
            background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
            padding:14px 16px;font-size:15px;font-weight:600;color:#111827;
            font-family:'Courier New',monospace;
        ">{title_html}</div>
        <details style="margin-top:8px;">
            <summary style="font-size:12px;font-weight:600;color:#1d4ed8;cursor:pointer;list-style:none;padding:6px 0;">📋 Copy title ▾</summary>
            <textarea readonly rows="2" style="
                width:100%;box-sizing:border-box;margin-top:6px;padding:10px 12px;
                font-size:13px;font-family:'Courier New',monospace;color:#111827;
                background:#f8fafc;border:1px solid #6366f1;border-radius:6px;resize:vertical;
            ">{title}</textarea>
        </details>
    </div>

    <div style="
        background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;
        padding:20px 24px;margin-bottom:20px;font-family:-apple-system,sans-serif;
    ">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Body (Markdown)</p>
        <div style="
            background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
            padding:14px 16px;font-size:13px;line-height:1.65;color:#111827;
            font-family:'Courier New',monospace;white-space:pre-wrap;
        ">{body_html}</div>
        <details style="margin-top:8px;">
            <summary style="font-size:12px;font-weight:600;color:#1d4ed8;cursor:pointer;list-style:none;padding:6px 0;">📋 Copy body ▾</summary>
            <textarea readonly rows="14" style="
                width:100%;box-sizing:border-box;margin-top:6px;padding:10px 12px;
                font-size:13px;line-height:1.6;font-family:'Courier New',monospace;color:#111827;
                background:#f8fafc;border:1px solid #6366f1;border-radius:6px;resize:vertical;
            ">{body}</textarea>
        </details>

        <div style="margin-top:14px;text-align:center;">
            {f'''<a href="{mark_url}" style="
                display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;
                padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;
                font-family:-apple-system,sans-serif;
            ">✅ Mark as Posted</a>
            <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;font-family:-apple-system,sans-serif;">
                Click after posting to Reddit — prevents this signal from being re-selected.
            </p>''' if mark_url else '<p style="font-size:11px;color:#ef4444;">CRON_SECRET_TOKEN not set — mark manually in Supabase</p>'}
        </div>
    </div>

    <div style="text-align:center;font-size:12px;color:#9ca3af;margin-top:24px;padding-bottom:32px;font-family:-apple-system,sans-serif;">
        K-Market Insight · <a href="https://k-marketinsight.com" style="color:#6366f1;">k-marketinsight.com</a>
    </div>

</div>
</body>
</html>"""

    return plain, html


# ── Send email via Resend ─────────────────────────────────────────────────────

def send_email(subject: str, plain: str, html: str, api_key: str) -> bool:
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"from": FROM_EMAIL, "to": [RECIPIENT], "subject": subject, "text": plain, "html": html},
        timeout=15,
    )
    if resp.ok:
        data = resp.json()
        logger.info(f"  Email sent — id={data.get('id')}")
        return True
    logger.error(f"  Resend API error: {resp.status_code} {resp.text[:300]}")
    return False


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Reddit draft email digest sender (daily)")
    parser.add_argument("--dry-run",       action="store_true", help="Preview only, do not send")
    parser.add_argument("--min-score",     type=float, default=0.50, help="X(0.30)보다 높은 기본값 — Reddit은 가장 눈에 띄는 것 하나만")
    parser.add_argument("--lookback-days", type=int,   default=5)
    args = parser.parse_args()

    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key and not args.dry_run:
        logger.warning("RESEND_API_KEY not set — switching to dry-run")
        args.dry_run = True

    logger.info(
        f"Fetching Reddit digest | min_score={args.min_score}  "
        f"lookback={args.lookback_days}d"
    )

    queue = fetch_reddit_queue(args.min_score, args.lookback_days, limit=1)
    if not queue:
        logger.info("No pending signals — skipping send")
        return

    row = queue[0]
    plain, html = build_email_body(row)
    today = date.today().strftime("%Y-%m-%d")
    corp = row.get("corp_name_en") or row.get("corp_name") or "?"
    subject = f"[KMI] Reddit Draft Post {today} — {corp}"

    if args.dry_run:
        logger.info(f"\n[DRY-RUN] Recipient: {RECIPIENT}")
        logger.info(f"[DRY-RUN] Subject: {subject}")
        logger.info(f"\n{'='*60}\n{plain}\n{'='*60}")
        return

    send_email(subject, plain, html, api_key)


if __name__ == "__main__":
    main()
