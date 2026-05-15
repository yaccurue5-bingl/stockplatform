"""
scripts/send_twitter_digest.py
==============================
Daily email digest (via Resend) of high-quality DART signals pending a tweet.

Features:
- Default limit 5 items (anti-spam)
- UUID hidden from visible card content
- HTML "Copy Tweet" button (clipboard)
- Per-card "Mark as Tweeted" 1-click command
- X post format separated from email metadata

Usage
-----
  python scripts/send_twitter_digest.py               # send (default 5 items)
  python scripts/send_twitter_digest.py --dry-run     # preview only, no send
  python scripts/send_twitter_digest.py --limit 3
  python scripts/send_twitter_digest.py --min-score 0.5

Required env vars (.env.local)
------------------------------
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

# Reuse shared logic from post_tweet.py
from post_tweet import build_tweet, fetch_queue  # noqa: E402

from supabase import create_client, Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("twitter_digest")

_sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
_sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(_sb_url, _sb_key)

RECIPIENT   = "yaccurue5@gmail.com"
FROM_EMAIL  = "KMI Signals <noreply@k-marketinsight.com>"
BASE_URL    = "https://k-marketinsight.com/signal"


# ── Generate mark-as-tweeted command ─────────────────────────────────────────

def mark_tweeted_cmd(sig_id: str) -> str:
    """Generate a 1-click Python command to mark a signal as tweeted."""
    return (
        f"python -c \""
        f"from supabase import create_client; from dotenv import load_dotenv; import os; "
        f"load_dotenv('.env.local'); "
        f"sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY']); "
        f"sb.table('disclosure_insights').update({{'tweeted_at': 'now()'}}).eq('id', '{sig_id}').execute(); "
        f"print('✅ marked {sig_id[:8]}...')\""
    )


# ── Build email body ──────────────────────────────────────────────────────────

def build_email_body(queue: list[dict]) -> tuple[str, str]:
    """
    Returns (plain_text, html).
    plain_text: copy-paste tweet blocks (no UUID exposed)
    html: Copy button + 1-click Mark as Tweeted per card
    """
    today = date.today().strftime("%Y-%m-%d")
    total = len(queue)

    # ── Plain text ────────────────────────────────────────────────────────────
    lines = [
        f"[KMI] X Draft Posts — {today}  ({total} items)",
        "=" * 60,
        "",
    ]
    for i, row in enumerate(queue, 1):
        tweet_text, tw_len = build_tweet(row)
        corp = (row.get("corp_name_en") or row.get("corp_name") or "?")[:30]
        score = row.get("sentiment_score") or 0
        sig_id = row["id"]

        lines.append(f"[{i}] {corp}  ·  {row.get('event_type')}  ·  score {score:+.2f}  ·  {tw_len}/280")
        lines.append("─" * 60)
        lines.append(tweet_text)
        lines.append("")
        lines.append(f"Mark as Tweeted:")
        lines.append(mark_tweeted_cmd(sig_id))
        lines.append("")

    plain = "\n".join(lines)

    # ── HTML ─────────────────────────────────────────────────────────────────
    cards_html = ""
    for i, row in enumerate(queue, 1):
        tweet_text, tw_len = build_tweet(row)
        corp = (row.get("corp_name_en") or row.get("corp_name") or "?")[:30]
        score = row.get("sentiment_score") or 0
        event = row.get("event_type") or ""
        sig_id = row["id"]
        signal_url = f"{BASE_URL}/{sig_id}"
        mark_cmd = mark_tweeted_cmd(sig_id).replace('"', "&quot;").replace("'", "&#39;")

        score_color = "#16a34a" if score >= 0.3 else ("#dc2626" if score <= -0.3 else "#ca8a04")
        # Safely escape tweet_text for use as a JS template literal
        tweet_js = (
            tweet_text
            .replace("\\", "\\\\")
            .replace("`", "\\`")
            .replace("$", "\\$")
        )
        tweet_display = (
            tweet_text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\n", "<br>")
        )

        # plain tweet text for textarea (no HTML escaping)
        tweet_textarea = tweet_text.replace("</", "<\\/")

        cards_html += f"""
        <div style="
            background:#ffffff;
            border:1px solid #e5e7eb;
            border-radius:12px;
            padding:20px 24px;
            margin-bottom:20px;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        ">
            <!-- Header: company + event + score -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="font-size:15px;font-weight:700;color:#111827;">{corp}</span>
                <span style="font-size:12px;font-weight:600;color:{score_color};background:#f3f4f6;padding:3px 8px;border-radius:6px;">
                    {event} &nbsp;·&nbsp; {score:+.2f}
                </span>
            </div>

            <!-- Tweet text box (formatted display) -->
            <div style="
                background:#f8fafc;
                border:1px solid #e2e8f0;
                border-radius:8px;
                padding:14px 16px;
                font-size:14px;
                line-height:1.65;
                color:#111827;
                white-space:pre-wrap;
                font-family:'Courier New',Courier,monospace;
            ">{tweet_display}
                <!-- Signal link + char count INSIDE the box -->
                <div style="
                    margin-top:10px;
                    padding-top:8px;
                    border-top:1px solid #e2e8f0;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                ">
                    <a href="{signal_url}" style="
                        font-size:12px;color:#6366f1;text-decoration:none;
                        font-weight:600;font-family:-apple-system,sans-serif;
                    ">📊 View Signal →</a>
                    <span style="font-size:11px;color:#9ca3af;font-family:-apple-system,sans-serif;">{tw_len}/280</span>
                </div>
            </div>

            <!-- Copy toggle: <details>+<textarea> works in all email clients, no JS needed -->
            <details style="margin-top:10px;">
                <summary style="
                    font-size:12px;font-weight:600;color:#1d4ed8;
                    cursor:pointer;list-style:none;padding:6px 0;
                ">📋 Copy tweet text ▾</summary>
                <textarea readonly rows="7" style="
                    width:100%;box-sizing:border-box;
                    margin-top:6px;padding:10px 12px;
                    font-size:13px;line-height:1.6;
                    font-family:'Courier New',Courier,monospace;
                    color:#111827;background:#f8fafc;
                    border:1px solid #6366f1;border-radius:6px;
                    resize:vertical;
                ">{tweet_text}</textarea>
            </details>

            <!-- Mark as Tweeted command (collapsible) -->
            <details style="margin-top:6px;">
                <summary style="font-size:11px;color:#6b7280;cursor:pointer;list-style:none;padding:4px 0;">
                    ✅ Mark as Tweeted (run after posting) ▾
                </summary>
                <div style="
                    margin-top:6px;
                    background:#f1f5f9;
                    border-radius:6px;
                    padding:10px 12px;
                    font-size:11px;
                    font-family:'Courier New',monospace;
                    color:#334155;
                    word-break:break-all;
                    white-space:pre-wrap;
                ">{mark_cmd}</div>
            </details>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div style="max-width:640px;margin:32px auto;padding:0 16px;">

    <!-- Header -->
    <div style="
        background:linear-gradient(135deg,#1d4ed8,#7c3aed);
        border-radius:12px 12px 0 0;
        padding:20px 28px;
    ">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;font-family:-apple-system,sans-serif;">
            𝕏 Draft Posts — {today}
        </h1>
        <p style="margin:6px 0 0;color:#c7d2fe;font-size:13px;">
            Top {total} · score ≥ 0.30 · not yet tweeted
        </p>
    </div>

    <!-- Instructions -->
    <div style="
        background:#eff6ff;border:1px solid #bfdbfe;
        border-radius:0 0 0 0;padding:12px 20px;
        font-size:13px;color:#1e40af;margin-bottom:20px;
        font-family:-apple-system,sans-serif;
    ">
        📋 Click <strong>Copy Tweet</strong> → Paste into X → After posting, run the "Mark as Tweeted" command
    </div>

    <!-- Cards -->
    {cards_html}

    <!-- Footer -->
    <div style="
        text-align:center;font-size:12px;color:#9ca3af;
        margin-top:24px;padding-bottom:32px;font-family:-apple-system,sans-serif;
    ">
        K-Market Insight · <a href="https://k-marketinsight.com" style="color:#6366f1;">k-marketinsight.com</a>
    </div>

</div>
</body>
</html>"""

    return plain, html


# ── Send email via Resend ─────────────────────────────────────────────────────

def send_email(subject: str, plain: str, html: str, api_key: str) -> bool:
    """Send email via Resend API. Returns True on success."""
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": FROM_EMAIL,
            "to": [RECIPIENT],
            "subject": subject,
            "text": plain,
            "html": html,
        },
        timeout=15,
    )
    if resp.ok:
        data = resp.json()
        logger.info(f"  Email sent — id={data.get('id')}")
        return True
    else:
        logger.error(f"  Resend API error: {resp.status_code} {resp.text[:300]}")
        return False


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Twitter draft email digest sender")
    parser.add_argument("--dry-run",       action="store_true", help="Preview only, do not send")
    parser.add_argument("--limit",         type=int,   default=5, help="Max items (default: 5)")
    parser.add_argument("--min-score",     type=float, default=0.30)
    parser.add_argument("--lookback-days", type=int,   default=2)
    args = parser.parse_args()

    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key and not args.dry_run:
        logger.warning("RESEND_API_KEY not set — switching to dry-run")
        args.dry_run = True

    logger.info(
        f"Fetching Twitter digest | "
        f"min_score={args.min_score}  lookback={args.lookback_days}d  limit={args.limit}"
    )

    queue = fetch_queue(args.min_score, args.lookback_days, args.limit)
    if not queue:
        logger.info("No pending signals — skipping send")
        return

    logger.info(f"  → {len(queue)} item(s) found")

    plain, html = build_email_body(queue)
    today = date.today().strftime("%Y-%m-%d")
    subject = f"[KMI] X Draft Posts {today} ({len(queue)} items)"

    if args.dry_run:
        logger.info(f"\n[DRY-RUN] Recipient: {RECIPIENT}")
        logger.info(f"[DRY-RUN] Subject: {subject}")
        logger.info(f"\n{'='*60}\n{plain}\n{'='*60}")
        return

    send_email(subject, plain, html, api_key)


if __name__ == "__main__":
    main()
