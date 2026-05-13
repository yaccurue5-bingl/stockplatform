"""
scripts/send_twitter_digest.py
==============================
트윗 대기 중인 고품질 공시를 매일 이메일(Resend)로 전송.

개선사항:
- 기본 limit 5건 (스팸 방지)
- UUID 노출 제거 (숨김 처리)
- HTML에 "Copy" 버튼 추가 (클립보드 복사)
- 각 카드마다 "Mark as Tweeted" 1-click 커맨드 제공
- X 포맷과 이메일 정보 분리

사용법
------
  python scripts/send_twitter_digest.py               # 실제 발송 (기본 5건)
  python scripts/send_twitter_digest.py --dry-run     # 출력만, 발송 안 함
  python scripts/send_twitter_digest.py --limit 3
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


# ── tweeted_at 마킹 커맨드 생성 ──────────────────────────────────────────────

def mark_tweeted_cmd(sig_id: str) -> str:
    """1-click 마킹용 Python 커맨드 (ID 포함)."""
    return (
        f"python -c \""
        f"from supabase import create_client; from dotenv import load_dotenv; import os; "
        f"load_dotenv('.env.local'); "
        f"sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY']); "
        f"sb.table('disclosure_insights').update({{'tweeted_at': 'now()'}}).eq('id', '{sig_id}').execute(); "
        f"print('✅ marked {sig_id[:8]}...')\""
    )


# ── 이메일 본문 생성 ──────────────────────────────────────────────────────────

def build_email_body(queue: list[dict]) -> tuple[str, str]:
    """
    (plain_text, html) 반환.
    plain_text: 복붙용 트윗 블록 목록 (ID 숨김)
    html: Copy 버튼 + 1-click Mark as Tweeted 포함
    """
    today = date.today().strftime("%Y-%m-%d")
    total = len(queue)

    # ── Plain text ─────────────────────────────────────────────────────────────
    lines = [
        f"[KMI] X 게시 초안 — {today}  ({total}건)",
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

    # ── HTML ───────────────────────────────────────────────────────────────────
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
        # tweet_text를 JS string으로 안전하게 이스케이프
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

        cards_html += f"""
        <div style="
            background:#ffffff;
            border:1px solid #e5e7eb;
            border-radius:12px;
            padding:20px 24px;
            margin-bottom:20px;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        ">
            <!-- 헤더: 회사 + 이벤트 + 스코어 -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="font-size:15px;font-weight:700;color:#111827;">{corp}</span>
                <span style="font-size:12px;font-weight:600;color:{score_color};background:#f3f4f6;padding:3px 8px;border-radius:6px;">
                    {event} &nbsp;·&nbsp; {score:+.2f}
                </span>
            </div>

            <!-- 트윗 텍스트 박스 -->
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
                margin-bottom:12px;
                position:relative;
            " id="tweet-{i}">{tweet_display}</div>

            <!-- 하단 액션 바 -->
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <!-- Copy 버튼 -->
                <button onclick="(function(){{
                    var t=`{tweet_js}`;
                    navigator.clipboard.writeText(t).then(function(){{
                        var btn=document.getElementById('copy-btn-{i}');
                        btn.textContent='✅ Copied!';
                        btn.style.background='#16a34a';
                        setTimeout(function(){{btn.textContent='📋 Copy Tweet';btn.style.background='#1d4ed8';}},2000);
                    }}).catch(function(){{alert('Copy failed — select text manually');}});
                }})()" id="copy-btn-{i}" style="
                    background:#1d4ed8;color:#ffffff;border:none;
                    padding:7px 14px;border-radius:6px;font-size:13px;
                    font-weight:600;cursor:pointer;
                ">📋 Copy Tweet</button>

                <!-- Signal 링크 -->
                <a href="{signal_url}" style="
                    font-size:12px;color:#6366f1;text-decoration:none;font-weight:500;
                ">📊 Signal →</a>

                <!-- 글자수 -->
                <span style="font-size:11px;color:#9ca3af;margin-left:auto;">{tw_len}/280</span>
            </div>

            <!-- Mark as Tweeted 커맨드 (접을 수 있는 details) -->
            <details style="margin-top:12px;">
                <summary style="font-size:11px;color:#6b7280;cursor:pointer;">Mark as Tweeted (게시 후 실행)</summary>
                <div style="
                    margin-top:8px;
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

    <!-- 헤더 -->
    <div style="
        background:linear-gradient(135deg,#1d4ed8,#7c3aed);
        border-radius:12px 12px 0 0;
        padding:20px 28px;
    ">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;font-family:-apple-system,sans-serif;">
            𝕏 게시 초안 — {today}
        </h1>
        <p style="margin:6px 0 0;color:#c7d2fe;font-size:13px;">
            상위 {total}건 · score ≥ 0.30 · tweeted_at IS NULL
        </p>
    </div>

    <!-- 안내 -->
    <div style="
        background:#eff6ff;border:1px solid #bfdbfe;
        border-radius:0 0 0 0;padding:12px 20px;
        font-size:13px;color:#1e40af;margin-bottom:20px;
        font-family:-apple-system,sans-serif;
    ">
        📋 <strong>Copy Tweet</strong> 버튼 클릭 → X에 붙여넣기 → 게시 후 "Mark as Tweeted" 커맨드 실행
    </div>

    <!-- 카드 목록 -->
    {cards_html}

    <!-- 푸터 -->
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
    parser.add_argument("--limit",         type=int,   default=5, help="최대 건수 (기본 5)")
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
    subject = f"[KMI] X 초안 {today} ({len(queue)}건)"

    if args.dry_run:
        logger.info(f"\n[DRY-RUN] 수신자: {RECIPIENT}")
        logger.info(f"[DRY-RUN] 제목: {subject}")
        logger.info(f"\n{'='*60}\n{plain}\n{'='*60}")
        return

    send_email(subject, plain, html, api_key)


if __name__ == "__main__":
    main()
