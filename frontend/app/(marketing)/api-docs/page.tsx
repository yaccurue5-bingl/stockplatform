'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import CodeBlock from '@/components/landing/ui/CodeBlock';
import LangTabs, { type LangTab } from '@/components/landing/ui/LangTabs';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'Introduction' | 'Authentication' | 'Errors' | 'Endpoints' | 'Examples';

interface Param {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}
interface ResponseField {
  field: string;
  type: string;
  desc: string;
}
interface Endpoint {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  desc: string;
  pathParams?: Param[];
  queryParams?: Param[];
  responseFields: ResponseField[];
  response: string;
  examples: LangTab[];
}
interface ExampleScenario {
  id: string;
  title: string;
  desc: string;
  tabs: LangTab[];
}

// ─── Static data ─────────────────────────────────────────────────────────────

const sections: Section[] = ['Introduction', 'Authentication', 'Errors', 'Endpoints', 'Examples'];

const BASE_URL = 'https://k-marketinsight.com/api/v1';

const endpoints: Endpoint[] = [
  {
    id: 'disclosures',
    method: 'GET',
    path: '/v1/disclosures',
    desc: 'Corporate disclosures with AI-generated analysis: sentiment, event classification, and composite signal scores. Company/report names are returned in English where available. Pro plan additionally returns headline, financial_impact, and risk_factors. Cache: 5 min.',
    queryParams: [
      { name: 'date_from',      type: 'string',  required: false, desc: 'Start date (YYYY-MM-DD). Clamped to your plan’s history window.' },
      { name: 'date_to',        type: 'string',  required: false, desc: 'End date (YYYY-MM-DD). Defaults to today.' },
      { name: 'stock_code',     type: 'string',  required: false, desc: 'KRX 6-digit stock code (e.g. 005930). Filters to one company.' },
      { name: 'sentiment',      type: 'string',  required: false, desc: 'POSITIVE | NEGATIVE | NEUTRAL' },
      { name: 'event_type',     type: 'string',  required: false, desc: 'e.g. EARNINGS, CONTRACT, DILUTION, BUYBACK, DISPOSAL, RIGHTS, MERGER, SPINOFF, EQUITY' },
      { name: 'signal_tag',     type: 'string',  required: false, desc: 'One of: 🔥 High Conviction, 📉 Earnings Miss, ⚖️ Legal Alert, ⛔ High Risk, ⚠️ Dilution Risk, ⚠️ Dilution Watch, 🔄 Buyback Signal' },
      { name: 'alpha_score_min', type: 'number', required: false, desc: 'Minimum alpha_score (inclusive).' },
      { name: 'sort_by',        type: 'string',  required: false, desc: 'rcept_dt | final_score | base_score | alpha_score. Default: rcept_dt.' },
      { name: 'limit',          type: 'integer', required: false, desc: 'Results returned. Range: 1–200. Default: 50.' },
    ],
    responseFields: [
      { field: 'data',                       type: 'array',   desc: 'List of disclosure objects.' },
      { field: 'data[].id',                  type: 'string',  desc: 'Internal disclosure ID.' },
      { field: 'data[].rcept_no',            type: 'string',  desc: 'DART receipt number.' },
      { field: 'data[].corp_name',           type: 'string',  desc: 'Company name (English where available, otherwise Korean).' },
      { field: 'data[].stock_code',          type: 'string',  desc: 'KRX 6-digit stock code.' },
      { field: 'data[].report_name',         type: 'string',  desc: 'Filing type (English where available).' },
      { field: 'data[].rcept_dt',            type: 'string',  desc: 'Filing date (YYYYMMDD).' },
      { field: 'data[].sentiment_score',     type: 'number',  desc: 'AI sentiment score, roughly -1 (negative) to 1 (positive).' },
      { field: 'data[].event_type',          type: 'string',  desc: 'AI-assigned event classification.' },
      { field: 'data[].ai_summary',          type: 'string',  desc: 'AI-generated summary of the filing.' },
      { field: 'data[].final_score',         type: 'number',  desc: 'Composite signal score.' },
      { field: 'data[].alpha_score',         type: 'number',  desc: 'Score component estimating expected excess return.' },
      { field: 'data[].signal_tag',          type: 'string',  desc: 'Emoji-prefixed signal label, e.g. "🔥 High Conviction".' },
      { field: 'data[].risk_factors',        type: 'string',  desc: 'Pro plan only. AI-identified risk factors.' },
      { field: 'total',                      type: 'integer', desc: 'Number of rows in this response (not the total match count).' },
      { field: 'date_from',                  type: 'string',  desc: 'Resolved start date after plan clamping.' },
      { field: 'date_to',                    type: 'string',  desc: 'Resolved end date.' },
    ],
    response: `{
  "data": [
    {
      "id": "d3f1a2b4-...",
      "rcept_no": "20260310000123",
      "corp_name": "Samsung Electronics",
      "stock_code": "005930",
      "report_name": "Quarterly Report",
      "rcept_dt": "20260310",
      "sentiment_score": 0.42,
      "event_type": "EARNINGS",
      "ai_summary": "Q1 operating profit beat consensus, driven by HBM demand.",
      "base_score": 61.2,
      "final_score": 74.8,
      "alpha_score": 0.83,
      "signal_tag": "🔥 High Conviction"
    }
  ],
  "total": 1,
  "date_from": "2026-03-07",
  "date_to": "2026-03-10"
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl -G ${BASE_URL}/disclosures \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d stock_code=005930 \\
  -d date_from=2026-03-01 \\
  -d limit=5`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

res = requests.get(
    "${BASE_URL}/disclosures",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={"stock_code": "005930", "date_from": "2026-03-01", "limit": 5},
)
res.raise_for_status()

for d in res.json()["data"]:
    print(f"{d['corp_name']} | {d['event_type']} | signal={d['signal_tag']}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const res = await fetch(
  '${BASE_URL}/disclosures?stock_code=005930&date_from=2026-03-01&limit=5',
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
);
if (!res.ok) throw new Error(\`API error \${res.status}\`);

const { data, total } = await res.json();
console.log(\`\${total} disclosures found\`);
data.forEach((d: any) =>
  console.log(\`\${d.corp_name} | \${d.event_type} | \${d.signal_tag}\`)
);`,
      },
    ],
  },

  {
    id: 'events',
    method: 'GET',
    path: '/v1/events',
    desc: 'Historical return statistics per event type (event_stats), plus a list of recent classified events. Useful for gauging how a given event type has historically moved prices before acting on a live signal. Cache: 60 min.',
    queryParams: [
      { name: 'date_from',  type: 'string',  required: false, desc: 'Start date for recent_events (YYYY-MM-DD). Clamped to your plan’s history window.' },
      { name: 'date_to',    type: 'string',  required: false, desc: 'End date for recent_events (YYYY-MM-DD). Defaults to today.' },
      { name: 'stock_code', type: 'string',  required: false, desc: 'KRX 6-digit stock code. Filters recent_events to one company.' },
      { name: 'event_type', type: 'string',  required: false, desc: 'Filters both statistics and recent_events, e.g. EARNINGS, CONTRACT, DILUTION.' },
      { name: 'limit',      type: 'integer', required: false, desc: 'Max rows in recent_events. Range: 1–200. Default: 50.' },
    ],
    responseFields: [
      { field: 'statistics',                  type: 'array',  desc: 'Historical return stats, one row per event_type.' },
      { field: 'statistics[].event_type',     type: 'string', desc: 'Event type classification.' },
      { field: 'statistics[].avg_5d_return',  type: 'number', desc: 'Average return 5 trading days after the event (%).' },
      { field: 'statistics[].avg_20d_return', type: 'number', desc: 'Average return 20 trading days after the event (%).' },
      { field: 'statistics[].sample_size',    type: 'integer', desc: 'Number of historical events behind this statistic.' },
      { field: 'recent_events',               type: 'array',  desc: 'Recently filed, classified events (is_visible only).' },
      { field: 'recent_events[].stock_code',  type: 'string', desc: 'KRX 6-digit stock code.' },
      { field: 'recent_events[].corp_name',   type: 'string', desc: 'Company name (English where available).' },
      { field: 'recent_events[].event_type',  type: 'string', desc: 'AI-assigned event classification.' },
      { field: 'recent_events[].disclosure_date', type: 'string', desc: 'Filing date (YYYYMMDD).' },
      { field: 'recent_events[].final_score', type: 'number', desc: 'Composite signal score.' },
      { field: 'recent_events[].signal_tag',  type: 'string', desc: 'Emoji-prefixed signal label.' },
      { field: 'date_from',                   type: 'string', desc: 'Resolved start date after plan clamping.' },
      { field: 'date_to',                     type: 'string', desc: 'Resolved end date.' },
    ],
    response: `{
  "statistics": [
    { "event_type": "EARNINGS", "avg_5d_return": 1.8, "avg_20d_return": 3.1, "std_5d": 4.2, "sample_size": 1204 }
  ],
  "recent_events": [
    {
      "stock_code": "005930",
      "corp_name": "Samsung Electronics",
      "event_type": "EARNINGS",
      "disclosure_date": "20260310",
      "final_score": 74.8,
      "signal_tag": "🔥 High Conviction"
    }
  ],
  "date_from": "2026-03-07",
  "date_to": "2026-03-10"
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl -G ${BASE_URL}/events \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d event_type=EARNINGS \\
  -d limit=5`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

res = requests.get(
    "${BASE_URL}/events",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={"event_type": "EARNINGS", "limit": 5},
)
data = res.json()

for s in data["statistics"]:
    print(f"{s['event_type']:<12} avg_5d={s['avg_5d_return']:+.2f}%  n={s['sample_size']}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const res = await fetch(
  '${BASE_URL}/events?event_type=EARNINGS&limit=5',
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
);
const { statistics, recent_events } = await res.json();
console.log(\`\${recent_events.length} recent events, \${statistics.length} event types\`);`,
      },
    ],
  },

  {
    id: 'sector-signals',
    method: 'GET',
    path: '/v1/sector-signals',
    desc: 'Sector-level sentiment aggregation (5-level scale: HIGH_CONVICTION / CONSTRUCTIVE / NEUTRAL / NEGATIVE / HIGH_RISK) with a confidence score and disclosure counts driving each signal. Cache: 10 min.',
    queryParams: [
      { name: 'date_from', type: 'string',  required: false, desc: 'Start date (YYYY-MM-DD). Clamped to your plan’s history window.' },
      { name: 'date_to',   type: 'string',  required: false, desc: 'End date (YYYY-MM-DD). Defaults to today.' },
      { name: 'sector',    type: 'string',  required: false, desc: 'Filter to a single sector name.' },
      { name: 'signal',    type: 'string',  required: false, desc: 'HIGH_CONVICTION | CONSTRUCTIVE | NEUTRAL | NEGATIVE | HIGH_RISK' },
      { name: 'limit',     type: 'integer', required: false, desc: 'Results returned. Range: 1–200. Default: 50.' },
    ],
    responseFields: [
      { field: 'data',                     type: 'array',  desc: 'Sector signal rows, newest date first.' },
      { field: 'data[].date',               type: 'string', desc: 'Signal date.' },
      { field: 'data[].sector',             type: 'string', desc: 'Sector name (Korean source field).' },
      { field: 'data[].sector_en',          type: 'string', desc: 'Sector name in English.' },
      { field: 'data[].signal',             type: 'string', desc: 'HIGH_CONVICTION (score ≥70) | CONSTRUCTIVE (≥55) | NEUTRAL (≥40) | NEGATIVE (≥25) | HIGH_RISK (<25)' },
      { field: 'data[].confidence',         type: 'number', desc: 'Confidence score for the signal.' },
      { field: 'data[].disclosure_count',   type: 'integer', desc: 'Number of disclosures behind this signal.' },
      { field: 'data[].positive_count',     type: 'integer', desc: 'Positive-sentiment disclosure count.' },
      { field: 'data[].negative_count',     type: 'integer', desc: 'Negative-sentiment disclosure count.' },
      { field: 'data[].neutral_count',      type: 'integer', desc: 'Neutral-sentiment disclosure count.' },
      { field: 'data[].drivers',            type: 'string', desc: 'Short text description of what is driving the signal.' },
      { field: 'total',                     type: 'integer', desc: 'Number of rows in this response.' },
      { field: 'date_from',                 type: 'string', desc: 'Resolved start date.' },
      { field: 'date_to',                   type: 'string', desc: 'Resolved end date.' },
    ],
    response: `{
  "data": [
    {
      "date": "2026-03-10",
      "sector": "반도체",
      "sector_en": "Semiconductors",
      "signal": "HIGH_CONVICTION",
      "confidence": 0.74,
      "disclosure_count": 7,
      "positive_count": 5,
      "negative_count": 1,
      "neutral_count": 1,
      "drivers": "Strong earnings across 3 large-cap names"
    }
  ],
  "total": 1,
  "date_from": "2026-03-07",
  "date_to": "2026-03-10"
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl -G ${BASE_URL}/sector-signals \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d date_to=2026-03-10`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

res = requests.get(
    "${BASE_URL}/sector-signals",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={"date_to": "2026-03-10"},
)
for s in res.json()["data"][:3]:
    print(f"{s['sector_en']:<25} signal={s['signal']}  confidence={s['confidence']:.2f}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const res = await fetch(
  '${BASE_URL}/sector-signals?date_to=2026-03-10',
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
);
const { data } = await res.json();
data.slice(0, 3).forEach((s: any) =>
  console.log(\`\${s.sector_en.padEnd(25)} signal=\${s.signal} confidence=\${s.confidence}\`)
);`,
      },
    ],
  },

  {
    id: 'market-radar',
    method: 'GET',
    path: '/v1/market-radar',
    desc: 'Daily market snapshot: overall market signal, KOSPI/KOSDAQ change, foreign investor flow regime, top sector, and an AI summary. Cache: 15 min.',
    queryParams: [
      { name: 'date_from', type: 'string',  required: false, desc: 'Start date (YYYY-MM-DD). Clamped to your plan’s history window.' },
      { name: 'date_to',   type: 'string',  required: false, desc: 'End date (YYYY-MM-DD). Defaults to today.' },
      { name: 'limit',     type: 'integer', required: false, desc: 'Days returned. Range: 1–90. Default: 30.' },
    ],
    responseFields: [
      { field: 'data',                     type: 'array',  desc: 'One row per trading day, newest first.' },
      { field: 'data[].date',              type: 'string', desc: 'Trading date.' },
      { field: 'data[].market_signal',     type: 'string', desc: 'Overall market signal for the day.' },
      { field: 'data[].top_sector_en',     type: 'string', desc: 'Top-performing sector, English name.' },
      { field: 'data[].foreign_flow',      type: 'string', desc: 'Foreign investor net flow (e.g. "+8,300억원").' },
      { field: 'data[].regime',            type: 'string', desc: 'RISK_ON | RISK_OFF | null — derived from the sign of foreign_flow.' },
      { field: 'data[].kospi_change',      type: 'number', desc: 'KOSPI daily change, percent as a plain number (e.g. -4.9 means -4.9%, no % sign).' },
      { field: 'data[].kosdaq_change',     type: 'number', desc: 'KOSDAQ daily change, percent as a plain number.' },
      { field: 'data[].total_disclosures', type: 'integer', desc: 'Number of disclosures processed that day.' },
      { field: 'data[].summary',           type: 'string', desc: 'AI-generated summary of the day’s market. Korean-language only — there is no English variant for this field.' },
      { field: 'total',                    type: 'integer', desc: 'Number of rows in this response.' },
      { field: 'date_from',                type: 'string', desc: 'Resolved start date.' },
      { field: 'date_to',                  type: 'string', desc: 'Resolved end date.' },
    ],
    response: `{
  "data": [
    {
      "date": "2026-03-10",
      "market_signal": "Bullish",
      "top_sector_en": "Semiconductors",
      "foreign_flow": "+8,300억원",
      "regime": "RISK_ON",
      "kospi_change": 1.2,
      "kosdaq_change": 0.8,
      "total_disclosures": 142,
      "summary": "2026-03-10 시장은 강세 흐름을 보였습니다. KOSPI ▲1.20%, KOSDAQ ▲0.80%. 외국인 순매수: +8,300억원. (Korean-language only)"
    }
  ],
  "total": 1,
  "date_from": "2026-02-08",
  "date_to": "2026-03-10"
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl -G ${BASE_URL}/market-radar \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d limit=1`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

data = requests.get(
    "${BASE_URL}/market-radar",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={"limit": 1},
).json()["data"][0]

print(f"KOSPI {data['kospi_change']}  KOSDAQ {data['kosdaq_change']}  regime={data['regime']}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const { data } = await fetch(
  '${BASE_URL}/market-radar?limit=1',
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
).then(r => r.json());

console.log(\`KOSPI \${data[0].kospi_change}  regime=\${data[0].regime}\`);`,
      },
    ],
  },

  {
    id: 'signal-performance',
    method: 'GET',
    path: '/v1/signal-performance',
    desc: 'Forward-return performance statistics per event type, computed from historical outcomes (event_stats). Includes hit ratios, average/alpha returns, drawdown, and a letter grade. Cache: 60 min.',
    queryParams: [
      { name: 'event_type', type: 'string', required: false, desc: 'One of: EARNINGS, CONTRACT, DILUTION, BUYBACK, DISPOSAL, RIGHTS, MERGER, SPINOFF, EQUITY.' },
    ],
    responseFields: [
      { field: 'data',                     type: 'array',  desc: 'One row per event type, sorted by signal_score descending.' },
      { field: 'data[].event_type',        type: 'string', desc: 'Event type classification.' },
      { field: 'data[].sample_size',       type: 'integer', desc: 'Number of historical events behind this row.' },
      { field: 'data[].hit_ratio_5d',      type: 'number', desc: '% of events with a positive return 5 trading days out.' },
      { field: 'data[].hit_ratio_20d',     type: 'number', desc: '% of events with a positive return 20 trading days out.' },
      { field: 'data[].avg_5d_return',     type: 'number', desc: 'Average close-to-close return at 5 trading days (%).' },
      { field: 'data[].avg_20d_return',    type: 'number', desc: 'Average close-to-close return at 20 trading days (%).' },
      { field: 'data[].alpha_5d',          type: 'number', desc: '5-day return minus benchmark (KOSPI/KOSDAQ) return (%).' },
      { field: 'data[].alpha_20d',         type: 'number', desc: '20-day alpha (%).' },
      { field: 'data[].avg_mdd',           type: 'number', desc: 'Average maximum drawdown following the event (%).' },
      { field: 'data[].signal_grade',      type: 'string', desc: 'Letter grade: A+ / A / B / C / D.' },
      { field: 'data[].signal_score',      type: 'number', desc: 'Composite score, 0–100.' },
      { field: 'data[].updated_at',        type: 'string', desc: 'Last EOD batch update (ISO 8601).' },
      { field: 'notes',                    type: 'object', desc: 'Short definitions for alpha / trimmed / median fields.' },
    ],
    response: `{
  "data": [
    {
      "event_type": "EARNINGS",
      "sample_size": 1204,
      "hit_ratio_5d": 58.3,
      "hit_ratio_20d": 61.1,
      "avg_5d_return": 1.8,
      "avg_20d_return": 3.1,
      "alpha_5d": 0.9,
      "alpha_20d": 1.4,
      "avg_mdd": -2.3,
      "signal_grade": "A",
      "signal_score": 82.4,
      "updated_at": "2026-03-10T21:00:00Z"
    }
  ],
  "total": 1,
  "notes": {
    "alpha": "alpha = stock_return - benchmark_return (KOSPI for KOSPI-listed, KOSDAQ for KOSDAQ-listed)"
  },
  "updated_at": "2026-03-10T21:00:00Z"
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl -G ${BASE_URL}/signal-performance \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d event_type=EARNINGS`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

res = requests.get(
    "${BASE_URL}/signal-performance",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={"event_type": "EARNINGS"},
)
for row in res.json()["data"]:
    print(f"{row['event_type']}: grade={row['signal_grade']}  hit_5d={row['hit_ratio_5d']}%")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const res = await fetch(
  '${BASE_URL}/signal-performance?event_type=EARNINGS',
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
);
const { data } = await res.json();
console.log(data.map((r: any) => \`\${r.event_type}: \${r.signal_grade}\`));`,
      },
    ],
  },

  {
    id: 'performance-summary',
    method: 'GET',
    path: '/v1/performance/summary',
    desc: 'Summary statistics for a backtested trading strategy: total/annualized return, win rate, Sharpe ratio, max drawdown. Cache: 60 min (updated once per EOD batch).',
    queryParams: [
      { name: 'strategy', type: 'string', required: false, desc: 'Strategy name. Default: event_macro_v1.' },
    ],
    responseFields: [
      { field: 'data',                    type: 'object', desc: 'Summary object, or null if the strategy has no data yet.' },
      { field: 'data.total_return',       type: 'number', desc: 'Cumulative return over the backtest period (%).' },
      { field: 'data.annualized_return',  type: 'number', desc: 'Annualized return (%).' },
      { field: 'data.win_rate',           type: 'number', desc: 'Fraction of trades that were profitable.' },
      { field: 'data.sharpe_ratio',       type: 'number', desc: 'Sharpe ratio over the backtest period.' },
      { field: 'data.max_drawdown',       type: 'number', desc: 'Maximum peak-to-trough drawdown (%).' },
      { field: 'data.total_trades',       type: 'integer', desc: 'Total number of trades in the backtest.' },
      { field: 'data.period_start',       type: 'string', desc: 'Backtest start date.' },
      { field: 'data.period_end',         type: 'string', desc: 'Backtest end date.' },
      { field: 'data.holding_days',       type: 'string', desc: 'Holding period label, e.g. "T+3" (not a plain number).' },
      { field: 'strategy',                type: 'string', desc: 'The strategy name that was queried.' },
    ],
    response: `{
  "data": {
    "strategy_name": "event_macro_v1",
    "total_return": 24.6,
    "annualized_return": 11.2,
    "win_rate": 0.57,
    "avg_return": 1.3,
    "max_drawdown": -8.9,
    "sharpe_ratio": 1.14,
    "total_trades": 842,
    "risk_on_trades": 601,
    "score_threshold": 60,
    "holding_days": "T+3",
    "period_start": "2024-01-02",
    "period_end": "2026-03-10",
    "updated_at": "2026-03-10T21:00:00Z"
  },
  "strategy": "event_macro_v1"
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl ${BASE_URL}/performance/summary \\
  -H "X-API-Key: YOUR_API_KEY"`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

data = requests.get(
    "${BASE_URL}/performance/summary",
    headers={"X-API-Key": "YOUR_API_KEY"},
).json()["data"]

print(f"Total return: {data['total_return']}%  Sharpe: {data['sharpe_ratio']}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const { data } = await fetch(
  '${BASE_URL}/performance/summary',
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
).then(r => r.json());

console.log(\`Total return: \${data.total_return}%  Sharpe: \${data.sharpe_ratio}\`);`,
      },
    ],
  },

  {
    id: 'performance-equity-curve',
    method: 'GET',
    path: '/v1/performance/equity-curve',
    desc: 'Cumulative equity curve for a backtested strategy, starting from an index value of 100. Points are 3-day-return trades ordered by event date. Cache: 60 min.',
    queryParams: [
      { name: 'strategy', type: 'string', required: false, desc: 'Strategy name. Default: event_macro_v1.' },
      { name: 'regime',   type: 'string', required: false, desc: 'RISK_ON | RISK_OFF | all. Default: RISK_ON.' },
    ],
    responseFields: [
      { field: 'strategy',            type: 'string',  desc: 'Strategy name queried.' },
      { field: 'regime',              type: 'string',  desc: 'Regime filter applied.' },
      { field: 'points',              type: 'array',   desc: 'Equity curve points ordered by date ascending.' },
      { field: 'points[].date',       type: 'string',  desc: 'Trade event date.' },
      { field: 'points[].equity',     type: 'number',  desc: 'Cumulative equity index (start = 100).' },
      { field: 'points[].return_3d',  type: 'number',  desc: '3-day return for this trade (%).' },
      { field: 'final_equity',        type: 'number',  desc: 'Equity index at the last point.' },
      { field: 'total_trades',        type: 'integer', desc: 'Number of points returned.' },
    ],
    response: `{
  "strategy": "event_macro_v1",
  "regime": "RISK_ON",
  "points": [
    { "date": "2026-03-05", "equity": 121.4, "return_3d": 0.8 },
    { "date": "2026-03-10", "equity": 122.9, "return_3d": 1.2 }
  ],
  "final_equity": 122.9,
  "total_trades": 2
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl -G ${BASE_URL}/performance/equity-curve \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d regime=RISK_ON`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

data = requests.get(
    "${BASE_URL}/performance/equity-curve",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={"regime": "RISK_ON"},
).json()

print(f"Final equity: {data['final_equity']} over {data['total_trades']} trades")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const data = await fetch(
  '${BASE_URL}/performance/equity-curve?regime=RISK_ON',
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
).then(r => r.json());

console.log(\`Final equity: \${data.final_equity} over \${data.total_trades} trades\`);`,
      },
    ],
  },

  {
    id: 'performance-trades',
    method: 'GET',
    path: '/v1/performance/trades',
    desc: 'Individual backtest trade records. Uses offset pagination (not date-range filtering) since full trade history is meaningful regardless of recency. Row count is capped per plan: starter 50, pro 500. Cache: 60 min.',
    queryParams: [
      { name: 'strategy', type: 'string',  required: false, desc: 'Strategy name. Default: event_macro_v1.' },
      { name: 'regime',   type: 'string',  required: false, desc: 'RISK_ON | RISK_OFF | all. Default: all.' },
      { name: 'limit',    type: 'integer', required: false, desc: 'Rows returned, capped by your plan (starter: 50, pro: 500).' },
      { name: 'offset',   type: 'integer', required: false, desc: 'Pagination offset. Default: 0.' },
    ],
    responseFields: [
      { field: 'data',                  type: 'array',   desc: 'Trade rows for this page.' },
      { field: 'data[].stock_code',     type: 'string',  desc: 'KRX 6-digit stock code.' },
      { field: 'data[].event_date',     type: 'string',  desc: 'Trade entry date.' },
      { field: 'data[].final_score',    type: 'number',  desc: 'Composite signal score at entry.' },
      { field: 'data[].return_3d',      type: 'number',  desc: '3-day trade return (%).' },
      { field: 'data[].return_5d',      type: 'number',  desc: '5-day trade return (%).' },
      { field: 'data[].market_regime',  type: 'string',  desc: 'RISK_ON | RISK_OFF at entry.' },
      { field: 'page_summary',          type: 'object',  desc: 'Aggregates for the rows on this page only.' },
      { field: 'page_summary.win_rate', type: 'number',  desc: 'Fraction of this page’s trades with return_3d > 0.' },
      { field: 'total',                 type: 'integer', desc: 'Total matching trades across all pages.' },
      { field: 'limit',                 type: 'integer', desc: 'Effective limit applied (≤ plan_limit).' },
      { field: 'offset',                type: 'integer', desc: 'Offset applied.' },
      { field: 'plan_limit',            type: 'integer', desc: 'Max rows your plan allows per request.' },
    ],
    response: `{
  "data": [
    {
      "id": "t_8821",
      "stock_code": "005930",
      "event_date": "2026-03-10",
      "final_score": 74.8,
      "return_3d": 1.2,
      "return_5d": 1.8,
      "market_regime": "RISK_ON",
      "created_at": "2026-03-11T02:00:00Z"
    }
  ],
  "page_summary": { "count": 1, "win_rate": 1.0, "avg_r3": 1.2 },
  "total": 842,
  "limit": 50,
  "offset": 0,
  "strategy": "event_macro_v1",
  "regime": "all",
  "plan_limit": 50
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl -G ${BASE_URL}/performance/trades \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d regime=RISK_ON \\
  -d limit=20`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

res = requests.get(
    "${BASE_URL}/performance/trades",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={"regime": "RISK_ON", "limit": 20},
)
data = res.json()
print(f"Page win rate: {data['page_summary']['win_rate']:.0%}  total={data['total']}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const res = await fetch(
  '${BASE_URL}/performance/trades?regime=RISK_ON&limit=20',
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
);
const { data, page_summary, total } = await res.json();
console.log(\`Page win rate: \${page_summary.win_rate}  total=\${total}\`);`,
      },
    ],
  },
];

const exampleScenarios: ExampleScenario[] = [
  {
    id: 'quickstart',
    title: 'Quick Start',
    desc: 'Verify your API key and make your first two calls in under a minute.',
    tabs: [
      {
        label: 'curl',
        language: 'bash',
        code: `# 1. Check today's market snapshot
curl ${BASE_URL}/market-radar \\
  -H "X-API-Key: YOUR_API_KEY"

# 2. Fetch the 5 most recent disclosures
curl "${BASE_URL}/disclosures?limit=5" \\
  -H "X-API-Key: YOUR_API_KEY"`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

BASE    = "${BASE_URL}"
HEADERS = {"X-API-Key": "YOUR_API_KEY"}

# 1. Market snapshot (most recent day)
radar = requests.get(f"{BASE}/market-radar", headers=HEADERS, params={"limit": 1}).json()
day = radar["data"][0]
print(f"KOSPI {day['kospi_change']}  signal={day['market_signal']}")

# 2. Top 5 recent disclosures
disclosures = requests.get(f"{BASE}/disclosures", headers=HEADERS,
                            params={"limit": 5}).json()["data"]
for d in disclosures:
    print(f"[{d['stock_code']}] {d['event_type']:<12} {d['signal_tag']}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const BASE    = '${BASE_URL}';
const HEADERS = { 'X-API-Key': 'YOUR_API_KEY' };

// 1. Market snapshot (most recent day)
const radar = await fetch(\`\${BASE}/market-radar?limit=1\`, { headers: HEADERS })
  .then(r => r.json());
console.log(\`KOSPI \${radar.data[0].kospi_change}  signal=\${radar.data[0].market_signal}\`);

// 2. Top 5 recent disclosures
const { data } = await fetch(\`\${BASE}/disclosures?limit=5\`, { headers: HEADERS })
  .then(r => r.json());
data.forEach((d: any) =>
  console.log(\`[\${d.stock_code}] \${d.event_type.padEnd(12)} \${d.signal_tag}\`)
);`,
      },
    ],
  },
  {
    id: 'event-signals',
    title: 'High-Conviction Signal Scan',
    desc: 'Scan today\'s disclosures for the highest-conviction signal tag and rank by score.',
    tabs: [
      {
        label: 'Python',
        language: 'python',
        code: `import requests
from datetime import date

res = requests.get(
    "${BASE_URL}/disclosures",
    headers={"X-API-Key": "YOUR_API_KEY"},
    params={
        "date_from": str(date.today()),
        "signal_tag": "🔥 High Conviction",
        "sort_by": "final_score",
        "limit": 20,
    },
)
signals = res.json()["data"]

print(f"{'Stock':<10} {'Event Type':<16} {'Score':>6}  Summary")
print("-" * 80)
for d in signals:
    summary = (d["ai_summary"] or "")[:55]
    print(f"{d['stock_code']:<10} {d['event_type']:<16} {d['final_score']:>6.1f}  {summary}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `interface Disclosure {
  stock_code: string; corp_name: string; event_type: string;
  final_score: number; signal_tag: string; ai_summary: string;
}

const today = new Date().toISOString().split('T')[0];
const { data }: { data: Disclosure[] } = await fetch(
  \`${BASE_URL}/disclosures?date_from=\${today}&signal_tag=\${encodeURIComponent('🔥 High Conviction')}&sort_by=final_score&limit=20\`,
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
).then(r => r.json());

data.forEach(d =>
  console.log(\`[\${d.stock_code}] \${d.event_type.padEnd(16)} \${d.final_score.toFixed(1)}  \${d.ai_summary?.slice(0, 55)}\`)
);`,
      },
    ],
  },
  {
    id: 'sector-rotation',
    title: 'Sector Signal Monitor',
    desc: 'Compare two consecutive days of sector signals to spot a shift in sentiment or confidence.',
    tabs: [
      {
        label: 'Python',
        language: 'python',
        code: `import requests
from datetime import date, timedelta

BASE    = "${BASE_URL}"
HEADERS = {"X-API-Key": "YOUR_API_KEY"}

def get_sectors(d: str) -> dict:
    r = requests.get(f"{BASE}/sector-signals",
                     headers=HEADERS, params={"date_from": d, "date_to": d})
    return {s["sector_en"]: s for s in r.json()["data"]}

today     = str(date.today())
yesterday = str(date.today() - timedelta(days=1))

now  = get_sectors(today)
prev = get_sectors(yesterday)

print(f"Sector signal shift  ({yesterday} → {today})")
print("-" * 52)
for name, data in now.items():
    prev_signal = prev.get(name, {}).get("signal", "?")
    changed = "→ CHANGED" if prev_signal != data["signal"] else ""
    print(f"  {name:<25} {prev_signal:<8} → {data['signal']:<8} {changed}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const BASE    = '${BASE_URL}';
const HEADERS = { 'X-API-Key': 'YOUR_API_KEY' };

const getSectors = async (date: string) => {
  const { data } = await fetch(\`\${BASE}/sector-signals?date_from=\${date}&date_to=\${date}\`, { headers: HEADERS })
    .then(r => r.json());
  return Object.fromEntries(data.map((s: any) => [s.sector_en, s]));
};

const fmt = (d: Date) => d.toISOString().split('T')[0];
const today     = fmt(new Date());
const yesterday = fmt(new Date(Date.now() - 86_400_000));

const [now, prev] = await Promise.all([getSectors(today), getSectors(yesterday)]);

console.log(\`Sector signal shift  (\${yesterday} → \${today})\`);
Object.entries(now).forEach(([name, data]: [string, any]) => {
  const prevSignal = prev[name]?.signal ?? '?';
  const changed = prevSignal !== data.signal ? '→ CHANGED' : '';
  console.log(\`  \${name.padEnd(25)} \${prevSignal} → \${data.signal}  \${changed}\`);
});`,
      },
    ],
  },
  {
    id: 'error-handling',
    title: 'Error Handling & Retries',
    desc: 'Handle 429 rate limits and other API errors gracefully in production.',
    tabs: [
      {
        label: 'Python',
        language: 'python',
        code: `import requests, time
from requests.exceptions import HTTPError

def call_api(url: str, params: dict = {}, retries: int = 3):
    headers = {"X-API-Key": "YOUR_API_KEY"}
    for attempt in range(retries):
        r = requests.get(url, headers=headers, params=params)

        if r.status_code == 429:
            # Respect Retry-After header (seconds)
            wait = int(r.headers.get("Retry-After", 5))
            print(f"Rate limited. Retrying in {wait}s…")
            time.sleep(wait)
            continue

        r.raise_for_status()
        return r.json()

    raise RuntimeError(f"API call failed after {retries} attempts")

try:
    data = call_api(
        "${BASE_URL}/disclosures",
        params={"stock_code": "005930", "limit": 20}
    )
    print(f"Fetched {len(data['data'])} disclosures")

except HTTPError as e:
    err = e.response.json()
    # err = { "error": "..." }  (429 responses also include plan/used/limit/reset)
    print(f"API error {e.response.status_code}: {err['error']}")

except RuntimeError as e:
    print(f"Retry exhausted: {e}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `interface ApiError { error: string; [key: string]: unknown; }

async function callApi<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: { 'X-API-Key': 'YOUR_API_KEY' },
    });

    if (res.status === 429) {
      // Respect Retry-After header (seconds)
      const wait = parseInt(res.headers.get('Retry-After') ?? '5') * 1_000;
      console.log(\`Rate limited. Retrying in \${wait / 1000}s…\`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const err: ApiError = await res.json();
      throw new Error(\`\${err.error} (HTTP \${res.status})\`);
    }

    return res.json() as Promise<T>;
  }
  throw new Error(\`API call failed after \${retries} attempts\`);
}

// Usage
try {
  const data = await callApi<{ data: unknown[]; total: number }>(
    '${BASE_URL}/disclosures?stock_code=005930&limit=20'
  );
  console.log(\`Fetched \${data.data.length} disclosures (total \${data.total})\`);
} catch (e) {
  console.error('API failed:', e);
}`,
      },
    ],
  },
];

// ─── Helper components ────────────────────────────────────────────────────────

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#121821] border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <code className="text-sm text-[#00D4A6]">{value}</code>
    </div>
  );
}

function SectionLead({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-400 leading-relaxed mb-6 max-w-2xl">{children}</p>;
}

function SubHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-sm font-semibold text-white mb-3 mt-8 ${className}`}>{children}</h3>;
}

function ParamTable({ params, title }: { params: Param[]; title: string }) {
  return (
    <>
      <SubHeading>{title}</SubHeading>
      <div className="overflow-x-auto mb-2">
        <table className="w-full min-w-[520px] text-sm border border-gray-800 rounded-xl overflow-hidden">
          <thead className="bg-[#121821]">
            <tr>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-36">Name</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-24">Type</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-24">Required</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p, i) => (
              <tr key={p.name} className={`border-t border-gray-800 ${i % 2 === 0 ? '' : 'bg-[#121821]/40'}`}>
                <td className="px-4 py-3">
                  <code className="text-xs text-[#00D4A6]">{p.name}</code>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500 font-mono">{p.type}</span>
                </td>
                <td className="px-4 py-3">
                  {p.required ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">required</span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">optional</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{p.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ResponseTable({ fields }: { fields: ResponseField[] }) {
  return (
    <>
      <SubHeading>Response Fields</SubHeading>
      <div className="overflow-x-auto mb-6">
        <table className="w-full min-w-[480px] text-sm border border-gray-800 rounded-xl overflow-hidden">
          <thead className="bg-[#121821]">
            <tr>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-52">Field</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-24">Type</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={f.field} className={`border-t border-gray-800 ${i % 2 === 0 ? '' : 'bg-[#121821]/40'}`}>
                <td className="px-4 py-3">
                  <code className="text-xs text-[#00D4A6] break-all">{f.field}</code>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500 font-mono">{f.type}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{f.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Divider() {
  return <div className="border-t border-gray-800 my-8" />;
}

// ─── URL param handler ────────────────────────────────────────────────────────

function SearchParamsHandler({ onEndpoint }: { onEndpoint: (section: Section, idx: number) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const ep = searchParams.get('endpoint');
    if (ep !== null) {
      const idx = parseInt(ep, 10);
      if (!isNaN(idx) && idx >= 0 && idx < endpoints.length) {
        onEndpoint('Endpoints', idx);
      }
    }
  }, [searchParams, onEndpoint]);
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const [activeSection, setActiveSection]   = useState<Section>('Introduction');
  const [activeEndpoint, setActiveEndpoint] = useState(0);
  const [activeExample,  setActiveExample]  = useState(0);

  const handleEndpoint = useCallback((section: Section, idx: number) => {
    setActiveSection(section);
    setActiveEndpoint(idx);
  }, []);

  return (
    <div className="bg-[#0B0F14] min-h-screen text-gray-200">
      <Suspense fallback={null}>
        <SearchParamsHandler onEndpoint={handleEndpoint} />
      </Suspense>

      <Navbar />

      {/* ── Preview Access Banner ────────────────────────────────────────── */}
      <div className="border-b border-[#00D4A6]/20 bg-[#00D4A6]/5">
        <div className="max-w-[1200px] mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00D4A6]/15 text-[#00D4A6] border border-[#00D4A6]/30 uppercase tracking-wider">
              Preview Access
            </span>
            <p className="text-xs text-gray-400 truncate">
              Unlock production API keys, full historical data &amp; bulk export.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="/api-access"
              className="text-xs font-bold bg-[#00D4A6] text-[#0B0F14] rounded-lg px-3 py-1.5 hover:bg-[#00bfa0] transition"
            >
              Request Access
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto md:flex gap-0 min-h-[calc(100vh-64px)]">

        {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
        <aside className="hidden md:block w-56 flex-shrink-0 border-r border-gray-800 py-10 px-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3 px-2">Docs</p>

          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition ${
                activeSection === s
                  ? 'bg-[#00D4A6]/10 text-[#00D4A6] font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}

          {/* Sub-nav: Endpoints */}
          {activeSection === 'Endpoints' && (
            <>
              <div className="border-t border-gray-800 my-4" />
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2 px-2">Endpoints</p>
              {endpoints.map((ep, i) => (
                <button
                  key={ep.id}
                  onClick={() => setActiveEndpoint(i)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs mb-0.5 transition font-mono leading-snug ${
                    activeEndpoint === i ? 'text-[#00D4A6]' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {ep.path}
                </button>
              ))}
            </>
          )}

          {/* Sub-nav: Examples */}
          {activeSection === 'Examples' && (
            <>
              <div className="border-t border-gray-800 my-4" />
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2 px-2">Scenarios</p>
              {exampleScenarios.map((ex, i) => (
                <button
                  key={ex.id}
                  onClick={() => setActiveExample(i)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs mb-0.5 transition ${
                    activeExample === i ? 'text-[#00D4A6]' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {ex.title}
                </button>
              ))}
            </>
          )}
        </aside>

        {/* ── Mobile top tabs ───────────────────────────────────────────── */}
        <div className="md:hidden flex overflow-x-auto border-b border-gray-800 bg-[#0B0F14] sticky top-16 z-10 gap-1 px-2 py-2 no-scrollbar">
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                activeSection === s ? 'bg-[#00D4A6]/10 text-[#00D4A6]' : 'text-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 py-8 px-4 md:px-10 overflow-auto min-w-0">

          {/* ══ INTRODUCTION ══════════════════════════════════════════════ */}
          {activeSection === 'Introduction' && (
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">API Reference</h1>
              <SectionLead>
                The K-Market Insight API provides structured Korean equity intelligence — AI-analyzed disclosures, sector signals, market radar, and event-driven backtest performance — via a REST interface. Responses are JSON by default (XML available via <code className="text-[#00D4A6] text-xs">?format=xml</code>). Timestamps are ISO 8601 UTC.
              </SectionLead>

              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                <InfoCard label="Base URL"      value="https://k-marketinsight.com/api/v1" />
                <InfoCard label="Current version" value="v1" />
                <InfoCard label="Response format" value="JSON by default — pass ?format=xml or Accept: application/xml for XML" />
                <InfoCard label="Authentication"  value="X-API-Key header" />
                <InfoCard label="Timestamp format" value="ISO 8601 UTC  (e.g. 2026-03-10T06:38:00Z)" />
                <InfoCard label="CORS"            value="Enabled — browser requests supported" />
              </div>

              <Divider />

              {/* Rate limits */}
              <h2 className="text-lg font-semibold text-white mb-3">Rate Limits</h2>
              <SectionLead>
                Rate limits are enforced per API key. If you exceed your limit, the API returns HTTP 429 with a <code className="text-[#00D4A6] text-xs">Retry-After</code> header indicating seconds until the next window.
              </SectionLead>
              {/* Public Beta 기간: pricing 페이지 없음, Request Access 승인 시 전부 starter로 발급됨
                  (lib/v1/rateLimit.ts 참고 — 실제 시행 한도: 5,000 calls/month, per-minute 제한 없음).
                  아래 예전 플랜별 표(pricing 정책 있던 시절 카피, 실제 코드와 안 맞았음)는
                  가격 정책 재도입 시 복원 예정이라 주석으로만 남겨둔다.
              <div className="overflow-x-auto mb-6">
                <table className="w-full min-w-[480px] text-sm border border-gray-800 rounded-xl overflow-hidden">
                  <thead className="bg-[#121821]">
                    <tr>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Plan</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Requests / min</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Requests / day</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Historical data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { plan: 'Starter',    rpm: '60',     rpd: '5,000',   hist: 'Since 2026' },
                      { plan: 'Pro',        rpm: '300',    rpd: '50,000',  hist: 'Since 2026' },
                      { plan: 'Enterprise', rpm: 'Custom', rpd: 'Custom',  hist: 'Since 2026' },
                    ].map((row, i) => (
                      <tr key={row.plan} className={`border-t border-gray-800 ${i % 2 !== 0 ? 'bg-[#121821]/40' : ''}`}>
                        <td className="px-4 py-3 text-sm font-medium text-white">{row.plan}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{row.rpm}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{row.rpd}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{row.hist}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              */}
              <div className="mb-6 max-w-xs">
                <InfoCard label="Public Beta — all approved keys" value="5,000 requests / month" />
              </div>

              <Divider />

              {/* Pagination */}
              <h2 className="text-lg font-semibold text-white mb-3">Pagination</h2>
              <SectionLead>
                Most list endpoints are date-range filtered — pass <code className="text-[#00D4A6] text-xs">date_from</code> / <code className="text-[#00D4A6] text-xs">date_to</code> and <code className="text-[#00D4A6] text-xs">limit</code> to control the window and page size. <code className="text-[#00D4A6] text-xs">/v1/performance/trades</code> is the one exception — it uses <code className="text-[#00D4A6] text-xs">limit</code> + <code className="text-[#00D4A6] text-xs">offset</code> instead, since full trade history matters regardless of recency. There is no cursor field in any response.
              </SectionLead>
              <CodeBlock language="typescript" code={`// /v1/performance/trades — offset pagination
const page1 = await fetch('/v1/performance/trades?limit=50&offset=0', { headers }).then(r => r.json());
// page1.total = total matching rows across all pages

const page2 = await fetch('/v1/performance/trades?limit=50&offset=50', { headers }).then(r => r.json());`} />

              <div className="mt-8">
                <button onClick={() => setActiveSection('Authentication')} className="text-sm text-[#00D4A6] hover:underline">
                  Next: Authentication →
                </button>
              </div>
            </div>
          )}

          {/* ══ AUTHENTICATION ════════════════════════════════════════════ */}
          {activeSection === 'Authentication' && (
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">Authentication</h1>
              <SectionLead>
                All API requests require a valid API key, sent as the <code className="text-[#00D4A6] text-sm">X-API-Key</code> header. A legacy <code className="text-[#00D4A6] text-sm">?api_key=</code> query parameter is also accepted, but the header is preferred so your key doesn’t end up in logs or browser history. Note: <code className="text-[#00D4A6] text-sm">Authorization: Bearer</code> is <span className="text-gray-300">not</span> supported.
              </SectionLead>

              {/* Method 1 */}
              <h2 className="text-base font-semibold text-white mb-3">Method 1 — X-API-Key header (recommended)</h2>
              <div className="bg-[#121821] border border-[#00D4A6]/20 rounded-xl p-5 mb-6 font-mono text-sm">
                <span className="text-gray-500">X-API-Key: </span>
                <span className="text-[#00D4A6]">YOUR_API_KEY</span>
              </div>

              {/* Method 2 */}
              <h2 className="text-base font-semibold text-white mb-3">Method 2 — api_key query parameter (legacy)</h2>
              <div className="bg-[#121821] border border-gray-800 rounded-xl p-5 mb-6 font-mono text-sm">
                <span className="text-gray-500">?api_key=</span>
                <span className="text-[#00D4A6]">YOUR_API_KEY</span>
              </div>

              {/* Code examples */}
              <SubHeading className="mt-6">Code Examples</SubHeading>
              <LangTabs tabs={[
                {
                  label: 'curl',
                  language: 'bash',
                  code: `# X-API-Key header (recommended)
curl ${BASE_URL}/market-radar \\
  -H "X-API-Key: YOUR_API_KEY"

# api_key query param (legacy)
curl "${BASE_URL}/market-radar?api_key=YOUR_API_KEY"`,
                },
                {
                  label: 'Python',
                  language: 'python',
                  code: `import requests

# X-API-Key header (recommended)
res = requests.get(
    "${BASE_URL}/market-radar",
    headers={"X-API-Key": "YOUR_API_KEY"},
)
print(res.json())`,
                },
                {
                  label: 'TypeScript',
                  language: 'typescript',
                  code: `// X-API-Key header (recommended)
const res = await fetch('${BASE_URL}/market-radar', {
  headers: { 'X-API-Key': 'YOUR_API_KEY' },
});
const data = await res.json();`,
                },
              ]} />

              <Divider />

              {/* Security */}
              <h2 className="text-base font-semibold text-white mb-3">Security Notes</h2>
              <ul className="text-sm text-gray-400 space-y-2">
                <li className="flex gap-2"><span className="text-[#00D4A6] mt-0.5">→</span> Never expose your API key in client-side JavaScript. Use a server-side proxy.</li>
                <li className="flex gap-2"><span className="text-[#00D4A6] mt-0.5">→</span> Store keys in environment variables, not in source code.</li>
                <li className="flex gap-2"><span className="text-[#00D4A6] mt-0.5">→</span> Rotate your key immediately if it is accidentally exposed.</li>
              </ul>

              <p className="text-gray-500 text-sm mt-6">
                Manage your API keys on the{' '}
                <a href="/api-key" className="text-[#00D4A6] hover:underline">API Key page</a>.
              </p>
            </div>
          )}

          {/* ══ ERRORS ════════════════════════════════════════════════════ */}
          {activeSection === 'Errors' && (
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">Errors</h1>
              <SectionLead>
                The API uses standard HTTP status codes. Error responses are a JSON object with at minimum an <code className="text-[#00D4A6] text-xs">error</code> string — there is no separate <code className="text-[#00D4A6] text-xs">code</code> field, so branch on the HTTP status code, not on any value in the body. 429 responses include a few extra fields (see below).
              </SectionLead>

              {/* Error format */}
              <h2 className="text-base font-semibold text-white mb-3">Error Response Format</h2>
              <CodeBlock language="json" code={`// Standard error (401, 403, 500, ...)
{ "error": "Invalid API key." }

// 429 Rate limit — includes extra context
{
  "error": "Rate limit exceeded.",
  "plan": "starter",
  "used": 5000,
  "limit": 5000,
  "reset": "2026-04-01",
  "upgrade_url": "https://k-marketinsight.com/login"
}`} />

              <Divider />

              {/* Status codes table */}
              <h2 className="text-base font-semibold text-white mb-3">HTTP Status Codes</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm border border-gray-800 rounded-xl overflow-hidden">
                  <thead className="bg-[#121821]">
                    <tr>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-20">Status</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { status: '400', desc: 'A query parameter has an invalid value — e.g. sentiment must be POSITIVE, NEGATIVE, or NEUTRAL; signal_tag must be one of the documented values.' },
                      { status: '401', desc: 'API key is missing (no X-API-Key header or api_key param) or does not match any account.' },
                      { status: '403', desc: 'Your current plan does not include access to this endpoint.' },
                      { status: '429', desc: 'Rate limit exceeded for your plan. Check the Retry-After response header for the wait time in seconds.' },
                      { status: '500', desc: 'Unexpected server error. Retry with exponential backoff. Contact support if it persists.' },
                      { status: '503', desc: 'Authentication service temporarily unavailable. Retry after a short delay.' },
                    ].map((row, i) => (
                      <tr key={row.status} className={`border-t border-gray-800 ${i % 2 !== 0 ? 'bg-[#121821]/40' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-mono font-medium ${
                            row.status.startsWith('4') ? 'text-yellow-400' :
                            row.status.startsWith('5') ? 'text-red-400' : 'text-gray-400'
                          }`}>{row.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Divider />

              {/* Rate limit guidance */}
              <h2 className="text-base font-semibold text-white mb-3">Handling 429 Rate Limits</h2>
              <SectionLead>
                When you receive a 429, read the <code className="text-[#00D4A6] text-xs">Retry-After</code> header (seconds) to know how long to wait. Free tier resets daily; starter/pro/enterprise reset on the 1st of the month.
              </SectionLead>
              <CodeBlock language="typescript" code={`if (res.status === 429) {
  const wait = parseInt(res.headers.get('Retry-After') ?? '5') * 1_000;
  await new Promise(r => setTimeout(r, wait));
  // retry the request
}`} />

              <p className="text-sm text-gray-500 mt-6">
                Need a higher rate limit?{' '}
                <a href="/api-access" className="text-[#00D4A6] hover:underline">Contact us about Enterprise plans</a>.
              </p>
            </div>
          )}

          {/* ══ ENDPOINTS ═════════════════════════════════════════════════ */}
          {activeSection === 'Endpoints' && (
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">Endpoints</h1>

              {/* Endpoint tab strip */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8 pb-1">
                {endpoints.map((ep, i) => (
                  <button
                    key={ep.id}
                    onClick={() => setActiveEndpoint(i)}
                    className={`flex-shrink-0 text-xs font-mono px-3 py-1.5 rounded-lg border transition ${
                      activeEndpoint === i
                        ? 'bg-[#00D4A6]/10 border-[#00D4A6]/40 text-[#00D4A6]'
                        : 'border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                    }`}
                  >
                    {ep.path}
                  </button>
                ))}
              </div>

              {(() => {
                const ep = endpoints[activeEndpoint];
                return (
                  <div key={ep.id}>
                    {/* Method + path header */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {ep.method}
                      </span>
                      <code className="text-base sm:text-lg font-mono text-white break-all">{ep.path}</code>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-2xl">{ep.desc}</p>

                    {/* Path params */}
                    {ep.pathParams && ep.pathParams.length > 0 && (
                      <ParamTable params={ep.pathParams} title="Path Parameters" />
                    )}

                    {/* Query params */}
                    {ep.queryParams && ep.queryParams.length > 0 && (
                      <ParamTable params={ep.queryParams} title="Query Parameters" />
                    )}

                    {/* Response fields */}
                    <ResponseTable fields={ep.responseFields} />

                    {/* Example response */}
                    <SubHeading>Example Response</SubHeading>
                    <CodeBlock code={ep.response} language="json" />

                    {/* Request examples */}
                    <SubHeading>Request Examples</SubHeading>
                    <LangTabs tabs={ep.examples} />
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══ EXAMPLES ══════════════════════════════════════════════════ */}
          {activeSection === 'Examples' && (
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">Examples</h1>

              {/* Scenario tab strip */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8 pb-1 flex-wrap">
                {exampleScenarios.map((ex, i) => (
                  <button
                    key={ex.id}
                    onClick={() => setActiveExample(i)}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition ${
                      activeExample === i
                        ? 'bg-[#00D4A6]/10 border-[#00D4A6]/40 text-[#00D4A6]'
                        : 'border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                    }`}
                  >
                    {ex.title}
                  </button>
                ))}
              </div>

              {(() => {
                const ex = exampleScenarios[activeExample];
                return (
                  <div key={ex.id}>
                    <h2 className="text-xl font-bold text-white mb-2">{ex.title}</h2>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">{ex.desc}</p>
                    <LangTabs tabs={ex.tabs} />
                  </div>
                );
              })()}
            </div>
          )}

        </main>
      </div>

      <Footer />
    </div>
  );
}
