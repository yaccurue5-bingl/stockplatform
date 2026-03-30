import Link from 'next/link';
import Navbar from './Navbar';
import Footer from './Footer';
import { Check, TrendingUp, Zap, Database, ArrowRight } from 'lucide-react';

export interface EventLandingConfig {
  /** SEO */
  slug: string;
  title: string;         // H1
  subtitle: string;
  description: string;   // <meta description>

  /** Badge */
  badge: string;

  /** Stats row */
  stats: { value: string; label: string }[];

  /** What is section */
  whatTitle: string;
  whatBody: string;

  /** Feature cards */
  features: { icon: 'trending' | 'zap' | 'db'; title: string; body: string }[];

  /** How it works steps */
  steps: { num: string; title: string; body: string }[];

  /** Sample table */
  tableTitle: string;
  tableHeaders: string[];
  tableRows: string[][];

  /** Use cases */
  useCases: { title: string; body: string }[];
}

const FeatureIcon = ({ name }: { name: EventLandingConfig['features'][0]['icon'] }) => {
  if (name === 'trending') return <TrendingUp size={20} className="text-[#00D4A6]" />;
  if (name === 'zap')      return <Zap        size={20} className="text-[#00D4A6]" />;
  return                          <Database   size={20} className="text-[#00D4A6]" />;
};

export default function EventLandingPage({ cfg }: { cfg: EventLandingConfig }) {
  return (
    <div className="bg-[#0B0F14] text-gray-200 font-sans min-h-screen">
      <Navbar />

      {/* ── Hero ── */}
      <section className="py-24 px-4">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#121821] border border-gray-800 rounded-full px-3 py-1.5 text-xs text-gray-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4A6] animate-pulse" />
            {cfg.badge}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
            {cfg.title}
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            {cfg.subtitle}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/login"
              className="bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-bold px-7 py-3 rounded-lg transition text-sm"
            >
              Get API Key →
            </Link>
            <Link
              href="/api-docs"
              className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium px-7 py-3 rounded-lg transition text-sm"
            >
              View Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-gray-800 py-10 px-4">
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {cfg.stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold text-[#00D4A6]">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What is ── */}
      <section className="py-20 px-4">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-5">{cfg.whatTitle}</h2>
          <p className="text-gray-400 text-base leading-relaxed">{cfg.whatBody}</p>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="py-4 px-4 pb-20">
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-3 gap-6">
          {cfg.features.map((f) => (
            <div key={f.title} className="bg-[#121821] border border-gray-800 rounded-2xl p-6">
              <div className="w-9 h-9 rounded-lg bg-[#00D4A6]/10 flex items-center justify-center mb-4">
                <FeatureIcon name={f.icon} />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-[#0d1218] py-20 px-4 border-y border-gray-800">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-12 text-center">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {cfg.steps.map((s, i) => (
              <div key={s.num} className="flex flex-col items-start">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-[#00D4A6]/15 text-[#00D4A6] text-sm font-bold flex items-center justify-center">
                    {s.num}
                  </span>
                  {i < cfg.steps.length - 1 && (
                    <ArrowRight size={14} className="text-gray-700 hidden md:block" />
                  )}
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sample Data Table ── */}
      <section className="py-20 px-4">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-2xl font-bold text-white mb-2">{cfg.tableTitle}</h2>
          <p className="text-gray-500 text-sm mb-8">Sample structured output from our API</p>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#121821] border-b border-gray-800">
                  {cfg.tableHeaders.map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cfg.tableRows.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-gray-800/50 hover:bg-[#121821]/50 transition"
                  >
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section className="bg-[#0d1218] py-20 px-4 border-y border-gray-800">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-10 text-center">Who Uses This Data</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {cfg.useCases.map((u) => (
              <div key={u.title} className="bg-[#121821] border border-gray-800 rounded-2xl p-6">
                <div className="flex items-start gap-2 mb-3">
                  <Check size={14} className="text-[#00D4A6] mt-0.5 shrink-0" />
                  <h3 className="font-semibold text-white text-sm">{u.title}</h3>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed pl-5">{u.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24 px-4">
        <div className="max-w-[700px] mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Start Building Today
          </h2>
          <p className="text-gray-400 mb-8">
            Free plan includes 100 API requests/day. No credit card required.
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-bold px-8 py-4 rounded-lg transition text-sm"
          >
            Get Your Free API Key →
          </Link>
          <p className="text-xs text-gray-600 mt-4">
            Upgrade to Developer ($49/mo) or Pro ($199/mo) for higher limits.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
