# Data Pipeline Validation Procedures

> Pipeline: DART crawler (Railway) → `disclosure_insights` → Groq analysis → scoring → frontend

---

## 1. DART Ingestion Validation

### Duplicate Detection
```sql
-- Find duplicate rcept_no entries (should return 0 rows)
SELECT rcept_no, COUNT(*) AS cnt
FROM disclosure_insights
GROUP BY rcept_no
HAVING COUNT(*) > 1;
```

| Check | Priority | Pass Condition |
|---|---|---|
| No duplicate `rcept_no` | `[CRITICAL]` | 0 rows returned |
| `stock_code` not null | `[CRITICAL]` | 0 rows in query below |
| `rcept_dt` is valid KST date string (YYYYMMDD) | `[HIGH]` | matches pattern |
| `analysis_retry_count` ≤ 3 for all pending rows | `[HIGH]` | see query below |

```sql
-- Missing stock_code
SELECT id, rcept_no, corp_name FROM disclosure_insights
WHERE stock_code IS NULL OR stock_code = ''
LIMIT 20;

-- Rows stuck retrying (should be 0 after pipeline stabilizes)
SELECT id, rcept_no, analysis_status, analysis_retry_count
FROM disclosure_insights
WHERE analysis_retry_count >= 3 AND analysis_status NOT IN ('completed', 'skipped')
LIMIT 20;

-- Timezone sanity: rcept_dt should be YYYYMMDD format (KST)
SELECT id, rcept_dt FROM disclosure_insights
WHERE rcept_dt !~ '^\d{8}$'
LIMIT 10;
```

### Malformed Content Detection
```sql
-- Empty or very short raw content (likely ingestion failure)
SELECT id, rcept_no, corp_name, LENGTH(content) AS content_len
FROM disclosure_insights
WHERE content IS NULL OR LENGTH(content) < 50
  AND analysis_status = 'pending'
LIMIT 20;
```

---

## 2. Event Processing Validation

### `event_type` Classification Accuracy

Valid values: `EARNINGS`, `CONTRACT`, `DILUTION`, `MNA`, `DIVIDEND`, `LEGAL`, `BUYBACK`, `DISPOSAL`, `CAPEX`, `OTHER`

```sql
-- Check for unknown event_type values
SELECT DISTINCT event_type, COUNT(*) AS cnt
FROM disclosure_insights
WHERE event_type IS NOT NULL
GROUP BY event_type
ORDER BY cnt DESC;
-- Any value not in the list above is a classifier bug
```

| Check | Priority | Pass Condition |
|---|---|---|
| All `event_type` values are in known set | `[HIGH]` | 0 unknown values |
| `event_type IS NULL` rows < 5% of total | `[MEDIUM]` | Low null rate |
| `corp_name_en` backfilled for top 500 stocks | `[HIGH]` | See query below |

```sql
-- corp_name_en backfill status (fetched via fetch_corp_name_en.py)
SELECT
  COUNT(*) FILTER (WHERE corp_name_en IS NOT NULL) AS has_en_name,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE corp_name_en IS NOT NULL) / COUNT(*), 1) AS pct
FROM disclosure_insights
WHERE stock_code IS NOT NULL;
```

### `analysis_status` State Machine

Valid transitions: `pending → processing → completed | failed | skipped | low_quality`

```sql
-- Rows stuck in 'processing' > 1 hour (Railway worker crash?)
SELECT id, rcept_no, corp_name, analysis_status, updated_at
FROM disclosure_insights
WHERE analysis_status = 'processing'
  AND updated_at < NOW() - INTERVAL '1 hour'
LIMIT 20;

-- Daily distribution of statuses (last 7 days)
SELECT
  analysis_status,
  COUNT(*) AS cnt,
  DATE_TRUNC('day', created_at) AS day
FROM disclosure_insights
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY analysis_status, day
ORDER BY day DESC, cnt DESC;

-- Failed rows that haven't been retried
SELECT id, rcept_no, corp_name, analysis_retry_count, analysis_status, updated_at
FROM disclosure_insights
WHERE analysis_status = 'failed' AND analysis_retry_count < 3
ORDER BY updated_at DESC
LIMIT 20;
```

---

## 3. Scoring Validation

Scoring scripts: `scripts/compute_base_score.py`, `scripts/compute_alpha_score.py`

### Score Range Checks

All scores must be in [0, 100]. `signal_tag` must be from the defined tag set.

```sql
-- Out-of-range base_score
SELECT id, rcept_no, corp_name, base_score, final_score, alpha_score
FROM disclosure_insights
WHERE base_score < 0 OR base_score > 100
   OR final_score < 0 OR final_score > 100
   OR alpha_score < 0 OR alpha_score > 100;

-- Null scores on completed rows (should be 0 after scoring batch)
SELECT COUNT(*) AS missing_scores
FROM disclosure_insights
WHERE analysis_status = 'completed'
  AND (base_score IS NULL OR final_score IS NULL);

-- signal_tag distribution
SELECT signal_tag, COUNT(*) AS cnt
FROM disclosure_insights
WHERE signal_tag IS NOT NULL
GROUP BY signal_tag
ORDER BY cnt DESC;
```

### Stale Data Check

Rows with `rcept_dt` older than 30 days that are still `pending` or `failed` indicate a backlog or pipeline stall.

```sql
-- Stale pending rows (older than 30 days, still not processed)
SELECT COUNT(*) AS stale_count
FROM disclosure_insights
WHERE analysis_status IN ('pending', 'failed')
  AND TO_DATE(rcept_dt, 'YYYYMMDD') < CURRENT_DATE - 30;
-- Target: 0 (or investigate if > 0)
```

### Score Distribution Sanity

```sql
-- Score quartiles for completed rows (last 30 days)
SELECT
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY final_score) AS p25,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY final_score) AS median,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY final_score) AS p75,
  AVG(final_score) AS avg_score,
  MIN(final_score) AS min_score,
  MAX(final_score) AS max_score
FROM disclosure_insights
WHERE analysis_status = 'completed'
  AND TO_DATE(rcept_dt, 'YYYYMMDD') > CURRENT_DATE - 30;
-- If median = 0 or max = 0, scoring batch has not run
```

---

## 4. Groq Analysis Validation

Script: `scripts/auto_analyst.py` (Railway, `--limit 30` per batch)

| Check | Priority | Pass Condition |
|---|---|---|
| Groq API rate limit: ≤ 30 RPM, ≤ 1000 RPD | `[CRITICAL]` | Check Railway logs for 429 errors |
| `analysis_status` transitions to `completed` within 15 min of `pending` | `[HIGH]` | |
| `headline` field non-null on completed rows | `[HIGH]` | See query below |
| `key_numbers` field is valid JSON array | `[MEDIUM]` | |
| `ai_summary` length > 100 chars (not truncated) | `[MEDIUM]` | |

```sql
-- Completed rows missing headline (Groq response parsing issue)
SELECT id, rcept_no, corp_name, analysis_status
FROM disclosure_insights
WHERE analysis_status = 'completed'
  AND (headline IS NULL OR headline = '')
ORDER BY updated_at DESC
LIMIT 20;

-- Validate key_numbers is parseable JSON (Postgres JSON cast)
SELECT id, rcept_no
FROM disclosure_insights
WHERE analysis_status = 'completed'
  AND key_numbers IS NOT NULL
  AND key_numbers::text NOT LIKE '[%';
-- Should return 0 rows
```

---

## 5. `event_stats` and `loan_stats` Freshness

```sql
-- Check most recent event_stats entry
SELECT MAX(date) AS latest_date, COUNT(*) AS total_rows FROM event_stats;

-- Check loan_stats freshness
SELECT MAX(date) AS latest_date, COUNT(*) AS total_rows FROM loan_stats;

-- sector_signals freshness (should have entries from last trading day)
SELECT MAX(date) AS latest_date, COUNT(DISTINCT sector) AS sectors FROM sector_signals;
```

Expected: `latest_date` within 1–2 trading days of today.

---

## 6. `market_index_history` Validation

```sql
-- Last 5 entries (should include latest trading days)
SELECT date, index_type, close_value
FROM market_index_history
ORDER BY date DESC
LIMIT 10;

-- Check for gaps in trading day sequence
SELECT date, LAG(date) OVER (ORDER BY date) AS prev_date,
       date - LAG(date) OVER (ORDER BY date) AS gap_days
FROM market_index_history
ORDER BY date DESC
LIMIT 20;
-- Gaps > 5 days indicate missing data (holidays acceptable, > 7 = problem)
```
