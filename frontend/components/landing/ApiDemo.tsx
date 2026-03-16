'use client';

import { useState } from 'react';
import Link from 'next/link';
import Section from './ui/Section';
import CodeBlock from './ui/CodeBlock';

const endpoints = [
  { method: 'GET', path: '/v1/market-radar', response: `{
  "date": "2026-03-10",
  "kospi": { "index": 2748.32, "change": "+1.2%" },
  "kosdaq": { "index": 891.54, "change": "+0.8%" },
  "foreign_net_flow": "+₩1.2T",
  "top_sectors": ["Semiconductors", "Shipbuilding"]
}` },
  { method: 'GET', path: '/v1/sector-signals', response: `{
  "date": "2026-03-10",
  "sectors": [
    { "name": "Semiconductors", "signal": "bullish", "change": "+2.4%" },
    { "name": "Shipbuilding",   "signal": "bullish", "change": "+1.8%" },
    { "name": "Biotech",        "signal": "bearish", "change": "-0.5%" }
  ]
}` },
  { method: 'GET', path: '/v1/events', response: `{
  "events": [
    {
      "ticker": "005930",
      "company": "Samsung Electronics",
      "event": "earnings",
      "impact": "positive",
      "confidence": 0.83,
      "published_at": "2026-03-10"
    }
  ]
}` },
  { method: 'GET', path: '/v1/disclosures', response: `{
  "disclosures": [
    {
      "rcept_no": "20260310000123",
      "corp_name": "Samsung Electronics",
      "report_nm": "분기보고서",
      "rcept_dt": "2026-03-10",
      "ai_summary": "Q4 revenue beat expectations..."
    }
  ]
}` },
  { method: 'GET', path: '/v1/company/{ticker}', response: `{
  "ticker": "005930",
  "company": "Samsung Electronics",
  "event": "earnings",
  "impact": "positive",
  "confidence": 0.83,
  "published_at": "2026-03-10"
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
