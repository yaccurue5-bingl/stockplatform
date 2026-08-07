'use client';

import { useState } from 'react';
import Link from 'next/link';
import Section from './ui/Section';
import CodeBlock from './ui/CodeBlock';

const endpoints = [
  { method: 'GET', path: '/v1/market-radar', response: `{
  "data": [
    {
      "date": "2026-03-10",
      "market_signal": "Bullish",
      "top_sector_en": "Semiconductors",
      "kospi_change": "+1.2%",
      "kosdaq_change": "+0.8%",
      "foreign_flow": "+8,300억원",
      "regime": "RISK_ON"
    }
  ],
  "total": 1
}` },
  { method: 'GET', path: '/v1/sector-signals', response: `{
  "data": [
    { "sector_en": "Semiconductors", "signal": "Bullish", "confidence": 0.74 },
    { "sector_en": "Shipbuilding",   "signal": "Bullish", "confidence": 0.61 },
    { "sector_en": "Biotech",        "signal": "Bearish", "confidence": 0.42 }
  ],
  "total": 3
}` },
  { method: 'GET', path: '/v1/events', response: `{
  "statistics": [
    { "event_type": "EARNINGS", "avg_5d_return": 1.8, "sample_size": 1204 }
  ],
  "recent_events": [
    {
      "stock_code": "005930",
      "corp_name": "Samsung Electronics",
      "event_type": "EARNINGS",
      "signal_tag": "🔥 High Conviction"
    }
  ]
}` },
  { method: 'GET', path: '/v1/disclosures', response: `{
  "data": [
    {
      "rcept_no": "20260310000123",
      "corp_name": "Samsung Electronics",
      "report_name": "Quarterly Report",
      "rcept_dt": "20260310",
      "ai_summary": "Q4 revenue beat expectations...",
      "signal_tag": "🔥 High Conviction"
    }
  ],
  "total": 1
}` },
  { method: 'GET', path: '/v1/signal-performance', response: `{
  "data": [
    {
      "event_type": "EARNINGS",
      "hit_ratio_5d": 58.3,
      "avg_20d_return": 3.1,
      "signal_grade": "A",
      "signal_score": 82.4
    }
  ],
  "total": 1
}` },
];

export default function ApiDemo() {
  const [active, setActive] = useState(0);

  return (
    <Section className="bg-[#0D1117]" id="api-docs">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-white mb-3">Simple, Powerful API</h2>
        <p className="text-gray-400 max-w-xl mx-auto">
          RESTful endpoints with JSON responses. Start querying in minutes.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* Endpoint list */}
        <div className="flex flex-col gap-2">
          {endpoints.map((ep, i) => (
            <button
              key={ep.path}
              onClick={() => setActive(i)}
              className={`
                flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition border
                ${active === i
                  ? 'bg-[#121821] border-[#00D4A6]/40 text-white'
                  : 'bg-transparent border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300'}
              `}
            >
              <span className="text-xs font-bold text-[#00D4A6] w-8 shrink-0">{ep.method}</span>
              <code className="text-sm font-mono">{ep.path}</code>
            </button>
          ))}
        </div>

        {/* Code block + CTA */}
        <div className="flex flex-col gap-4">
          <CodeBlock code={endpoints[active].response} language="json" />
          <Link
            href="/api-docs"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00D4A6] hover:text-[#00bfa0] transition"
          >
            View Full API Docs →
          </Link>
        </div>
      </div>
    </Section>
  );
}
