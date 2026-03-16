import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import Card from '@/components/landing/ui/Card';
import { FileText, TrendingUp, Globe, Building2, ArrowRight, ExternalLink } from 'lucide-react';

const datasets = [
  {
    Icon: FileText,
    accent: '#00D4A6',
    id: 'corporate-events',
    title: 'Corporate Event Dataset',
    desc: 'AI-classified corporate disclosure events sourced from DART (Korean SEC), structured for quant and fintech use cases.',
    fields: ['ticker', 'company', 'event_type', 'impact_score', 'sentiment', 'published_at'],
    events: ['Earnings', 'M&A', 'Capital Raise', 'Share Buyback', 'Contracts'],
    update: 'Real-time',
    coverage: '2,400+ companies',
  },
  {
    Icon: TrendingUp,
    accent: '#4EA3FF',
    id: 'sector-signals',
    title: 'Sector Signals Dataset',
    desc: 'Daily sector-level signals generated from market data and corporate disclosures across 18 KSIC-classified sectors.',
    fields: ['sector_name', 'momentum_score', 'flow_signal', 'sentiment_score'],
    events: ['18 Sectors', 'Daily Signals', 'Momentum', 'Flow Data'],
    update: 'Daily',
    coverage: '18 sectors',
  },
  {
    Icon: Globe,
    accent: '#a78bfa',
    id: 'market-radar',
    title: 'Market Radar Dataset',
    desc: 'High-level Korean market indicators covering foreign net flow, sector rotation, and market momentum for KOSPI & KOSDAQ.',
    fields: ['foreign_net_flow', 'sector_rotation', 'market_momentum'],
    events: ['KOSPI', 'KOSDAQ', 'Foreign Flow', 'Macro Indicators'],
    update: 'Intraday',
    coverage: 'KOSPI + KOSDAQ',
  },
  {
    Icon: Building2,
    accent: '#fb923c',
    id: 'company-intelligence',
    title: 'Company Intelligence Dataset',
    desc: 'Structured event timeline and risk signals per company. Full history from 2010 with sentiment trends.',
    fields: ['ticker', 'event_history', 'risk_flags', 'sentiment_trend'],
    events: ['Event Timeline', 'Risk Flags', 'Sentiment Trend', 'Full History'],
    update: 'Real-time',
    coverage: 'Since 2010',
  },
];

export default function DatasetsPage() {
  return (
    <div className="bg-[#0B0F14] min-h-screen text-gray-200">
      <Navbar />

      {/* Header */}
      <section className="border-b border-gray-800 py-16 px-4">
        <div className="max-w-[1200px] mx-auto">
          <p className="text-xs text-[#00D4A6] font-semibold uppercase tracking-widest mb-3">Datasets</p>
          <h1 className="text-4xl font-bold text-white mb-4">Data Products</h1>
          <p className="text-gray-400 max-w-xl text-lg">
            Structured market datasets derived from Korean corporate disclosures and market signals.
          </p>
        </div>
      </section>

      {/* Dataset cards */}
      <section className="py-16 px-4">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
          {datasets.map((d) => (
            <Card key={d.id} className="p-8">
              <div className="grid md:grid-cols-3 gap-8">
                {/* Left: info */}
                <div className="md:col-span-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${d.accent}15` }}>
                      <d.Icon size={20} style={{ color: d.accent }} />
                    </div>
                    <h2 className="text-xl font-bold text-white">{d.title}</h2>
                  </div>
                  <p className="text-gray-400 mb-6 leading-relaxed">{d.desc}</p>

                  {/* Fields */}
                  <div className="mb-5">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Fields</p>
                    <div className="flex flex-wrap gap-2">
                      {d.fields.map((f) => (
                        <code key={f} className="text-xs bg-gray-900 border border-gray-700 text-gray-300 px-2.5 py-1 rounded-md">{f}</code>
                      ))}
                    </div>
                  </div>

                  {/* Events/Tags */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Coverage</p>
                    <div className="flex flex-wrap gap-2">
                      {d.events.map((e) => (
                        <span key={e} className="text-xs px-2.5 py-1 rounded-full border" style={{ background: `${d.accent}10`, color: d.accent, borderColor: `${d.accent}30` }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: meta + CTA */}
                <div className="flex flex-col justify-between gap-6">
                  <div className="bg-[#0B0F14] rounded-xl p-5 border border-gray-800 flex flex-col gap-4">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Update Frequency</p>
                      <p className="text-sm font-semibold text-white mt-1">{d.update}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Coverage</p>
                      <p className="text-sm font-semibold text-white mt-1">{d.coverage}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Format</p>
                      <p className="text-sm font-semibold text-white mt-1">JSON / REST API</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Link
                      href="/api-docs"
                      className="flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl bg-[#00D4A6] text-[#0B0F14] hover:bg-[#00bfa0] transition"
                    >
                      View Dataset <ArrowRight size={14} />
                    </Link>
                    <Link
                      href="/api-docs"
                      className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white py-2 transition"
                    >
                      <ExternalLink size={13} /> API Reference
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
