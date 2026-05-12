"""
scripts/post_telegram.py
========================
DART 공시 AI 분석 완료 항목 중 고품질 시그널을 Telegram 채널에 자동 게시.

Twitter API 대신 Telegram Bot API (완전 무료) 사용.

필터링 기준 (post_tweet.py 와 동일)
-------------------------------------
  - analysis_status = 'completed', is_visible = true
  - tweeted_at IS NULL  (중복 방지 — tweet/telegram 공통 컬럼 재사용)
  - event_type NOT IN ('OTHER')
  - ABS(sentiment_score) >= min_score (기본 0.30)
  - rcept_dt >= today - lookback_days (기본 2일)
  → final_score DESC 정렬 후 최대 limit 건 게시

사용법
------
  python scripts/post_telegram.py               # 실제 게시 (최대 5건)
  python scripts/post_telegram.py --dry-run     # 출력만
  python scripts/post_telegram.py --limit 3
  python scripts/post_telegram.py --min-score 0.5

필요 환경변수 (.env.local)
--------------------------
  TELEGRAM_BOT_TOKEN=...
  TELEGRAM_CHANNEL_ID=@KMI_Signals

메시지 형식 (Telegram MarkdownV2)
-----------------------------------
  🇰🇷 *TYM* \\[002900\\]
  📊 EARNINGS — TYM Corp Q1 Earnings

  • Revenue: 289,678M KRW \\(+28\\.3% YoY\\)
  • Operating Profit: 35,042M KRW \\(+131\\.5% YoY\\)

  📊 [Full Analysis](https://k-marketinsight.com/signal/uuid)
  \\#KoreanStocks \\#DART
"""

import os
import sys
import json
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

from supabase import create_client, Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("telegram_bot")

# ── Supabase 클라이언트 ────────────────────────────────────────────────────────
_sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
_sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(_sb_url, _sb_key)

# ── 이벤트 이모지 ─────────────────────────────────────────────────────────────
EVENT_EMOJI: dict[str, str] = {
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
    "OTHER":            "📄",
}

TWEETABLE_TYPES = frozenset(EVENT_EMOJI.keys()) - {"OTHER"}
BASE_URL = "https://k-marketinsight.com/signal"


# ── Telegram MarkdownV2 이스케이프 ────────────────────────────────────────────
# MarkdownV2에서 특수문자는 반드시 백슬래시로 이스케이프해야 함
_TG_SPECIAL = r'\_*[]()~`>#+-=|{}.!'

def tg_escape(text: str) -> str:
    """Telegram MarkdownV2 특수문자 이스케이프."""
    result = []
    for ch in text:
        if ch in _TG_SPECIAL:
            result.append('\\')
        result.append(ch)
    return ''.join(result)


def _trunc(text: str, max_len: int) -> str:
    return text if len(text) <= max_len else text[:max_len - 1] + "…"


# ── 메시지 텍스트 생성 ────────────────────────────────────────────────────────

def build_message(row: dict) -> str:
    """
    disclosure_insights 행을 받아 Telegram MarkdownV2 메시지 반환.
    Telegram 메시지 제한: 4096자 (여유 충분)
    """
    corp = (row.get("corp_name_en") or row.get("corp_name") or "Unknown").strip()
    code = (row.get("stock_code") or "").strip()
    event = (row.get("event_type") or "OTHER").strip()
    emoji = EVENT_EMOJI.get(event, "📄")
    headline = _trunc((row.get("headline") or "").strip(), 80)
    key_numbers: list = row.get("key_numbers") or []
    sig_id = row["id"]
    score = row.get("sentiment_score") or 0
    final_score = row.get("final_score") or 0

    # 감성 방향 표시
    if score >= 0.3:
        direction = "🟢"
    elif score <= -0.3:
        direction = "🔴"
    else:
        direction = "🟡"

    # 기업명 (bold)
    corp_str = tg_escape(_trunc(corp, 35))
    code_str = f" \\[{tg_escape(code)}\\]" if code else ""
    line1 = f"🇰🇷 *{corp_str}*{code_str}"

    # 이벤트 + 헤드라인
    line2 = f"{emoji} {tg_escape(event)} — {tg_escape(headline)}"

    # Key numbers (최대 3개)
    kn_lines: list[str] = []
    for kn in key_numbers[:3]:
        kn_str = str(kn).strip()
        if not kn_str.startswith("•"):
            kn_str = "• " + kn_str
        kn_lines.append(tg_escape(_trunc(kn_str, 80)))

    # 스코어 바
    score_bar = f"{direction} Sentiment: {tg_escape(f'{score:+.2f}')}  \\|  Score: {tg_escape(str(int(final_score)))}"

    # 링크 (MarkdownV2 인라인 링크)
    url = f"{BASE_URL}/{sig_id}"
    link_line = f"[📊 Full Analysis →]({url})"

    # 해시태그
    hashtags = "\\#KoreanStocks \\#DART \\#KRX"

    parts = [line1, line2]
    if kn_lines:
        parts.append("")
        parts.extend(kn_lines)
    parts.append("")
    parts.append(score_bar)
    parts.append("")
    parts.append(link_line)
    parts.append(hashtags)

    return "\n".join(parts)


# ── 대기 항목 조회 ────────────────────────────────────────────────────────────

def fetch_queue(min_score: float, lookback_days: int, limit: int) -> list[dict]:
    cutoff_dt = (date.today() - timedelta(days=lookback_days)).strftime("%Y%m%d")

    res = (
        supabase.table("disclosure_insights")
        .select(
            "id, corp_name, corp_name_en, stock_code, "
            "headline, key_numbers, event_type, "
            "sentiment_score, financial_impact, final_score, rcept_dt"
        )
        .eq("analysis_status", "completed")
        .eq("is_visible", True)
        .is_("tweeted_at", "null")
        .gte("rcept_dt", cutoff_dt)
        .in_("event_type", list(TWEETABLE_TYPES))
        .order("final_score", desc=True)
        .limit(limit * 5)
        .execute()
    )

    rows = res.data or []
    filtered = [
        r for r in rows
        if r.get("sentiment_score") is not None
        and abs(float(r["sentiment_score"])) >= min_score
    ]
    return filtered[:limit]


# ── Telegram 게시 ─────────────────────────────────────────────────────────────

def send_telegram(text: str, bot_token: str, channel_id: str) -> bool:
    """Telegram Bot API로 메시지 게시. 성공 시 True."""
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": channel_id,
        "text": text,
        "parse_mode": "MarkdownV2",
        "disable_web_page_preview": False,  # 링크 미리보기 ON (signal 페이지 OG 카드)
    }
    try:
        resp = requests.post(url, json=payload, timeout=10)
        if resp.ok:
            return True
        else:
            logger.error(f"Telegram API 오류: {resp.status_code} {resp.text[:200]}")
            return False
    except requests.RequestException as exc:
        logger.error(f"Telegram 요청 실패: {exc}")
        return False


def mark_tweeted(row_id: str) -> None:
    from datetime import datetime, timezone
    supabase.table("disclosure_insights").update({
        "tweeted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", row_id).execute()


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="DART 공시 Telegram 채널 자동 게시")
    parser.add_argument("--dry-run",       action="store_true")
    parser.add_argument("--limit",         type=int,   default=5)
    parser.add_argument("--min-score",     type=float, default=0.30)
    parser.add_argument("--lookback-days", type=int,   default=2)
    args = parser.parse_args()

    bot_token  = os.environ.get("TELEGRAM_BOT_TOKEN")
    channel_id = os.environ.get("TELEGRAM_CHANNEL_ID", "@KMI_Signals")

    if not bot_token and not args.dry_run:
        logger.warning(
            "TELEGRAM_BOT_TOKEN 미설정 → dry-run 전환.\n"
            "  .env.local에 추가: TELEGRAM_BOT_TOKEN=...\n"
            "                     TELEGRAM_CHANNEL_ID=@KMI_Signals"
        )
        args.dry_run = True

    logger.info(
        f"Telegram 게시 대기 항목 조회 | "
        f"channel={channel_id}  min_score={args.min_score}  "
        f"lookback={args.lookback_days}d  limit={args.limit}"
    )

    queue = fetch_queue(args.min_score, args.lookback_days, args.limit)
    if not queue:
        logger.info("게시 대기 항목 없음 — 완료")
        return

    logger.info(f"  → {len(queue)}건 발견")

    posted = 0
    for row in queue:
        msg = build_message(row)
        corp_label = (row.get("corp_name_en") or row.get("corp_name") or "?")[:30]
        score = row.get("sentiment_score") or 0

        logger.info(
            f"\n{'─'*55}\n"
            f"  {corp_label}  |  {row.get('event_type')}  |  score={score:.2f}\n"
            f"{'─'*55}\n"
            + msg +
            f"\n{'─'*55}"
        )

        if args.dry_run:
            logger.info("  [DRY-RUN] 게시 스킵")
            continue

        ok = send_telegram(msg, bot_token, channel_id)
        if ok:
            mark_tweeted(row["id"])
            logger.info("  게시 완료")
            posted += 1
        else:
            logger.warning("  게시 실패 — 다음 항목으로")

    if not args.dry_run:
        logger.info(f"\n{posted}/{len(queue)}건 게시 완료")
    else:
        logger.info(f"\n[DRY-RUN] {len(queue)}건 미리보기 완료")


if __name__ == "__main__":
    main()
