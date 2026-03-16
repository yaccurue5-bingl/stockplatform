import Link from 'next/link';
import Section from './ui/Section';
import Card from './ui/Card';
import { FileText, TrendingUp, Globe, Building2 } from 'lucide-react';

const products = [
  {
    Icon: FileText,
    title: 'Corporate Events',
    desc: 'AI-classified DART disclosures',
    tags: ['Earnings', 'M&A', 'Capital Raise', 'Share Buybacks'],
    accent: '#00D4A6',
    href: '/datasets#corporate-events',
  },
  {
    Icon: TrendingUp,
    title: 'Sector Signals',
    desc: 'Momentum & flow indicators',
    tags: ['18 Sectors', 'Daily Signals', 'Momentum', 'Flow Data'],
    accent: '#4EA3FF',
    href: '/datasets#sector-signals',
  },
  {
    Icon: Globe,
    title: 'Market Radar',
    desc: 'Macro + foreign flow indicators',
    tags: ['KOSPI', 'KOSDAQ', 'Daily Updates', 'Foreign Flow'],
    accent: '#a78bfa',
    href: '/datasets#market-radar',
  },
  {
    Icon: Building2,
    title: 'Company Intelligence',
    desc: 'Event history & sentiment',
    tags: ['Event Timeline', 'Sentiment Signals', 'Full Coverage', 'API Access'],
    accent: '#fb923c',
    href: '/datasets#company-intelligence',
  },
];

export default function DataProducts() {
  return (
    <Section className="bg-[#0B0F14]" id="datasets">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-white mb-3">Data Products</h2>
        <p className="text-gray-400 max-w-xl mx-auto">Four structured datasets built on Korean market intelligence.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {products.map((p) => (
          <Card key={p.title} hover className="p-6 flex flex-col gap-4">
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
            <Link
              href={p.href}
              className="mt-auto text-xs font-semibold hover:underline transition"
              style={{ color: p.accent }}
            >
              View Dataset →
            </Link>
          </Card>
        ))}
      </div>
    </Section>
  );
}
