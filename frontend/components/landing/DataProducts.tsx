import Link from 'next/link';
import Section from './ui/Section';
import { FileText, TrendingUp, Globe, Building2 } from 'lucide-react';

const products = [
  {
    Icon: FileText,
    title: 'Corporate Events',
    desc: 'AI-classified DART disclosures',
    tags: ['Earnings', 'M&A', 'Capital Raise', 'Share Buybacks'],
    accent: '#00D4A6',
    href: '/api-docs?endpoint=0',
  },
  {
    Icon: TrendingUp,
    title: 'Sector Signals',
    desc: 'Momentum & flow indicators',
    tags: ['18 Sectors', 'Daily Signals', 'Momentum', 'Flow Data'],
    accent: '#4EA3FF',
    href: '/api-docs?endpoint=1',
  },
  {
    Icon: Globe,
    title: 'Market Radar',
    desc: 'Macro + foreign flow indicators',
    tags: ['KOSPI', 'KOSDAQ', 'Daily Updates', 'Foreign Flow'],
    accent: '#a78bfa',
    href: '/api-docs?endpoint=2',
  },
  {
    Icon: Building2,
    title: 'Company Intelligence',
    desc: 'Event history & sentiment',
    tags: ['Event Timeline', 'Sentiment Signals', 'Full Coverage', 'API Access'],
    accent: '#fb923c',
    href: '/api-docs?endpoint=3',
  },
];

export default function DataProducts() {
  return (
    <Section className="bg-[#0B0F14]" id="datasets">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-white mb-3">We Turn Raw Filings into Actionable Signals</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          K-MarketInsight processes official filings from DART and converts them into clear English summaries,
          investor-focused impact analysis, and quantified signal strength.
        </p>
        <p className="text-[#00D4A6] font-semibold mt-3">Not just summaries — but decision-ready insights.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {products.map((p) => (
          <Link
            key={p.title}
            href={p.href}
            className="block bg-[#121821] border border-gray-800 rounded-xl p-6 flex flex-col gap-4
                       hover:border-[#00D4A6]/40 hover:shadow-lg hover:shadow-[#00D4A6]/5
                       transition-all duration-200 cursor-pointer"
          >
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center"
              style={{ background: `${p.accent}15` }}
            >
              <p.Icon size={20} style={{ color: p.accent }} />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">{p.title}</h3>
              <p className="text-xs text-gray-400">{p.desc}</p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {p.tags.map((tag) => (
                <li key={tag} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-1 h-1 rounded-full" style={{ background: p.accent }} />
                  {tag}
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>
    </Section>
  );
}
