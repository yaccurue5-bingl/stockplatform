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

const endpoints: Endpoint[] = [
  {
    id: 'events',
    method: 'GET',
    path: '/v1/events',
    desc: 'Returns AI-classified corporate events sourced from DART regulatory filings. Each event includes an impact score (0–1), sentiment label, and an AI-generated English summary. Results are sorted by published_at descending.',
    queryParams: [
      { name: 'ticker',     type: 'string',  required: false, desc: 'KRX 6-digit stock ticker (e.g. 005930). Filters to one company.' },
      { name: 'sector',     type: 'string',  required: false, desc: 'KSIC sector name (e.g. Semiconductors). See /v1/sector-signals for the full sector list.' },
      { name: 'event_type', type: 'string',  required: false, desc: 'One of: earnings, capital_raise, contract, dilution, insider_trading, lawsuit.' },
      { name: 'date',       type: 'string',  required: false, desc: 'Exact filing date (YYYY-MM-DD). Cannot be combined with from / to.' },
      { name: 'from',       type: 'string',  required: false, desc: 'Start of date range (YYYY-MM-DD, inclusive).' },
      { name: 'to',         type: 'string',  required: false, desc: 'End of date range (YYYY-MM-DD, inclusive). Defaults to today.' },
      { name: 'limit',      type: 'integer', required: false, desc: 'Results per page. Range: 1–100. Default: 20.' },
      { name: 'cursor',     type: 'string',  required: false, desc: "Pagination cursor from a previous response's next_cursor field." },
    ],
    responseFields: [
      { field: 'events',                type: 'array',   desc: 'Ordered list of corporate event objects.' },
      { field: 'events[].id',           type: 'string',  desc: 'Unique event ID (prefix: evt_).' },
      { field: 'events[].ticker',       type: 'string',  desc: 'KRX 6-digit stock ticker.' },
      { field: 'events[].company',      type: 'string',  desc: 'Company name in English.' },
      { field: 'events[].event_type',   type: 'string',  desc: 'AI-assigned event classification.' },
      { field: 'events[].impact_score', type: 'number',  desc: 'Estimated market impact from 0 (negligible) to 1 (high impact).' },
      { field: 'events[].sentiment',    type: 'string',  desc: 'positive | negative | neutral' },
      { field: 'events[].summary',      type: 'string',  desc: 'AI-generated English summary of the DART filing (2–4 sentences).' },
      { field: 'events[].published_at', type: 'string',  desc: 'ISO 8601 UTC timestamp of the DART filing.' },
      { field: 'events[].dart_url',     type: 'string',  desc: 'Direct URL to the original DART filing.' },
      { field: 'next_cursor',           type: 'string',  desc: 'Pass as cursor param for the next page. null on the last page.' },
      { field: 'total',                 type: 'integer', desc: 'Total number of events matching your filters.' },
    ],
    response: `{
  "events": [
    {
      "id": "evt_9k2mxp4r",
      "ticker": "005930",
      "company": "Samsung Electronics",
      "event_type": "earnings",
      "impact_score": 0.83,
      "sentiment": "positive",
      "summary": "Samsung reported Q1 2026 operating profit of ₩6.8T, beating consensus by 12%. Strong HBM3E chip demand cited as the primary growth driver.",
      "published_at": "2026-03-10T06:38:00Z",
      "dart_url": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260310000123"
    }
  ],
  "next_cursor": "eyJpZCI6ImV2dF85azJteHA0ciIsImRhdGUiOiIyMDI2LTAzLTEwIn0",
  "total": 142
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl -G https://api.k-marketinsight.com/v1/events \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d ticker=005930 \\
  -d from=2026-03-01 \\
  -d limit=5`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

res = requests.get(
    "https://api.k-marketinsight.com/v1/events",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    params={"ticker": "005930", "from": "2026-03-01", "limit": 5},
)
res.raise_for_status()

for e in res.json()["events"]:
    print(f"{e['company']} | {e['event_type']} | impact={e['impact_score']:.2f}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const res = await fetch(
  'https://api.k-marketinsight.com/v1/events?ticker=005930&from=2026-03-01&limit=5',
  { headers: { Authorization: 'Bearer YOUR_API_KEY' } }
);
if (!res.ok) throw new Error(\`API error \${res.status}\`);

const { events, next_cursor, total } = await res.json();
console.log(\`\${total} events found\`);
events.forEach((e: any) =>
  console.log(\`\${e.company} | \${e.event_type} | impact=\${e.impact_score}\`)
);`,
      },
    ],
  },

  {
    id: 'sector-signals',
    method: 'GET',
    path: '/v1/sector-signals',
    desc: 'Returns daily sector-level momentum and flow signals across 18 KSIC sectors. Useful for identifying sector rotation and building macro-aware equity strategies. Results are sorted by momentum_score descending.',
    queryParams: [
      { name: 'date',   type: 'string',  required: false, desc: 'Signal date (YYYY-MM-DD). Defaults to the latest available trading day.' },
      { name: 'sector', type: 'string',  required: false, desc: 'Filter to a single KSIC sector name.' },
      { name: 'limit',  type: 'integer', required: false, desc: 'Max number of sectors returned (1–18). Default: 18.' },
    ],
    responseFields: [
      { field: 'date',                      type: 'string',  desc: 'Date the signals were calculated for.' },
      { field: 'sectors',                   type: 'array',   desc: 'Sector signal objects, sorted by momentum_score descending.' },
      { field: 'sectors[].sector_name',     type: 'string',  desc: 'KSIC sector name.' },
      { field: 'sectors[].momentum_score',  type: 'number',  desc: 'Composite momentum score from 0 (weak) to 1 (strong).' },
      { field: 'sectors[].flow_signal',     type: 'string',  desc: 'inflow | outflow | neutral — net foreign investor flow direction.' },
      { field: 'sectors[].sentiment_score', type: 'number',  desc: 'Aggregate disclosure sentiment across all companies in the sector (0–1).' },
      { field: 'sectors[].event_count',     type: 'integer', desc: 'Number of DART events in this sector on the given date.' },
      { field: 'sectors[].top_movers',      type: 'string[]', desc: 'Up to 3 tickers with the highest impact_score in this sector.' },
    ],
    response: `{
  "date": "2026-03-10",
  "sectors": [
    {
      "sector_name": "Semiconductors",
      "momentum_score": 0.74,
      "flow_signal": "inflow",
      "sentiment_score": 0.82,
      "event_count": 7,
      "top_movers": ["000660", "005930", "042700"]
    },
    {
      "sector_name": "Biotech",
      "momentum_score": 0.31,
      "flow_signal": "outflow",
      "sentiment_score": 0.42,
      "event_count": 12,
      "top_movers": ["207940", "145020", "068270"]
    }
  ]
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl "https://api.k-marketinsight.com/v1/sector-signals?date=2026-03-10" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

res = requests.get(
    "https://api.k-marketinsight.com/v1/sector-signals",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    params={"date": "2026-03-10"},
)
data = res.json()

# Top 3 sectors by momentum
for s in data["sectors"][:3]:
    print(f"{s['sector_name']:<25} momentum={s['momentum_score']:.2f}  flow={s['flow_signal']}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const res = await fetch(
  'https://api.k-marketinsight.com/v1/sector-signals?date=2026-03-10',
  { headers: { Authorization: 'Bearer YOUR_API_KEY' } }
);
const { sectors } = await res.json();

// Already sorted by momentum_score desc
sectors.slice(0, 3).forEach((s: any) =>
  console.log(\`\${s.sector_name.padEnd(25)} momentum=\${s.momentum_score}  flow=\${s.flow_signal}\`)
);`,
      },
    ],
  },

  {
    id: 'market-radar',
    method: 'GET',
    path: '/v1/market-radar',
    desc: 'Returns high-level Korean market indicators for a given trading day: KOSPI/KOSDAQ indices, foreign investor net flow, primary sector rotation signal, and overall market momentum.',
    queryParams: [
      { name: 'date', type: 'string', required: false, desc: 'Target trading date (YYYY-MM-DD). Defaults to the latest available day.' },
    ],
    responseFields: [
      { field: 'date',             type: 'string', desc: 'Date of the market snapshot.' },
      { field: 'kospi',            type: 'object', desc: 'KOSPI composite index snapshot.' },
      { field: 'kospi.index',      type: 'number', desc: 'Closing index value.' },
      { field: 'kospi.change',     type: 'string', desc: 'Daily change as a percentage string (e.g. "+1.2%", "-0.4%").' },
      { field: 'kosdaq',           type: 'object', desc: 'KOSDAQ index snapshot. Same fields as kospi.' },
      { field: 'foreign_net_flow', type: 'string', desc: 'Foreign investor net buy/sell in KRW (e.g. "+₩1.2T", "-₩340B").' },
      { field: 'sector_rotation',  type: 'string', desc: 'Primary sector rotation signal (e.g. "Semiconductors → Shipbuilding").' },
      { field: 'market_momentum',  type: 'string', desc: 'bullish | bearish | neutral — composite market direction.' },
      { field: 'updated_at',       type: 'string', desc: 'ISO 8601 UTC timestamp of last data refresh.' },
    ],
    response: `{
  "date": "2026-03-10",
  "kospi": {
    "index": 2748.32,
    "change": "+1.2%"
  },
  "kosdaq": {
    "index": 891.54,
    "change": "+0.8%"
  },
  "foreign_net_flow": "+₩1.2T",
  "sector_rotation": "Semiconductors → Shipbuilding",
  "market_momentum": "bullish",
  "updated_at": "2026-03-10T09:00:00Z"
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl https://api.k-marketinsight.com/v1/market-radar \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

data = requests.get(
    "https://api.k-marketinsight.com/v1/market-radar",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
).json()

print(f"KOSPI : {data['kospi']['index']}  ({data['kospi']['change']})")
print(f"KOSDAQ: {data['kosdaq']['index']}  ({data['kosdaq']['change']})")
print(f"Foreign flow : {data['foreign_net_flow']}")
print(f"Sector shift : {data['sector_rotation']}")
print(f"Momentum     : {data['market_momentum']}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const data = await fetch(
  'https://api.k-marketinsight.com/v1/market-radar',
  { headers: { Authorization: 'Bearer YOUR_API_KEY' } }
).then(r => r.json());

console.log(\`KOSPI: \${data.kospi.index} (\${data.kospi.change})\`);
console.log(\`Foreign flow: \${data.foreign_net_flow}\`);
console.log(\`Momentum: \${data.market_momentum}\`);`,
      },
    ],
  },

  {
    id: 'company',
    method: 'GET',
    path: '/v1/company/{ticker}',
    desc: 'Returns a full corporate profile for one company: recent event history, active risk flags, and a 30-day sentiment trend derived from DART filings.',
    pathParams: [
      { name: 'ticker', type: 'string', required: true, desc: 'KRX 6-digit stock ticker (e.g. 005930 for Samsung Electronics).' },
    ],
    queryParams: [
      { name: 'from',  type: 'string',  required: false, desc: 'Start date for event_history (YYYY-MM-DD). Defaults to 90 days ago.' },
      { name: 'to',    type: 'string',  required: false, desc: 'End date for event_history (YYYY-MM-DD). Defaults to today.' },
      { name: 'limit', type: 'integer', required: false, desc: 'Max events in event_history (1–100). Default: 20.' },
    ],
    responseFields: [
      { field: 'ticker',                 type: 'string',   desc: 'KRX 6-digit ticker.' },
      { field: 'company',                type: 'string',   desc: 'Company name in English.' },
      { field: 'sector',                 type: 'string',   desc: 'KSIC sector name.' },
      { field: 'market',                 type: 'string',   desc: 'KOSPI | KOSDAQ' },
      { field: 'event_history',          type: 'array',    desc: 'Recent corporate events, newest first.' },
      { field: 'event_history[].date',   type: 'string',   desc: 'Event date (YYYY-MM-DD).' },
      { field: 'event_history[].event',  type: 'string',   desc: 'Event type classification.' },
      { field: 'event_history[].impact', type: 'number',   desc: 'Impact score (0–1).' },
      { field: 'risk_flags',             type: 'string[]', desc: 'Active risk signals. Empty array if none. Examples: dilution_risk, insider_sell, lawsuit_pending.' },
      { field: 'sentiment_trend',        type: 'string',   desc: 'improving | deteriorating | stable — 30-day rolling trend.' },
      { field: 'last_event_at',          type: 'string',   desc: 'ISO 8601 UTC timestamp of the most recent DART filing.' },
    ],
    response: `{
  "ticker": "005930",
  "company": "Samsung Electronics",
  "sector": "Semiconductors",
  "market": "KOSPI",
  "event_history": [
    { "date": "2026-03-10", "event": "earnings",      "impact": 0.83 },
    { "date": "2026-01-15", "event": "capital_raise", "impact": 0.61 }
  ],
  "risk_flags": [],
  "sentiment_trend": "improving",
  "last_event_at": "2026-03-10T06:38:00Z"
}`,
    examples: [
      {
        label: 'curl',
        language: 'bash',
        code: `curl "https://api.k-marketinsight.com/v1/company/005930?from=2026-01-01" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

ticker = "005930"
data = requests.get(
    f"https://api.k-marketinsight.com/v1/company/{ticker}",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    params={"from": "2026-01-01"},
).json()

print(f"{data['company']} ({data['market']}) — {data['sector']}")
print(f"Sentiment: {data['sentiment_trend']}")
print(f"Risk flags: {', '.join(data['risk_flags']) or 'None'}")
print(f"Events in range: {len(data['event_history'])}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const ticker = '005930';
const data = await fetch(
  \`https://api.k-marketinsight.com/v1/company/\${ticker}?from=2026-01-01\`,
  { headers: { Authorization: 'Bearer YOUR_API_KEY' } }
).then(r => r.json());

console.log(\`\${data.company} (\${data.market}) — \${data.sector}\`);
console.log(\`Sentiment: \${data.sentiment_trend}\`);
console.log(\`Risk flags: \${data.risk_flags.join(', ') || 'None'}\`);`,
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
curl https://api.k-marketinsight.com/v1/market-radar \\
  -H "Authorization: Bearer YOUR_API_KEY"

# 2. Fetch the 5 most recent DART events
curl "https://api.k-marketinsight.com/v1/events?limit=5" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      },
      {
        label: 'Python',
        language: 'python',
        code: `import requests

BASE    = "https://api.k-marketinsight.com"
HEADERS = {"Authorization": "Bearer YOUR_API_KEY"}

# 1. Market snapshot
radar = requests.get(f"{BASE}/v1/market-radar", headers=HEADERS).json()
print(f"KOSPI {radar['kospi']['index']}  momentum={radar['market_momentum']}")

# 2. Top 5 recent events
events = requests.get(f"{BASE}/v1/events", headers=HEADERS,
                      params={"limit": 5}).json()["events"]
for e in events:
    print(f"[{e['ticker']}] {e['event_type']:<20} impact={e['impact_score']:.2f}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const BASE    = 'https://api.k-marketinsight.com';
const HEADERS = { Authorization: 'Bearer YOUR_API_KEY' };

// 1. Market snapshot
const radar = await fetch(\`\${BASE}/v1/market-radar\`, { headers: HEADERS })
  .then(r => r.json());
console.log(\`KOSPI \${radar.kospi.index}  momentum=\${radar.market_momentum}\`);

// 2. Top 5 recent events
const { events } = await fetch(\`\${BASE}/v1/events?limit=5\`, { headers: HEADERS })
  .then(r => r.json());
events.forEach((e: any) =>
  console.log(\`[\${e.ticker}] \${e.event_type.padEnd(20)} impact=\${e.impact_score}\`)
);`,
      },
    ],
  },
  {
    id: 'event-signals',
    title: 'Event-Driven Signal Generation',
    desc: 'Scan today\'s high-impact positive events and build a ranked watchlist.',
    tabs: [
      {
        label: 'Python',
        language: 'python',
        code: `import requests
from datetime import date

res = requests.get(
    "https://api.k-marketinsight.com/v1/events",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    params={"date": str(date.today()), "limit": 100},
)
events = res.json()["events"]

# Filter: high-impact positive events only
signals = [
    e for e in events
    if e["impact_score"] >= 0.65 and e["sentiment"] == "positive"
]
signals.sort(key=lambda e: e["impact_score"], reverse=True)

print(f"{'Ticker':<10} {'Event Type':<22} {'Impact':>6}  Summary")
print("-" * 80)
for e in signals[:10]:
    summary = e["summary"][:55] + "…" if len(e["summary"]) > 55 else e["summary"]
    print(f"{e['ticker']:<10} {e['event_type']:<22} {e['impact_score']:>6.2f}  {summary}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `interface Event {
  ticker: string; company: string; event_type: string;
  impact_score: number; sentiment: string; summary: string;
}

const today = new Date().toISOString().split('T')[0];
const { events }: { events: Event[] } = await fetch(
  \`https://api.k-marketinsight.com/v1/events?date=\${today}&limit=100\`,
  { headers: { Authorization: 'Bearer YOUR_API_KEY' } }
).then(r => r.json());

// High-impact positive events → ranked watchlist
const signals = events
  .filter(e => e.impact_score >= 0.65 && e.sentiment === 'positive')
  .sort((a, b) => b.impact_score - a.impact_score);

signals.slice(0, 10).forEach(e =>
  console.log(\`[\${e.ticker}] \${e.event_type.padEnd(22)} \${e.impact_score.toFixed(2)}  \${e.summary.slice(0, 55)}…\`)
);`,
      },
    ],
  },
  {
    id: 'sector-rotation',
    title: 'Sector Rotation Monitor',
    desc: 'Compare two consecutive days of sector signals to detect rotation in real time.',
    tabs: [
      {
        label: 'Python',
        language: 'python',
        code: `import requests
from datetime import date, timedelta

BASE    = "https://api.k-marketinsight.com"
HEADERS = {"Authorization": "Bearer YOUR_API_KEY"}

def get_sectors(d: str) -> dict:
    r = requests.get(f"{BASE}/v1/sector-signals",
                     headers=HEADERS, params={"date": d})
    return {s["sector_name"]: s for s in r.json()["sectors"]}

today     = str(date.today())
yesterday = str(date.today() - timedelta(days=1))

now  = get_sectors(today)
prev = get_sectors(yesterday)

print(f"Sector momentum shift  ({yesterday} → {today})")
print("-" * 52)
for name, data in now.items():
    prev_score = prev.get(name, {}).get("momentum_score", 0)
    delta = data["momentum_score"] - prev_score
    arrow = "▲" if delta > 0.05 else "▼" if delta < -0.05 else "─"
    flow  = data["flow_signal"]
    print(f"  {arrow} {name:<28} {delta:+.2f}  ({flow})")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `const BASE    = 'https://api.k-marketinsight.com';
const HEADERS = { Authorization: 'Bearer YOUR_API_KEY' };

const getSectors = async (date: string) => {
  const { sectors } = await fetch(\`\${BASE}/v1/sector-signals?date=\${date}\`, { headers: HEADERS })
    .then(r => r.json());
  return Object.fromEntries(sectors.map((s: any) => [s.sector_name, s]));
};

const fmt = (d: Date) => d.toISOString().split('T')[0];
const today     = fmt(new Date());
const yesterday = fmt(new Date(Date.now() - 86_400_000));

const [now, prev] = await Promise.all([getSectors(today), getSectors(yesterday)]);

console.log(\`Sector momentum shift  (\${yesterday} → \${today})\`);
console.log('─'.repeat(52));
Object.entries(now).forEach(([name, data]: [string, any]) => {
  const delta = data.momentum_score - (prev[name]?.momentum_score ?? 0);
  const arrow = delta > 0.05 ? '▲' : delta < -0.05 ? '▼' : '─';
  console.log(\`  \${arrow} \${name.padEnd(28)} \${delta > 0 ? '+' : ''}\${delta.toFixed(2)}  (\${data.flow_signal})\`);
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
    headers = {"Authorization": "Bearer YOUR_API_KEY"}
    for attempt in range(retries):
        r = requests.get(url, headers=headers, params=params)

        if r.status_code == 429:
            # Respect Retry-After header
            wait = int(r.headers.get("Retry-After", 5))
            print(f"Rate limited. Retrying in {wait}s…")
            time.sleep(wait)
            continue

        r.raise_for_status()
        return r.json()

    raise RuntimeError(f"API call failed after {retries} attempts")

try:
    data = call_api(
        "https://api.k-marketinsight.com/v1/events",
        params={"ticker": "005930", "limit": 20}
    )
    print(f"Fetched {len(data['events'])} events")

except HTTPError as e:
    err = e.response.json()
    # err = { "error": "…", "code": "UNAUTHORIZED", "status": 401 }
    print(f"API error {err['status']}: {err['error']}  (code={err['code']})")

except RuntimeError as e:
    print(f"Retry exhausted: {e}")`,
      },
      {
        label: 'TypeScript',
        language: 'typescript',
        code: `interface ApiError { error: string; code: string; status: number; }

async function callApi<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: { Authorization: 'Bearer YOUR_API_KEY' },
    });

    if (res.status === 429) {
      // Respect Retry-After header
      const wait = parseInt(res.headers.get('Retry-After') ?? '5') * 1_000;
      console.log(\`Rate limited. Retrying in \${wait / 1000}s…\`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const err: ApiError = await res.json();
      throw new Error(\`[\${err.code}] \${err.error} (HTTP \${err.status})\`);
    }

    return res.json() as Promise<T>;
  }
  throw new Error(\`API call failed after \${retries} attempts\`);
}

// Usage
try {
  const data = await callApi<{ events: unknown[]; total: number }>(
    'https://api.k-marketinsight.com/v1/events?ticker=005930&limit=20'
  );
  console.log(\`Fetched \${data.events.length} events (total \${data.total})\`);
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
                The K-Market Insight API provides structured Korean equity intelligence — corporate events, sector signals, and market radar — via a REST interface. All responses are JSON. Timestamps are ISO 8601 UTC.
              </SectionLead>

              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                <InfoCard label="Base URL"      value="https://api.k-marketinsight.com" />
                <InfoCard label="Current version" value="v1" />
                <InfoCard label="Response format" value="JSON (application/json)" />
                <InfoCard label="Authentication"  value="Bearer token (Authorization header)" />
                <InfoCard label="Timestamp format" value="ISO 8601 UTC  (e.g. 2026-03-10T06:38:00Z)" />
                <InfoCard label="CORS"            value="Enabled — browser requests supported" />
              </div>

              <Divider />

              {/* Rate limits */}
              <h2 className="text-lg font-semibold text-white mb-3">Rate Limits</h2>
              <SectionLead>
                Rate limits are enforced per API key. If you exceed your limit, the API returns HTTP 429 with a <code className="text-[#00D4A6] text-xs">Retry-After</code> header indicating seconds until the next window.
              </SectionLead>
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
                      { plan: 'Starter',    rpm: '60',     rpd: '5,000',   hist: '1 year' },
                      { plan: 'Pro',        rpm: '300',    rpd: '50,000',  hist: '3 years' },
                      { plan: 'Enterprise', rpm: 'Custom', rpd: 'Custom',  hist: 'Full history (since 2015)' },
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

              <Divider />

              {/* Pagination */}
              <h2 className="text-lg font-semibold text-white mb-3">Pagination</h2>
              <SectionLead>
                Endpoints that return lists use cursor-based pagination. Pass <code className="text-[#00D4A6] text-xs">limit</code> (max 100) to control page size. When more pages exist, the response includes a <code className="text-[#00D4A6] text-xs">next_cursor</code> string — pass it as the <code className="text-[#00D4A6] text-xs">cursor</code> parameter in your next request.
              </SectionLead>
              <CodeBlock language="typescript" code={`// Page 1
const page1 = await fetch('/v1/events?limit=20', { headers }).then(r => r.json());
// page1.next_cursor = "eyJpZCI6Im..."

// Page 2
const page2 = await fetch(\`/v1/events?limit=20&cursor=\${page1.next_cursor}\`, { headers })
  .then(r => r.json());
// page2.next_cursor = null  →  last page`} />

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
                All API requests require a valid API key. The recommended method is passing it as a Bearer token in the <code className="text-[#00D4A6] text-sm">Authorization</code> header. An alternative is the <code className="text-[#00D4A6] text-sm">x-api-key</code> header (useful for environments that restrict custom headers).
              </SectionLead>

              {/* Method 1 */}
              <h2 className="text-base font-semibold text-white mb-3">Method 1 — Authorization header (recommended)</h2>
              <div className="bg-[#121821] border border-[#00D4A6]/20 rounded-xl p-5 mb-6 font-mono text-sm">
                <span className="text-gray-500">Authorization: </span>
                <span className="text-[#00D4A6]">Bearer YOUR_API_KEY</span>
              </div>

              {/* Method 2 */}
              <h2 className="text-base font-semibold text-white mb-3">Method 2 — x-api-key header</h2>
              <div className="bg-[#121821] border border-gray-800 rounded-xl p-5 mb-6 font-mono text-sm">
                <span className="text-gray-500">x-api-key: </span>
                <span className="text-[#00D4A6]">YOUR_API_KEY</span>
              </div>

              {/* Code examples */}
              <SubHeading className="mt-6">Code Examples</SubHeading>
              <LangTabs tabs={[
                {
                  label: 'curl',
                  language: 'bash',
                  code: `# Authorization header (recommended)
curl https://api.k-marketinsight.com/v1/market-radar \\
  -H "Authorization: Bearer YOUR_API_KEY"

# x-api-key header (alternative)
curl https://api.k-marketinsight.com/v1/market-radar \\
  -H "x-api-key: YOUR_API_KEY"`,
                },
                {
                  label: 'Python',
                  language: 'python',
                  code: `import requests

# Authorization header (recommended)
res = requests.get(
    "https://api.k-marketinsight.com/v1/market-radar",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
)
print(res.json())`,
                },
                {
                  label: 'TypeScript',
                  language: 'typescript',
                  code: `// Authorization header (recommended)
const res = await fetch('https://api.k-marketinsight.com/v1/market-radar', {
  headers: { Authorization: 'Bearer YOUR_API_KEY' },
});
const data = await res.json();`,
                },
              ]} />

              <Divider />

              {/* API key types */}
              <h2 className="text-base font-semibold text-white mb-3">API Key Types</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm border border-gray-800 rounded-xl overflow-hidden">
                  <thead className="bg-[#121821]">
                    <tr>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Prefix</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Environment</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-800">
                      <td className="px-4 py-3"><code className="text-xs text-[#00D4A6]">kmi_live_</code></td>
                      <td className="px-4 py-3 text-sm text-gray-400">Production</td>
                      <td className="px-4 py-3 text-sm text-gray-400">Real DART data, counts against rate limits.</td>
                    </tr>
                    <tr className="border-t border-gray-800 bg-[#121821]/40">
                      <td className="px-4 py-3"><code className="text-xs text-[#00D4A6]">kmi_test_</code></td>
                      <td className="px-4 py-3 text-sm text-gray-400">Sandbox</td>
                      <td className="px-4 py-3 text-sm text-gray-400">Synthetic data, no rate limit charges. Safe for testing.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

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
                The API uses standard HTTP status codes. All error responses share the same JSON body shape so you can handle them uniformly.
              </SectionLead>

              {/* Error format */}
              <h2 className="text-base font-semibold text-white mb-3">Error Response Format</h2>
              <CodeBlock language="json" code={`{
  "error": "Invalid API key.",
  "code":  "UNAUTHORIZED",
  "status": 401
}`} />

              <Divider />

              {/* Status codes table */}
              <h2 className="text-base font-semibold text-white mb-3">HTTP Status Codes</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm border border-gray-800 rounded-xl overflow-hidden">
                  <thead className="bg-[#121821]">
                    <tr>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-20">Status</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-44">Code</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { status: '400', code: 'BAD_REQUEST',    desc: 'A required parameter is missing or a value is invalid (e.g. malformed date).' },
                      { status: '401', code: 'UNAUTHORIZED',   desc: 'API key is missing, invalid, or expired.' },
                      { status: '403', code: 'FORBIDDEN',      desc: 'Your current plan does not include access to this endpoint.' },
                      { status: '404', code: 'NOT_FOUND',      desc: 'The requested resource does not exist (e.g. unknown ticker).' },
                      { status: '422', code: 'UNPROCESSABLE',  desc: 'Request was understood but contains a logical conflict (e.g. date and from/to used together).' },
                      { status: '429', code: 'RATE_LIMITED',   desc: 'Rate limit exceeded. Check the Retry-After response header for the wait time in seconds.' },
                      { status: '500', code: 'INTERNAL_ERROR', desc: 'Unexpected server error. Retry with exponential backoff. Contact support if it persists.' },
                    ].map((row, i) => (
                      <tr key={row.status} className={`border-t border-gray-800 ${i % 2 !== 0 ? 'bg-[#121821]/40' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-mono font-medium ${
                            row.status.startsWith('4') ? 'text-yellow-400' :
                            row.status.startsWith('5') ? 'text-red-400' : 'text-gray-400'
                          }`}>{row.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-[#00D4A6]">{row.code}</code>
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
                When you receive a 429, read the <code className="text-[#00D4A6] text-xs">Retry-After</code> header to know exactly how many seconds to wait. Use exponential backoff as a fallback when the header is absent.
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
