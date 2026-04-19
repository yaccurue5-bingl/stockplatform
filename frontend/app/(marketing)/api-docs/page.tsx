'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import CodeBlock from '@/components/landing/ui/CodeBlock';

const sections = ['Introduction', 'Authentication', 'Endpoints', 'Examples'];

const endpoints = [
  {
    method: 'GET',
    path: '/v1/events',
    desc: 'Returns a list of AI-classified corporate events from DART disclosures.',
    params: [
      { name: 'ticker', type: 'string', desc: 'Company stock ticker (e.g. 005930)' },
      { name: 'sector', type: 'string', desc: 'Filter by sector name' },
      { name: 'date',   type: 'string', desc: 'ISO date string (YYYY-MM-DD)' },
    ],
    response: `{
  "events": [
    {
      "ticker": "005930",
      "company": "Samsung Electronics",
      "event_type": "earnings",
      "impact_score": 0.83,
      "sentiment": "positive",
      "published_at": "2026-03-10T06:38:00Z"
    }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/v1/sector-signals',
    desc: 'Returns daily sector-level momentum and flow signals across 18 KSIC sectors.',
    params: [
      { name: 'date',   type: 'string', desc: 'ISO date string (YYYY-MM-DD)' },
      { name: 'sector', type: 'string', desc: 'Specific sector name to filter' },
    ],
    response: `{
  "date": "2026-03-10",
  "sectors": [
    {
      "sector_name": "Semiconductors",
      "momentum_score": 0.74,
      "flow_signal": "inflow",
      "sentiment_score": 0.82
    },
    {
      "sector_name": "Biotech",
      "momentum_score": 0.31,
      "flow_signal": "outflow",
      "sentiment_score": 0.42
    }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/v1/market-radar',
    desc: 'Returns high-level Korean market indicators including foreign net flow and sector rotation.',
    params: [
      { name: 'date', type: 'string', desc: 'ISO date string (YYYY-MM-DD). Defaults to today.' },
    ],
    response: `{
  "date": "2026-03-10",
  "kospi":  { "index": 2748.32, "change": "+1.2%" },
  "kosdaq": { "index": 891.54,  "change": "+0.8%" },
  "foreign_net_flow": "+₩1.2T",
  "sector_rotation": "Semiconductors → Shipbuilding",
  "market_momentum": "bullish"
}`,
  },
  {
    method: 'GET',
    path: '/v1/company/{ticker}',
    desc: 'Returns the full corporate event history, risk flags, and sentiment trend for a specific company.',
    params: [
      { name: 'ticker', type: 'path', desc: 'Company stock ticker (e.g. 005930)' },
      { name: 'from',   type: 'string', desc: 'Start date (YYYY-MM-DD)' },
      { name: 'to',     type: 'string', desc: 'End date (YYYY-MM-DD)' },
    ],
    response: `{
  "ticker": "005930",
  "company": "Samsung Electronics",
  "event_history": [
    { "date": "2026-03-10", "event": "earnings", "impact": 0.83 },
    { "date": "2026-01-15", "event": "capital_raise", "impact": 0.61 }
  ],
  "risk_flags": [],
  "sentiment_trend": "improving"
}`,
  },
];

const authCode = `// Include your API key in every request header
fetch('https://api.k-marketinsight.com/v1/events', {
  headers: {
    'Authorization': 'Bearer kmi_live_8dj392jd92k',
    'Content-Type': 'application/json',
  }
})`;

const exampleCode = `// Fetch today's corporate events for Samsung Electronics
const res = await fetch(
  'https://api.k-marketinsight.com/v1/events?ticker=005930',
  { headers: { Authorization: 'Bearer kmi_live_xxxxx' } }
);
const { events } = await res.json();
console.log(events[0].event_type); // "earnings"`;

// useSearchParams는 Suspense 경계 내에서만 사용 가능 (Next.js 16 요구사항)
function SearchParamsHandler({
  onEndpoint,
}: {
  onEndpoint: (section: string, idx: number) => void;
}) {
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

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState('Introduction');
  const [activeEndpoint, setActiveEndpoint] = useState(0);

  return (
    <div className="bg-[#0B0F14] min-h-screen text-gray-200">
      {/* URL ?endpoint=N 파라미터 처리 — Suspense 필수 (Next.js 16) */}
      <Suspense fallback={null}>
        <SearchParamsHandler
          onEndpoint={(section, idx) => {
            setActiveSection(section);
            setActiveEndpoint(idx);
          }}
        />
      </Suspense>

      <Navbar />

      <div className="max-w-[1200px] mx-auto flex gap-0 min-h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-gray-800 py-10 px-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3 px-2">Docs</p>
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition ${
                activeSection === s
                  ? 'bg-[#00D4A6]/10 text-[#00D4A6] font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}

          {activeSection === 'Endpoints' && (
            <>
              <div className="border-t border-gray-800 my-4" />
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3 px-2">Endpoints</p>
              {endpoints.map((ep, i) => (
                <button
                  key={ep.path}
                  onClick={() => setActiveEndpoint(i)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs mb-1 transition font-mono ${
                    activeEndpoint === i ? 'text-[#00D4A6]' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {ep.path}
                </button>
              ))}
            </>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 py-10 px-10 overflow-auto">
          {activeSection === 'Introduction' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-4">API Reference</h1>
              <p className="text-gray-400 leading-relaxed mb-8 max-w-2xl">
                The K-Market Insight API gives you access to structured Korean market data — corporate events, sector signals, and market radar — via a simple REST interface.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: 'Base URL', value: 'https://api.k-marketinsight.com' },
                  { label: 'Version', value: 'v1' },
                  { label: 'Format', value: 'JSON' },
                  { label: 'Auth', value: 'Bearer token' },
                ].map((item) => (
                  <div key={item.label} className="bg-[#121821] border border-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                    <code className="text-sm text-[#00D4A6]">{item.value}</code>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <button onClick={() => setActiveSection('Authentication')} className="text-sm text-[#00D4A6] hover:underline">
                  Next: Authentication →
                </button>
              </div>
            </div>
          )}

          {activeSection === 'Authentication' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-4">Authentication</h1>
              <p className="text-gray-400 leading-relaxed mb-6 max-w-2xl">
                All API requests require a valid API key passed as a Bearer token in the <code className="text-[#00D4A6] text-sm">Authorization</code> header.
              </p>
              <div className="bg-[#121821] border border-[#00D4A6]/20 rounded-xl p-5 mb-6 font-mono text-sm">
                <span className="text-gray-500">Authorization: </span>
                <span className="text-[#00D4A6]">Bearer YOUR_API_KEY</span>
              </div>
              <CodeBlock code={authCode} language="typescript" />
              <p className="text-gray-500 text-sm mt-4">
                Generate your API key on the{' '}
                <a href="/api-key" className="text-[#00D4A6] hover:underline">API Key page</a>.
              </p>
            </div>
          )}

          {activeSection === 'Endpoints' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-8">Endpoints</h1>
              <div className="flex gap-2 flex-wrap mb-8">
                {endpoints.map((ep, i) => (
                  <button
                    key={ep.path}
                    onClick={() => setActiveEndpoint(i)}
                    className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition ${
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
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-bold px-2 py-1 rounded bg-[#00D4A6]/10 text-[#00D4A6]">{ep.method}</span>
                      <code className="text-lg font-mono text-white">{ep.path}</code>
                    </div>
                    <p className="text-gray-400 mb-6">{ep.desc}</p>

                    <h3 className="text-sm font-semibold text-white mb-3">Parameters</h3>
                    <div className="bg-[#121821] border border-gray-800 rounded-xl overflow-hidden mb-6">
                      {ep.params.map((p, i) => (
                        <div key={p.name} className={`flex items-start gap-4 px-5 py-4 ${i < ep.params.length - 1 ? 'border-b border-gray-800' : ''}`}>
                          <code className="text-xs text-[#00D4A6] w-32 shrink-0 mt-0.5">{p.name}</code>
                          <span className="text-xs text-gray-600 w-16 shrink-0 mt-0.5">{p.type}</span>
                          <span className="text-xs text-gray-400">{p.desc}</span>
                        </div>
                      ))}
                    </div>

                    <h3 className="text-sm font-semibold text-white mb-3">Example Response</h3>
                    <CodeBlock code={ep.response} language="json" />
                  </div>
                );
              })()}
            </div>
          )}

          {activeSection === 'Examples' && (
            <div>
              <h1 className="text-3xl font-bold text-white mb-4">Examples</h1>
              <p className="text-gray-400 mb-8">Quick-start code samples to get you up and running.</p>
              <h2 className="text-lg font-semibold text-white mb-3">Fetch Corporate Events</h2>
              <CodeBlock code={exampleCode} language="typescript" />
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
