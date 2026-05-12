"""
scripts/send_twitter_digest.py
==============================
트윗 대기 중인 고품질 공시를 매일 이메일(Resend)로 전송.

yaccurue5@gmail.com으로 트윗 초안을 보내면 복붙으로 수동 게시 가능.
tweeted_at은 수정하지 않음 — 실제 Twitter 게시 후 수동으로 업데이트할 것.

사용법
------
  python scripts/send_twitter_digest.py               # 실제 발송 (최대 10건)
  python scripts/send_twitter_digest.py --dry-run     # 출력만, 발송 안 함
  python scripts/send_twitter_digest.py --limit 5
  python scripts/send_twitter_digest.py --min-score 0.5

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

# ── 경로 / 환경 변수 ───────────────────────────────────────────────────────────
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

# post_tweet.py에서 공통 로직 재사용
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

# ── 이메일 본문 생성 ──────────────────────────────────────────────────────────

def build_email_body(queue: list[dict]) -> tuple[str, str]:
    """
    (plain_text, html) 반환.
    plain_text: 복붙용 트윗 블록 목록
    html: 가독성 높은 HTML 버전 (카드 스타일)
    """
    today = date.today().strftime("%Y-%m-%d")
    total = len(queue)

    # ── Plain text ─────────────────────────────────────────────────────────────
    lines = [
        f"[KMI] X(Twitter) 게시 초안 — {today}  ({total}건)",
        "=" * 60,
        "아래 블록을 복사해 Twitter에 게시 후, 해당 ID의 tweeted_at을 업데이트하세요.",
        "",
    ]
    for i, row in enumerate(queue, 1):
        tweet_text, tw_len = build_tweet(row)
        corp = (row.get("corp_name_en") or row.get("corp_name") or "?")[:30]
        score = row.get("sentiment_score") or 0
        sig_id = row["id"]

        lines.append(f"{'='*60}")
        lines.append(f"[{i}] {corp}  |  {row.get('event_type')}  |  score={score:+.2f}  |  {tw_len}/280자")
        lines.append(f"ID: {sig_id}")
        lines.append(f"URL: {BASE_URL}/{sig_id}")
        lines.append(f"{'─'*60}")
        lines.append(tweet_text)
        lines.append("")

    lines.append("=" * 60)
    lines.append("tweeted_at 업데이트 (게시 후 실행):")
    lines.append("python -c \"")
    lines.append("from supabase import create_client; from dotenv import load_dotenv; import os")
    lines.append("load_dotenv('.env.local')")
    lines.append("sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])")
    lines.append("sb.table('disclosure_insights').update({'tweeted_at': 'now()'}).eq('id', 'PASTE-UUID').execute()")
    lines.append("print('done')\"")

    plain = "\n".join(lines)

    # ── HTML ───────────────────────────────────────────────────────────────────
    cards_html = ""
    for i, row in enumerate(queue, 1):
        tweet_text, tw_len = build_tweet(row)
        corp = (row.get("corp_name_en") or row.get("corp_name") or "?")[:30]
        score = row.get("sentiment_score") or 0
        event = row.get("event_type") or ""
        sig_id = row["id"]
        signal_url = f"{BASE_URL}/{sig_id}"

        score_color = "#16a34a" if score >= 0.3 else ("#dc2626" if score <= -0.3 else "#ca8a04")
        tweet_escaped = tweet_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")

        cards_html += f"""
        <div style="
            background:#ffffff;
            border:1px solid #e5e7eb;
            border-radius:12px;
            padding:20px 24px;
            margin-bottom:20px;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-size:13px;color:#6b7280;">#{i} &nbsp;·&nbsp; {event}</span>
                <span style="font-size:13px;font-weight:600;color:{score_color};">
                    score {score:+.2f} &nbsp;·&nbsp; {tw_len}/280자
                </span>
            </div>
            <div style="
                background:#f9fafb;
                border:1px solid #e5e7eb;
                border-radius:8px;
                padding:14px 16px;
                font-size:14px;
                line-height:1.6;
                color:#111827;
                white-space:pre-wrap;
                font-family:'Courier New',monospace;
                margin-bottom:14px;
            ">{tweet_escaped}</div>
            <div style="display:flex;gap:12px;align-items:center;">
                <a href="{signal_url}" style="
                    font-size:12px;color:#6366f1;text-decoration:none;
                ">📊 시그널 보기 →</a>
                <span style="font-size:11px;color:#9ca3af;font-family:monospace;">{sig_id}</span>
            </div>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div style="max-width:640px;margin:32px auto;padding:0 16px;">

    <!-- 헤더 -->
    <div style="
        background:linear-gradient(135deg,#1d4ed8,#7c3aed);
        border-radius:12px 12px 0 0;
        padding:24px 28px;
        margin-bottom:0;
    ">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;font-family:-apple-system,sans-serif;">
            📬 X 게시 초안 — {today}
        </h1>
        <p style="margin:6px 0 0;color:#c7d2fe;font-size:14px;">
            고품질 공시 {total}건 · tweeted_at IS NULL · score ≥ 0.30
        </p>
    </div>

    <!-- 안내 -->
    <div style="
        background:#eff6ff;
        border:1px solid #bfdbfe;
        border-radius:0 0 0 0;
        padding:14px 20px;
        font-size:13px;
        color:#1e40af;
        margin-bottom:24px;
        font-family:-apple-system,sans-serif;
    ">
        아래 트윗 초안을 복사해 <strong>Twitter(X)</strong>에 게시하세요.
        게시 후 각 ID로 <code>tweeted_at</code>을 업데이트해야 중복 방지됩니다.
    </div>

    <!-- 카드 목록 -->
    {cards_html}

    <!-- 푸터 -->
    <div style="
        text-align:center;
        font-size:12px;
        color:#9ca3af;
        margin-top:24px;
        padding-bottom:32px;
        font-family:-apple-system,sans-serif;
    ">
        K-Market Insight · 자동 생성 이메일 · <a href="https://k-marketinsight.com" style="color:#6366f1;">k-marketinsight.com</a>
    </div>

</div>
</body>
</html>"""

    return plain, html


# ── Resend 이메일 발송 ────────────────────────────────────────────────────────

def send_email(subject: str, plain: str, html: str, api_key: str) -> bool:
    """Resend API로 이메일 발송. 성공 시 True."""
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
        logger.info(f"  이메일 발송 완료 — id={data.get('id')}")
        return True
    else:
        logger.error(f"  Resend API 오류: {resp.status_code} {resp.text[:300]}")
        return False


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Twitter 초안 이메일 다이제스트 발송")
    parser.add_argument("--dry-run",       action="store_true", help="출력만, 발송 안 함")
    parser.add_argument("--limit",         type=int,   default=10, help="최대 건수 (기본 10)")
    parser.add_argument("--min-score",     type=float, default=0.30)
    parser.add_argument("--lookback-days", type=int,   default=2)
    args = parser.parse_args()

    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key and not args.dry_run:
        logger.warning("RESEND_API_KEY 미설정 → dry-run 전환")
        args.dry_run = True

    logger.info(
        f"Twitter 다이제스트 조회 | "
        f"min_score={args.min_score}  lookback={args.lookback_days}d  limit={args.limit}"
    )

    queue = fetch_queue(args.min_score, args.lookback_days, args.limit)
    if not queue:
        logger.info("게시 대기 항목 없음 — 발송 스킵")
        return

    logger.info(f"  → {len(queue)}건 발견")

    plain, html = build_email_body(queue)
    today = date.today().strftime("%Y-%m-%d")
    subject = f"[KMI] X 게시 초안 — {today} ({len(queue)}건)"

    if args.dry_run:
        logger.info(f"\n[DRY-RUN] 수신자: {RECIPIENT}")
        logger.info(f"[DRY-RUN] 제목: {subject}")
        logger.info(f"\n{'='*60}\n{plain}\n{'='*60}")
        return

    send_email(subject, plain, html, api_key)


if __name__ == "__main__":
    main()
