import Link from 'next/link';
import { ArrowRight, Database, Zap, Shield, Globe, BarChart2, FileText } from 'lucide-react';

export const metadata = {
  title: 'API Access | K-Market Insight',
  description: 'Enterprise & institutional access to structured Korean market data — AI-derived disclosure signals, price data, and event analytics.',
};

const useCases = [
  {
    icon: BarChart2,
    title: 'Quantitative Funds',
    desc: 'Event-driven alpha signals from Korean corporate disclosures. M-score, volume z-score, and sentiment scoring pre-computed.',
  },
  {
    icon: Globe,
    title: 'Fintech Platforms',
    desc: 'Embed structured Korean market events into your product. REST API with JSON responses, no parsing required.',
  },
  {
    icon: FileText,
    title: 'Research & Data Vendors',
    desc: 'Historical DART disclosure archive with AI-extracted event types, financial figures, and signal tags.',
  },
  {
    icon: Shield,
    title: 'Compliance & Risk',
    desc: 'Real-time corporate event monitoring — legal filings, executive changes, dilution events, and CAPEX decisions.',
  },
];

const sampleResponse = `{
  "disclosure_id": "20250312800234",
  "stock_code": "005930",
  "corp_name": "Samsung Electronics",
  "event_type": "CONTRACT",
  "signal_date": "2025-03-12",
  "m_score": 1.24,
  "volume_z": 1.87,
  "e_score": 0.72,
  "final_score": 1.48,
  "is_signal": true,
  "ai_summary": "Supply agreement signed with major US semiconductor manufacturer. Contract value approximately KRW 340B over 18 months, representing 2.1% of annual revenue.",
  "sentiment": "positive"
}`;

export default function ApiAccessPage() {
  return (
    <main className="bg-[#0B0F14] text-gray-200 min-h-screen">
      {/* Hero */}
      <section className="max-w-[1100px] mx-auto px-6 pt-28 pb-20">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-[#00D4A6] bg-[#00D4A6]/10 border border-[#00D4A6]/20 rounded-full px-3 py-1 mb-6">
          Enterprise & Institutional
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
          Korean market signals,<br />
          <span className="text-[#00D4A6]">ready for your pipeline.</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Structured access to AI-derived Korean corporate event signals — DART disclosures, volume anomalies, and executive changes — delivered via REST API. Pricing on request.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/api-access#contact"
            className="inline-flex items-center gap-2 bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-semibold px-6 py-3 rounded-lg transition"
          >
            Request Access <ArrowRight size={16} />
          </Link>
          <Link
            href="/api-docs"
            className="inline-flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-6 py-3 rounded-lg transition"
          >
            View API Docs
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-gray-800 py-8">
        <div className="max-w-[1100px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { val: '2,800+', label: 'Listed companies covered' },
            { val: '12mo+', label: 'Historical depth' },
            { val: '8', label: 'Signal event types' },
            { val: 'Daily', label: 'Data refresh' },
          ].map(({ val, label }) => (
            <div key={label}>
              <p className="text-2xl font-bold text-white">{val}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="max-w-[1100px] mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-white mb-10">Built for institutional workflows</h2>
        <div className="grid md:grid-cols-2 gap-5">
          {useCases.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-[#121821] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition">
              <div className="w-9 h-9 rounded-lg bg-[#00D4A6]/10 flex items-center justify-center mb-4">
                <Icon size={18} className="text-[#00D4A6]" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sample response */}
      <section className="bg-[#0d1117] border-y border-gray-800 py-20">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-12 items-start">
            <div className="md:w-2/5 shrink-0">
              <div className="inline-flex items-center gap-2 text-xs text-[#00D4A6] bg-[#00D4A6]/10 border border-[#00D4A6]/20 rounded-full px-3 py-1 mb-4">
                <Database size={12} /> Sample Response
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Signals, not raw filings.
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Every disclosure is processed through our AI pipeline — event classification, sentiment scoring, and signal tagging — so you get structured data, not HTML.
              </p>
              <ul className="space-y-2">
                {[
                  'Event type classification (8 categories)',
                  'M-score & volume z-score pre-computed',
                  'AI summary in English',
                  'BUY signal flag with rule metadata',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00D4A6] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 w-full overflow-x-auto">
              <div className="bg-[#0B0F14] rounded-xl border border-gray-800 p-5">
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="w-3 h-3 rounded-full bg-red-500/50" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/50" />
                  <span className="w-3 h-3 rounded-full bg-green-500/50" />
                  <span className="ml-2 text-xs text-gray-500">GET /v1/signals/latest</span>
                </div>
                <pre className="text-xs text-gray-300 leading-relaxed font-mono whitespace-pre overflow-x-auto">
                  <code>{sampleResponse}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data coverage */}
      <section className="max-w-[1100px] mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-white mb-3">Data coverage</h2>
        <p className="text-gray-400 text-sm mb-10">All KOSPI & KOSDAQ listed companies. Updated daily from DART open API.</p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: 'Disclosure Signals', items: ['Earnings (실적)', 'Contract awards', 'Dilution / CB / BW', 'M&A / Splits', 'CAPEX decisions', 'Executive changes', 'Legal & penalties', 'Share buybacks'] },
            { icon: BarChart2, title: 'Market Data', items: ['Daily OHLCV', 'Volume z-score (20d)', 'Foreign net buy', 'Loan balance (대차)', 'Momentum score'] },
            { icon: FileText, title: 'Signal Metadata', items: ['M-score (momentum)', 'E-score (sentiment)', 'F-score (fundamental)', 'Final composite score', 'Signal rule audit trail', 'Historical reproducibility'] },
          ].map(({ icon: Icon, title, items }) => (
            <div key={title} className="bg-[#121821] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Icon size={16} className="text-[#00D4A6]" />
                <h3 className="font-semibold text-white text-sm">{title}</h3>
              </div>
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item} className="text-sm text-gray-400 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA / Contact */}
      <section id="contact" className="bg-[#121821] border-t border-gray-800 py-20">
        <div className="max-w-[600px] mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to integrate?</h2>
          <p className="text-gray-400 mb-2 leading-relaxed">
            We work with quant funds, fintech platforms, and institutional data teams.
          </p>
          <p className="text-gray-500 text-sm mb-10">
            Pricing is customized based on volume, history depth, and use case.
          </p>
          <a
            href="mailto:yaccurue5@gmail.com?subject=API Access Request — K-Market Insight&body=Hi,%0A%0AOrganization:%0AUse case:%0AData requirements:%0A%0A"
            className="inline-flex items-center gap-2 bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-bold px-8 py-4 rounded-xl transition text-base"
          >
            Request Access <ArrowRight size={18} />
          </a>
          <p className="text-xs text-gray-600 mt-6">
            Typical response within 1–2 business days. No commitment required.
          </p>
        </div>
      </section>
    </main>
  );
}
