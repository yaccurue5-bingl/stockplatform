"""
scripts/post_tweet.py
======================
Posts high-quality DART disclosure signals (AI-analyzed) to X (Twitter).

Filter criteria
---------------
  - analysis_status = 'completed', is_visible = true
  - tweeted_at IS NULL          (not yet posted)
  - event_type NOT IN ('OTHER') (noise excluded)
  - ABS(sentiment_score) >= min_score (default 0.30)
  - rcept_dt >= today - lookback_days (default 2 days)
  → sorted by final_score DESC, up to --limit items

Usage
-----
  python scripts/post_tweet.py               # post (up to 5 items)
  python scripts/post_tweet.py --dry-run     # preview only, no posting
  python scripts/post_tweet.py --limit 3     # post up to 3 items
  python scripts/post_tweet.py --min-score 0.5  # strong signals only

Required env vars (.env.local)
------------------------------
  TWITTER_API_KEY=...
  TWITTER_API_SECRET=...
  TWITTER_ACCESS_TOKEN=...
  TWITTER_ACCESS_TOKEN_SECRET=...

Tweet format (≤280 chars)
-------------------------
  🇰🇷 Kakao Corp [035720]
  📊 EARNINGS — Revenue miss Q1

  • Net Income: ₩6.6T (-43% YoY)
  • Op. Profit: ₩6.7T (+2% QoQ)

  https://k-marketinsight.com/signal/{uuid}
  #KoreanStocks #DART
"""

import os
import sys
import re
import argparse
import logging
from datetime import date, timedelta
from pathlib import Path

# ── Path / env setup ──────────────────────────────────────────────────────────
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

# ── Supabase client ───────────────────────────────────────────────────────────
_sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
_sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(_sb_url, _sb_key)

# ── Event type → emoji ────────────────────────────────────────────────────────
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

# Tweetable event types (OTHER excluded)
TWEETABLE_TYPES = frozenset(EVENT_EMOJI.keys()) - {"OTHER"}

BASE_URL   = "https://k-marketinsight.com/signal"
HASHTAGS   = "#KoreanStocks #DART"
_T_URL_W   = 23   # Twitter t.co fixed URL weight
_MAX_TWEET = 275  # 5-char buffer below 280

# Korean character detector — signals that need re-analysis
_KR = re.compile(r"[가-힣]")

# ── KRW number compaction ─────────────────────────────────────────────────────

_KRW_COMMA_RE = re.compile(r'(\d{1,3}(?:,\d{3})+)\s*KRW')
_KRW_MIL_RE   = re.compile(r'([\d,]+(?:\.\d+)?)\s*million\s*KRW', re.IGNORECASE)


def _fmt_krw(n: float) -> str:
    if n >= 1e12:  return f"{n/1e12:.3g}T KRW"
    if n >= 1e9:   return f"{n/1e9:.3g}B KRW"
    if n >= 1e6:   return f"{n/1e6:.3g}M KRW"
    return f"{n:,.0f} KRW"


def compact_krw(text: str) -> str:
    """Compact verbose KRW figures: 2,971,838,400 KRW → 2.97B KRW."""
    text = _KRW_COMMA_RE.sub(lambda m: _fmt_krw(float(m.group(1).replace(",", ""))), text)
    text = _KRW_MIL_RE.sub(lambda m: _fmt_krw(float(m.group(1).replace(",", "")) * 1_000_000), text)
    return text


# ── Headline post-processing ──────────────────────────────────────────────────

# Matches generic headlines like "UniTestInc Contract", "Contract Update"
_GENERIC_HL_RE = re.compile(
    r'^.{0,25}\s+(contract|update|report|announcement|notice|decision)\.?$',
    re.IGNORECASE,
)


def _strip_corp_prefix(headline: str, corp: str) -> str:
    """Remove leading company name from headline when it's already shown on line 1."""
    if not corp:
        return headline
    for prefix in [corp, " ".join(corp.split()[:2])]:
        if not prefix or len(prefix) < 3:
            continue
        if headline.lower().startswith(prefix.lower()):
            rest = headline[len(prefix):].lstrip(" .,—-–")
            # Only strip if remainder is meaningful (≥ 2 words)
            if rest and len(rest.split()) >= 2:
                return rest
    return headline


def _strengthen_headline(headline: str, event: str, kn_list: list) -> str:
    """Replace generic headlines with value-driven ones using key_numbers."""
    if not _GENERIC_HL_RE.match(headline.strip()):
        return headline
    for kn in kn_list[:2]:
        kn_c = compact_krw(re.sub(r'^[•\-]\s*', '', str(kn)))
        m = re.search(r'[\d.]+[BMTK]?\s*(?:KRW|%|Shares)', kn_c)
        if m:
            val = m.group(0)
            return {
                "CONTRACT": f"Wins {val} contract",
                "DILUTION": f"Capital raise {val}",
                "BUYBACK":  f"Buyback {val}",
                "DISPOSAL": f"Disposal {val}",
                "DIVIDEND": f"Dividend {val}",
                "CAPEX":    f"Investment {val}",
            }.get(event, headline)
    return headline


# ── Company name display cleaner ──────────────────────────────────────────────

_LEGAL_SUFFIX_RE = re.compile(
    r'[\s,\.]*(?:co\.?,?\s*ltd\.?|corp(?:oration)?\.?|inc\.?|ltd\.?|llc\.?|'
    r'plc\.?|company|corporation|limited|holdings?|group|co\.,\s*ltd\.?)\s*$',
    re.IGNORECASE,
)
_AMP_SUFFIX_RE = re.compile(r'\s*&\s*\w[\w\s]*$')
_ABBREV_RE     = re.compile(r'^[A-Z]{1,4}$')   # KCC, HD, GS, SK, LG, AP, NC …


def clean_corp_name(name: str) -> str:
    """
    Remove legal suffixes and produce a clean display name.
    'MIRAE ASSET SECURITIES CO.,LTD.' → 'Mirae Asset Securities'
    'KCC ENGINEERING & CONSTRUCTION'  → 'KCC Engineering'
    'PearlAbyss Corp.'                → 'PearlAbyss'
    """
    n = name.strip()
    # Remove legal suffixes (iterate in case of stacked suffixes)
    prev = None
    while prev != n:
        prev = n
        n = _LEGAL_SUFFIX_RE.sub('', n).strip().rstrip(',. ')
    # Remove trailing industry descriptor after "&"
    n = _AMP_SUFFIX_RE.sub('', n).strip()
    if not n:
        return name

    # Determine casing: if name is mostly uppercase → apply title case
    alpha = [c for c in n if c.isalpha()]
    upper_ratio = sum(1 for c in alpha if c.isupper()) / max(len(alpha), 1)
    if upper_ratio > 0.7:
        return ' '.join(
            w if _ABBREV_RE.match(w) else w.capitalize()
            for w in n.split()
        )
    # Mixed-case name (PearlAbyss, UniTestInc, SolDefense) — keep as-is
    return n


# ── Key-number simplifier ─────────────────────────────────────────────────────

_PAREN_RE       = re.compile(r'\s*\(.*')
_COMMA_TAIL_RE  = re.compile(r',\s+\S.*$')
# Metric labels that add little value as supporting lines
_LOW_VALUE_KN   = re.compile(
    r'^[•\-]?\s*(?:recent\s+(?:annual\s+)?revenue|annual\s+revenue)',
    re.IGNORECASE,
)


def _simplify_kn(kn: str) -> str:
    """
    Strip parenthetical notes and noisy trailing clauses from key_numbers.
    '• Revenue: 14.4B KRW (138.4% YoY growth)' → '• Revenue: 14.4B KRW'
    """
    kn = _PAREN_RE.sub('', kn)           # remove (...) and everything after
    m = _COMMA_TAIL_RE.search(kn)
    if m and m.start() > 10:
        kn = kn[:m.start()]              # trim long comma clauses
    return kn.strip().rstrip(',.')


# ── Headline case normaliser ──────────────────────────────────────────────────

_LOWER_TAIL = frozenset({
    'contract', 'contracts', 'earnings', 'report', 'reports',
    'update', 'announcement', 'notice', 'decision',
    'dividend', 'acquisition', 'investment', 'disposal', 'buyback',
})


def _normalize_headline_case(headline: str) -> str:
    """Lowercase trailing generic event words for a more natural, less robotic tone."""
    words = headline.split()
    if words and words[-1].lower() in _LOWER_TAIL:
        words[-1] = words[-1].lower()
    return ' '.join(words)


# ── Twitter weighted character count ─────────────────────────────────────────

def twitter_weight(text: str) -> int:
    """
    Approximate Twitter weighted character count.
    - CJK / full-width: 2
    - Emoji (above BMP): 2
    - URL: handled separately by caller
    - Everything else: 1
    """
    import unicodedata
    count = 0
    for ch in text:
        if unicodedata.east_asian_width(ch) in ("W", "F"):
            count += 2
        elif ord(ch) > 0xFFFF:   # Supplementary plane (mostly emoji)
            count += 2
        else:
            count += 1
    return count


def tweet_len(text: str, url: str) -> int:
    """
    Weighted tweet length including URL.
    Twitter replaces any URL with a t.co 23-char link,
    so subtract actual URL weight and add 23.
    """
    url_actual = twitter_weight(url)
    return twitter_weight(text) - url_actual + _T_URL_W


# ── Tweet text builder ────────────────────────────────────────────────────────

def _trunc(text: str, max_len: int) -> str:
    """Truncate to max_len chars, appending … if cut."""
    return text if len(text) <= max_len else text[:max_len - 1] + "…"


def build_tweet(row: dict) -> tuple[str, int]:
    """
    Build (tweet_text, twitter_weight) from a disclosure_insights row.
    Auto-adjusts to fit within _MAX_TWEET (275) weighted chars.
    """
    corp = (row.get("corp_name_en") or row.get("corp_name") or "Unknown").strip()
    code = (row.get("stock_code") or "").strip()
    event = (row.get("event_type") or "OTHER").strip()
    emoji = EVENT_EMOJI.get(event, "📄")
    key_numbers: list = row.get("key_numbers") or []
    sig_id = row["id"]

    # Headline: strip corp prefix → strengthen if generic → normalize case → truncate
    raw_hl = (row.get("headline") or "").strip()
    raw_hl = _strip_corp_prefix(raw_hl, corp)
    raw_hl = _strengthen_headline(raw_hl, event, key_numbers)
    raw_hl = _normalize_headline_case(raw_hl)
    headline = _trunc(raw_hl, 55)

    url = f"{BASE_URL}/{sig_id}"

    # Line 1: clean company name + ticker code (no ugly truncation)
    corp_display = clean_corp_name(corp)
    corp_line = corp_display
    if code:
        corp_line += f" [{code}]"

    # Line 2: emoji + headline
    event_line = f"{emoji} {headline}"

    # Key numbers: simplify (strip parentheticals) → compact KRW → cap length
    # Skip low-value labels (Recent Revenue, Annual Revenue) as supporting lines.
    # For CONTRACT tweets, skip "Contract Amount" if the amount is already in the headline.
    _contract_amount_re = re.compile(r'contract\s+amount', re.IGNORECASE)
    _headline_has_value = bool(re.search(r'[\d.]+[BMTK]?\s*KRW', headline))
    raw_kns = [
        kn for kn in key_numbers
        if not _LOW_VALUE_KN.match(str(kn))
        and not (event == "CONTRACT" and _headline_has_value
                 and _contract_amount_re.search(str(kn)))
    ]
    kn_lines: list[str] = []
    for kn in raw_kns[:2]:
        kn_str = _simplify_kn(compact_krw(str(kn).strip()))
        if not kn_str.startswith("•"):
            kn_str = "• " + kn_str
        kn_lines.append(_trunc(kn_str, 52))

    def _assemble(kn: list[str]) -> str:
        parts = [corp_line, ""]          # blank line after company name
        parts.append(event_line)
        if kn:
            parts.append("")
            parts.extend(kn)
        parts.append("")
        parts.append(url)
        parts.append("")                 # blank line before hashtags
        parts.append(HASHTAGS)
        return "\n".join(parts)

    # Try 2 key numbers → 1 → 0 until it fits
    for n in (2, 1, 0):
        text = _assemble(kn_lines[:n])
        w = tweet_len(text, url)
        if w <= _MAX_TWEET:
            return text, w

    # Last resort: shorten headline
    headline = _trunc(headline, 35)
    event_line = f"{emoji} {headline}"
    text = _assemble([])
    return text, tweet_len(text, url)


# ── Fetch pending queue ───────────────────────────────────────────────────────

def fetch_queue(min_score: float, lookback_days: int, limit: int) -> list[dict]:
    """
    Fetch high-quality disclosures pending a tweet.
    abs(sentiment_score) filter and Korean text guard applied client-side.
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
        .limit(limit * 5)   # extra buffer for client-side filtering
        .execute()
    )

    rows = res.data or []

    filtered = []
    for r in rows:
        if r.get("sentiment_score") is None:
            continue
        if abs(float(r["sentiment_score"])) < min_score:
            continue

        # Skip rows with no English company name
        corp_en = (r.get("corp_name_en") or "").strip()
        if not corp_en:
            logger.warning(
                f"  [SKIP] No English company name — corp_name={r.get('corp_name')}  "
                f"id={r['id'][:8]}..."
            )
            continue

        # Skip rows whose corp name, headline, or key_numbers contain Korean characters
        # (indicates AI output language failure — needs re-analysis)
        headline_text = r.get("headline") or ""
        kn_text = " ".join(r.get("key_numbers") or [])
        if _KR.search(corp_en) or _KR.search(headline_text) or _KR.search(kn_text):
            logger.warning(
                f"  [SKIP] Korean text in signal — corp={corp_en}  "
                f"id={r['id'][:8]}... — re-run auto_analyst to regenerate in English"
            )
            continue

        filtered.append(r)

    return filtered[:limit]


# ── Post to Twitter ───────────────────────────────────────────────────────────

def post_tweet(text: str, api_key: str, api_secret: str,
               access_token: str, access_secret: str) -> str | None:
    """
    Post a tweet via Twitter API v2 (OAuth 1.0a User Context).
    Returns tweet_id on success, None on failure.
    """
    try:
        import tweepy  # noqa: PLC0415
    except ImportError:
        logger.error("tweepy not installed — run `pip install tweepy` and retry")
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
        logger.error(f"Tweet post failed: {exc}")
        return None


def mark_tweeted(row_id: str) -> None:
    """Record tweeted_at timestamp in DB."""
    from datetime import datetime, timezone
    supabase.table("disclosure_insights").update({
        "tweeted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", row_id).execute()


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Post DART disclosure signals to X (Twitter)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--dry-run",       action="store_true",
                        help="Preview tweet text only, do not post")
    parser.add_argument("--output",        type=str,   default="tweets_draft.txt",
                        help="Output file for dry-run (default: tweets_draft.txt, UTF-8)")
    parser.add_argument("--limit",         type=int,   default=5,
                        help="Max items to post (default: 5)")
    parser.add_argument("--min-score",     type=float, default=0.30,
                        help="Min abs(sentiment_score) (default: 0.30)")
    parser.add_argument("--lookback-days", type=int,   default=2,
                        help="Include disclosures from last N days (default: 2)")
    args = parser.parse_args()

    # Load Twitter credentials
    api_key      = os.environ.get("TWITTER_API_KEY")
    api_secret   = os.environ.get("TWITTER_API_SECRET")
    access_token = os.environ.get("TWITTER_ACCESS_TOKEN")
    access_secret= os.environ.get("TWITTER_ACCESS_TOKEN_SECRET")

    creds_ok = all([api_key, api_secret, access_token, access_secret])
    if not creds_ok and not args.dry_run:
        logger.warning(
            "Twitter credentials not set — switching to --dry-run mode.\n"
            "  Add the following to .env.local:\n"
            "    TWITTER_API_KEY=...\n"
            "    TWITTER_API_SECRET=...\n"
            "    TWITTER_ACCESS_TOKEN=...\n"
            "    TWITTER_ACCESS_TOKEN_SECRET=..."
        )
        args.dry_run = True

    logger.info(
        f"Fetching tweet queue | "
        f"min_score={args.min_score}  lookback={args.lookback_days}d  limit={args.limit}"
    )
    queue = fetch_queue(args.min_score, args.lookback_days, args.limit)

    if not queue:
        logger.info("✅ No pending signals — done")
        return

    logger.info(f"  → {len(queue)} item(s) found")

    # Dry-run: save to file (UTF-8 for Windows Notepad)
    if args.dry_run:
        out_path = Path(args.output)
        lines: list[str] = []
        total = len(queue)
        for i, row in enumerate(queue, 1):
            tweet_text, tw_len = build_tweet(row)
            score = row.get("sentiment_score") or 0
            event = row.get("event_type") or ""
            sid   = row["id"][:8]
            lines.append(f"── {i}/{total} {'─'*40}")
            lines.append("")
            lines.append(tweet_text)
            lines.append(f"  {tw_len}/280 · score={score:+.2f} · {event} · id:{sid}")
            lines.append("")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        logger.info(f"[DRY-RUN] {len(queue)} item(s) saved → {out_path.resolve()}")
        logger.info("  Open with: notepad tweets_draft.txt")
        return

    # Post in order
    posted = 0
    for row in queue:
        tweet_text, tw_len = build_tweet(row)
        corp_label = (row.get("corp_name_en") or row.get("corp_name") or "?")[:30]
        score = row.get("sentiment_score") or 0

        logger.info(f"  {corp_label}  |  {row.get('event_type')}  |  {tw_len}/280")

        tweet_id = post_tweet(
            tweet_text, api_key, api_secret,    # type: ignore[arg-type]
            access_token, access_secret         # type: ignore[arg-type]
        )
        if tweet_id:
            mark_tweeted(row["id"])
            logger.info(f"  Posted — tweet_id={tweet_id}")
            posted += 1
        else:
            logger.warning("  Post failed — skipping to next")

    logger.info(f"\n{posted}/{len(queue)} item(s) posted")


if __name__ == "__main__":
    main()
