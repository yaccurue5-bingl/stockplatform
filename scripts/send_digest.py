"""
scripts/send_digest.py
======================
Free/Starter 유저 대상 Daily Digest 이메일 발송 (Resend).

목적: 무료 유저 리텐션 + Pro 업그레이드 유도
수신자: users.plan IN ('free', 'starter') AND digest_unsubscribed = false
콘텐츠: 오늘 상위 5개 시그널 (핵심 수치 잠금 → Pro 업셀 CTA)

사용법
------
  python scripts/send_digest.py               # 실제 발송
  python scripts/send_digest.py --dry-run     # 출력만, 발송 안 함
  python scripts/send_digest.py --limit 5     # 시그널 최대 5개
  python scripts/send_digest.py --plans free  # 대상 플랜 지정

필요 환경변수 (.env.local)
--------------------------
  RESEND_API_KEY=re_...
  NEXT_PUBLIC_SUPABASE_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...
"""

import os
import sys
import argparse
import logging
import requests
from datetime import date, timedelta
from pathlib import Path

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

from supabase import create_client, Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("digest")

_sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
_sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(_sb_url, _sb_key)

SITE_URL    = "https://k-marketinsight.com"
FROM_EMAIL  = "KMI Signals <digest@k-marketinsight.com>"
UPGRADE_URL = f"{SITE_URL}/pricing"

EVENT_EMOJI = {
    "EARNINGS":         "📊",
    "CONTRACT":         "🤝",
    "DILUTION":         "⚠️",
    "BUYBACK":          "📈",
    "DISPOSAL":         "📉",
    "DIVIDEND":         "💰",
    "MNA":              "🔄",
    "LEGAL":            "⚖️",
    "CAPEX":            "🏭",
    "EXECUTIVE_CHANGE": "👔",
}

TWEETABLE_TYPES = frozenset(EVENT_EMOJI.keys())


# ── 시그널 조회 ───────────────────────────────────────────────────────────────

def fetch_signals(limit: int, lookback_days: int) -> list[dict]:
    """최근 N일 이내 고품질 공시 시그널 조회."""
    cutoff = (date.today() - timedelta(days=lookback_days)).strftime("%Y%m%d")

    res = (
        supabase.table("disclosure_insights")
        .select(
            "id, corp_name, corp_name_en, stock_code, "
            "headline, event_type, sentiment_score, final_score, rcept_dt"
        )
        .eq("analysis_status", "completed")
        .eq("is_visible", True)
        .gte("rcept_dt", cutoff)
        .in_("event_type", list(TWEETABLE_TYPES))
        .order("final_score", desc=True)
        .limit(limit)
        .execute()
    )
    rows = res.data or []
    return [r for r in rows if r.get("sentiment_score") is not None and abs(float(r["sentiment_score"])) >= 0.30]


# ── 수신자 조회 ───────────────────────────────────────────────────────────────

def fetch_recipients(plans: list[str]) -> list[dict]:
    """digest_unsubscribed=false 인 대상 플랜 유저 조회."""
    res = (
        supabase.table("users")
        .select("id, email, plan")
        .in_("plan", plans)
        .eq("digest_unsubscribed", False)
        .execute()
    )
    return res.data or []


# ── 이메일 본문 생성 ──────────────────────────────────────────────────────────

def _score_bar(score: float) -> str:
    """점수를 ★로 표시 (최대 5개)."""
    stars = min(5, max(1, round(abs(score) * 5)))
    return "★" * stars + "☆" * (5 - stars)

def _direction(score: float) -> tuple[str, str]:
    """(direction label, color) — English."""
    if score >= 0.3:
        return "Bullish", "#16a34a"
    elif score <= -0.3:
        return "Bearish", "#dc2626"
    return "Neutral", "#ca8a04"


def build_email(user: dict, signals: list[dict]) -> tuple[str, str, str]:
    """Return (subject, plain_text, html)."""
    today = date.today()
    date_str = today.strftime("%B %d, %Y")          # e.g. May 15, 2026
    uid = user["id"]
    unsub_url = f"{SITE_URL}/api/digest/unsubscribe?uid={uid}"
    total = len(signals)

    subject = f"[KMI] {total} Korean Market Signal{'s' if total != 1 else ''} Today — {today.strftime('%m/%d')}"

    # ── HTML cards ────────────────────────────────────────────────────────────
    cards_html = ""
    for i, row in enumerate(signals, 1):
        corp = (row.get("corp_name_en") or row.get("corp_name") or "Unknown").strip()[:35]
        code = row.get("stock_code") or ""
        event = row.get("event_type") or "OTHER"
        emoji = EVENT_EMOJI.get(event, "📄")
        headline = (row.get("headline") or "").strip()[:90]
        score = float(row.get("sentiment_score") or 0)
        sig_id = row["id"]
        signal_url = f"{SITE_URL}/signal/{sig_id}"
        direction, dir_color = _direction(score)
        stars = _score_bar(score)

        code_badge = f" <span style='font-size:11px;color:#6b7280;'>[{code}]</span>" if code else ""

        cards_html += f"""
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;
                    padding:20px 22px;margin-bottom:16px;">
          <!-- Header row -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
              <span style="font-weight:700;font-size:15px;color:#111827;">{corp}</span>
              {code_badge}
            </div>
            <span style="font-size:12px;font-weight:600;color:{dir_color};
                         background:{dir_color}18;padding:3px 9px;border-radius:99px;">
              {direction}
            </span>
          </div>
          <!-- Event + headline -->
          <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.5;">
            {emoji} <strong>{event}</strong> — {headline}
          </p>
          <!-- Score + lock notice + CTA — all inside one box -->
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;
                      padding:12px 14px;">
            <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">
              Signal Strength: <span style="color:#1a3fa8;font-weight:700;">{stars}</span>
            </div>
            <div style="font-size:13px;color:#9ca3af;margin-bottom:10px;">
              🔒 Full metrics &amp; AI analysis available in <strong style="color:#7c3aed;">Pro</strong>
            </div>
            <!-- View Signal link + copyable URL -->
            <a href="{signal_url}"
               style="display:inline-block;font-size:13px;color:#1a3fa8;
                      text-decoration:none;font-weight:600;">
              View Signal →
            </a>
            <div style="margin-top:6px;font-size:11px;color:#9ca3af;
                        word-break:break-all;font-family:monospace;">
              {signal_url}
            </div>
          </div>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px 48px;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1a3fa8,#6d28d9);
              border-radius:14px 14px 0 0;padding:28px 28px 24px;">
    <a href="{SITE_URL}" style="text-decoration:none;">
      <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
        K-MarketInsight
      </span>
    </a>
    <h1 style="margin:12px 0 4px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
      Today's Korean Market Signals
    </h1>
    <p style="margin:0;font-size:14px;color:#c4b5fd;">{date_str} · DART Filing AI Analysis</p>
  </div>

  <!-- Sub-header -->
  <div style="background:#ede9fe;border-left:4px solid #7c3aed;
              padding:14px 20px;margin-bottom:20px;font-size:13px;color:#4c1d95;">
    <strong>{total} notable filing signal{'s' if total != 1 else ''}</strong> found today.
    Unlock full metrics and AI analysis with a Pro plan.
  </div>

  <!-- Signal cards -->
  {cards_html}

  <!-- Pro upgrade CTA -->
  <div style="background:linear-gradient(135deg,#1a3fa8,#6d28d9);
              border-radius:14px;padding:28px;text-align:center;margin-top:8px;">
    <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#ffffff;">
      💎 Upgrade to Pro
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#c4b5fd;line-height:1.5;">
      Get full financial metrics, AI analysis reports, and real-time signal alerts — unlimited.
    </p>
    <a href="{UPGRADE_URL}"
       style="display:inline-block;padding:13px 32px;background:#f0b429;
              color:#1a1a1a;border-radius:8px;text-decoration:none;
              font-size:14px;font-weight:700;letter-spacing:0.2px;">
      Start Pro →
    </a>
  </div>

  <!-- Footer -->
  <div style="text-align:center;margin-top:28px;font-size:12px;color:#9ca3af;line-height:1.8;">
    <a href="{SITE_URL}" style="color:#6b7280;text-decoration:none;">k-marketinsight.com</a>
    &nbsp;·&nbsp;
    <a href="{unsub_url}" style="color:#9ca3af;text-decoration:none;">Unsubscribe</a>
    <br>
    This email was sent to {user.get('email','')} because you have a K-MarketInsight account.
  </div>

</div>
</body>
</html>"""

    # ── Plain text ─────────────────────────────────────────────────────────────
    lines = [
        f"[KMI] Korean Market Signals — {date_str}",
        "=" * 55,
        f"{total} filing signal{'s' if total != 1 else ''} found today.",
        "",
    ]
    for i, row in enumerate(signals, 1):
        corp = (row.get("corp_name_en") or row.get("corp_name") or "Unknown")[:35]
        code = row.get("stock_code") or ""
        event = row.get("event_type") or ""
        headline = (row.get("headline") or "").strip()[:90]
        score = float(row.get("sentiment_score") or 0)
        direction, _ = _direction(score)
        stars = _score_bar(score)
        sig_id = row["id"]

        code_str = f" [{code}]" if code else ""
        lines += [
            f"[{i}] {corp}{code_str} | {event} | {direction} {stars}",
            f"    {headline}",
            f"    {SITE_URL}/signal/{sig_id}",
            "",
        ]

    lines += [
        "=" * 55,
        f"Upgrade to Pro: {UPGRADE_URL}",
        f"Unsubscribe: {unsub_url}",
    ]
    plain = "\n".join(lines)

    return subject, plain, html


# ── Resend 발송 ───────────────────────────────────────────────────────────────

def send_email(to_email: str, subject: str, plain: str, html: str, api_key: str) -> bool:
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "text": plain,
            "html": html,
        },
        timeout=15,
    )
    if resp.ok:
        return True
    logger.error(f"  Resend 오류 [{to_email}]: {resp.status_code} {resp.text[:200]}")
    return False


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Daily Digest 이메일 발송")
    parser.add_argument("--dry-run",       action="store_true")
    parser.add_argument("--limit",         type=int,   default=5,  help="최대 시그널 건수 (기본 5)")
    parser.add_argument("--lookback-days", type=int,   default=1,  help="최근 N일 (기본 1 = 오늘)")
    parser.add_argument("--plans",         nargs="+",  default=["free", "starter"],
                        help="대상 플랜 (기본: free starter)")
    args = parser.parse_args()

    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key and not args.dry_run:
        logger.warning("RESEND_API_KEY 미설정 → dry-run 전환")
        args.dry_run = True

    logger.info(f"Daily Digest | plans={args.plans}  limit={args.limit}  lookback={args.lookback_days}d")

    # 시그널 조회
    signals = fetch_signals(args.limit, args.lookback_days)
    if not signals:
        logger.info("발송할 시그널 없음 — 완료")
        return
    logger.info(f"  → 시그널 {len(signals)}건")

    # 수신자 조회
    recipients = fetch_recipients(args.plans)
    if not recipients:
        logger.info("발송 대상 유저 없음 — 완료")
        return
    logger.info(f"  → 수신자 {len(recipients)}명")

    sent = 0
    for user in recipients:
        subject, plain, html_body = build_email(user, signals)

        if args.dry_run:
            logger.info(f"\n[DRY-RUN] → {user['email']} ({user.get('plan')})")
            logger.info(f"  제목: {subject}")
            logger.info(f"  시그널: {len(signals)}건 포함")
            continue

        ok = send_email(user["email"], subject, plain, html_body, api_key)
        status = "✅" if ok else "❌"
        logger.info(f"  {status} {user['email']} ({user.get('plan')})")
        if ok:
            sent += 1

    if not args.dry_run:
        logger.info(f"\n{sent}/{len(recipients)}명 발송 완료")
    else:
        logger.info(f"\n[DRY-RUN] {len(recipients)}명 미리보기 완료")


if __name__ == "__main__":
    main()
