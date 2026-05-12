"""
scripts/post_tweet.py
======================
DART 공시 AI 분석 완료 항목 중 고품질 시그널을 X(Twitter)에 자동 게시.

필터링 기준
-----------
  - analysis_status = 'completed', is_visible = true
  - tweeted_at IS NULL          (아직 트윗 안 된 항목)
  - event_type NOT IN ('OTHER') (잡음 제외)
  - ABS(sentiment_score) >= min_score (기본 0.30)
  - rcept_dt >= today - lookback_days (기본 2일)
  → final_score DESC 정렬 후 최대 limit 건 게시

사용법
------
  python scripts/post_tweet.py               # 실제 게시 (최대 5건)
  python scripts/post_tweet.py --dry-run     # 출력만, 실제 게시 안 함
  python scripts/post_tweet.py --limit 3     # 최대 3건 게시
  python scripts/post_tweet.py --min-score 0.5  # 강한 시그널만

필요 환경변수 (.env.local)
--------------------------
  TWITTER_API_KEY=...
  TWITTER_API_SECRET=...
  TWITTER_ACCESS_TOKEN=...
  TWITTER_ACCESS_TOKEN_SECRET=...

트윗 형식 (≤280자)
-------------------
  🇰🇷 Kakao Corp [035720]
  📊 EARNINGS — Revenue miss Q1

  • Net Income: ₩6.6T (-43% YoY)
  • Op. Profit: ₩6.7T (+2% QoQ)

  https://k-marketinsight.com/signal/{uuid}
  #KoreanStocks #DART
"""

import os
import sys
import argparse
import logging
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
logger = logging.getLogger("tweet_bot")

# ── Supabase 클라이언트 ────────────────────────────────────────────────────────
_sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
_sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(_sb_url, _sb_key)

# ── 이벤트 유형 이모지 ─────────────────────────────────────────────────────────
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

# ── 트윗에 포함할 이벤트 유형 (OTHER 제외) ─────────────────────────────────────
TWEETABLE_TYPES = frozenset(EVENT_EMOJI.keys()) - {"OTHER"}

BASE_URL  = "https://k-marketinsight.com/signal"
HASHTAGS  = "#KoreanStocks #DART"
_T_URL_W  = 23   # Twitter t.co 단축 URL 고정 가중치
_MAX_TWEET = 275  # 280자 한도보다 5자 여유


# ── Twitter 가중 문자 수 계산 ─────────────────────────────────────────────────

def twitter_weight(text: str) -> int:
    """
    Twitter 가중 문자 수 근사치.
    - CJK / 전각 문자: 2
    - 이모지(BMP 밖): 2
    - URL: 실제 길이 그대로 (호출 측에서 별도 처리)
    - 나머지: 1
    """
    import unicodedata
    count = 0
    for ch in text:
        if unicodedata.east_asian_width(ch) in ("W", "F"):
            count += 2
        elif ord(ch) > 0xFFFF:   # Supplementary plane (대부분 이모지)
            count += 2
        else:
            count += 1
    return count


def tweet_len(text: str, url: str) -> int:
    """
    URL 포함 트윗 가중 길이.
    Twitter는 URL을 t.co 23자로 대체하므로 URL 부분 차감 후 23 추가.
    """
    url_actual = twitter_weight(url)
    return twitter_weight(text) - url_actual + _T_URL_W


# ── 트윗 텍스트 생성 ──────────────────────────────────────────────────────────

def _trunc(text: str, max_len: int) -> str:
    """Python len() 기준 max_len 초과 시 끝에 … 붙여 자름."""
    return text if len(text) <= max_len else text[:max_len - 1] + "…"


def build_tweet(row: dict) -> tuple[str, int]:
    """
    disclosure_insights 행 하나를 받아 (tweet_text, twitter_weight) 반환.
    Twitter 가중 문자 기준 _MAX_TWEET(275) 이내로 자동 조정.
    """
    corp = (row.get("corp_name_en") or row.get("corp_name") or "Unknown").strip()
    code = (row.get("stock_code") or "").strip()
    event = (row.get("event_type") or "OTHER").strip()
    emoji = EVENT_EMOJI.get(event, "📄")
    headline = _trunc((row.get("headline") or "").strip(), 55)
    key_numbers: list = row.get("key_numbers") or []
    sig_id = row["id"]

    url = f"{BASE_URL}/{sig_id}"

    # Line 1: 회사명 + 코드 (corp_name_en 없으면 한국어 그대로 — CJK=2 고려해 25자 제한)
    corp_trimmed = _trunc(corp, 25)
    corp_line = f"🇰🇷 {corp_trimmed}"
    if code:
        corp_line += f" [{code}]"

    # Line 2: 이벤트 + 헤드라인
    event_line = f"{emoji} {event} — {headline}"

    # Key numbers (최대 2개, 각 52자)
    kn_lines: list[str] = []
    for kn in key_numbers[:2]:
        kn_str = str(kn).strip()
        if not kn_str.startswith("•"):
            kn_str = "• " + kn_str
        kn_lines.append(_trunc(kn_str, 52))

    def _assemble(kn: list[str]) -> str:
        parts = [corp_line, event_line]
        if kn:
            parts.append("")
            parts.extend(kn)
        parts.append("")
        parts.append(url)
        parts.append(HASHTAGS)
        return "\n".join(parts)

    # 최대 2개로 시도 → 초과 시 1개 → 초과 시 0개
    for n in (2, 1, 0):
        text = _assemble(kn_lines[:n])
        w = tweet_len(text, url)
        if w <= _MAX_TWEET:
            return text, w

    # 최후 수단: 헤드라인 단축
    headline = _trunc(headline, 35)
    event_line = f"{emoji} {event} — {headline}"
    text = _assemble([])
    return text, tweet_len(text, url)


# ── 대기 중인 공시 조회 ────────────────────────────────────────────────────────

def fetch_queue(min_score: float, lookback_days: int, limit: int) -> list[dict]:
    """
    트윗 대기 중인 고품질 공시 조회.
    Supabase Python SDK는 partial index 필터를 그대로 전달하므로
    abs() 조건만 클라이언트 사이드에서 처리.
    """
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
        .limit(limit * 5)   # min_score 클라이언트 필터 여유분
        .execute()
    )

    rows = res.data or []

    # 클라이언트 사이드 abs(sentiment_score) 필터
    filtered = [
        r for r in rows
        if r.get("sentiment_score") is not None
        and abs(float(r["sentiment_score"])) >= min_score
    ]

    return filtered[:limit]


# ── 트윗 게시 ─────────────────────────────────────────────────────────────────

def post_tweet(text: str, api_key: str, api_secret: str,
               access_token: str, access_secret: str) -> str | None:
    """
    Twitter API v2 (OAuth 1.0a User Context) 로 트윗 게시.
    성공 시 tweet_id 반환, 실패 시 None.
    """
    try:
        import tweepy  # noqa: PLC0415
    except ImportError:
        logger.error("tweepy 미설치 — `pip install tweepy` 실행 후 재시도")
        return None

    client = tweepy.Client(
        consumer_key=api_key,
        consumer_secret=api_secret,
        access_token=access_token,
        access_token_secret=access_secret,
    )
    try:
        resp = client.create_tweet(text=text)
        tweet_id = resp.data["id"] if resp.data else None
        return tweet_id
    except tweepy.TweepyException as exc:
        logger.error(f"트윗 게시 실패: {exc}")
        return None


def mark_tweeted(row_id: str) -> None:
    """DB에 tweeted_at 타임스탬프 기록."""
    from datetime import datetime, timezone
    supabase.table("disclosure_insights").update({
        "tweeted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", row_id).execute()


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="DART 공시 자동 트윗 게시",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--dry-run",     action="store_true",
                        help="트윗 텍스트 출력만, 실제 게시 안 함")
    parser.add_argument("--limit",       type=int,   default=5,
                        help="최대 게시 건수 (기본 5)")
    parser.add_argument("--min-score",   type=float, default=0.30,
                        help="최소 abs(sentiment_score) (기본 0.30)")
    parser.add_argument("--lookback-days", type=int, default=2,
                        help="최근 N일 이내 공시만 대상 (기본 2)")
    args = parser.parse_args()

    # ── Twitter 자격증명 로드 ─────────────────────────────────────────────────
    api_key      = os.environ.get("TWITTER_API_KEY")
    api_secret   = os.environ.get("TWITTER_API_SECRET")
    access_token = os.environ.get("TWITTER_ACCESS_TOKEN")
    access_secret= os.environ.get("TWITTER_ACCESS_TOKEN_SECRET")

    creds_ok = all([api_key, api_secret, access_token, access_secret])
    if not creds_ok and not args.dry_run:
        logger.warning(
            "Twitter 자격증명 미설정 → --dry-run 모드로 전환.\n"
            "  .env.local에 다음 변수를 추가하세요:\n"
            "    TWITTER_API_KEY=...\n"
            "    TWITTER_API_SECRET=...\n"
            "    TWITTER_ACCESS_TOKEN=...\n"
            "    TWITTER_ACCESS_TOKEN_SECRET=..."
        )
        args.dry_run = True

    # ── 대기 항목 조회 ────────────────────────────────────────────────────────
    logger.info(
        f"트윗 대기 항목 조회 | "
        f"min_score={args.min_score}  lookback={args.lookback_days}d  limit={args.limit}"
    )
    queue = fetch_queue(args.min_score, args.lookback_days, args.limit)

    if not queue:
        logger.info("✅ 트윗 대기 항목 없음 — 완료")
        return

    logger.info(f"  → {len(queue)}건 발견")

    # ── 순서대로 게시 ────────────────────────────────────────────────────────
    posted = 0
    for row in queue:
        tweet_text, tw_len = build_tweet(row)
        corp_label = (row.get("corp_name_en") or row.get("corp_name") or "?")[:30]
        score = row.get("sentiment_score") or 0

        logger.info(
            f"\n{'─'*55}\n"
            f"  {corp_label}  |  {row.get('event_type')}  |  score={score:.2f}\n"
            f"{'─'*55}\n"
            + tweet_text +
            f"\n{'─'*55}"
        )
        logger.info(f"  Twitter 가중 문자 수: {tw_len} / 280")

        if args.dry_run:
            logger.info("  [DRY-RUN] 실제 게시 스킵")
            continue

        tweet_id = post_tweet(
            tweet_text, api_key, api_secret,    # type: ignore[arg-type]
            access_token, access_secret         # type: ignore[arg-type]
        )
        if tweet_id:
            mark_tweeted(row["id"])
            logger.info(f"  ✅ 게시 완료 — tweet_id={tweet_id}")
            posted += 1
        else:
            logger.warning("  ⚠️ 게시 실패 — 다음 항목으로")

    if not args.dry_run:
        logger.info(f"\n🎉 {posted}/{len(queue)}건 게시 완료")
    else:
        logger.info(f"\n[DRY-RUN] {len(queue)}건 미리보기 완료")


if __name__ == "__main__":
    main()
