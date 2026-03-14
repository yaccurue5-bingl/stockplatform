import Section from './ui/Section';
import Card from './ui/Card';
import { BarChart2, PieChart, Cpu, BookOpen } from 'lucide-react';

const cases = [
  {
    Icon: BarChart2,
    title: 'Quant Funds',
    desc: 'Event-driven alpha signals from structured corporate disclosures and real-time DART feeds.',
    accent: '#00D4A6',
  },
  {
    Icon: PieChart,
    title: 'ETF Providers',
    desc: 'Sector allocation models powered by 18-sector classification and momentum indicators.',
    accent: '#4EA3FF',
  },
  {
    Icon: Cpu,
    title: 'Fintech Apps',
    desc: 'Embed live market intelligence APIs directly into your financial applications.',
    accent: '#a78bfa',
  },
  {
    Icon: BookOpen,
    title: 'Research Platforms',
    desc: 'Access structured event history and sentiment signals for deep-dive corporate analysis.',
    accent: '#fb923c',
  },
];

export default function UseCases() {
  return (
    <Section className="bg-[#0D1117]" id="use-cases">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-white mb-3">Use Cases</h2>
        <p className="text-gray-400">Trusted by quant funds, fintechs, ETF providers, and research platforms.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cases.map((c) => (
          <Card key={c.title} hover className="p-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: `${c.accent}15` }}
            >
              <c.Icon size={22} style={{ color: c.accent }} />
            </div>
            <h3 className="text-white font-semibold mb-2">{c.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{c.desc}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
