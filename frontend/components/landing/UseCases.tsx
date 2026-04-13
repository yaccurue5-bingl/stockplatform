import Section from './ui/Section';
import Card from './ui/Card';
import { BarChart2, PieChart, Cpu, BookOpen } from 'lucide-react';

const cases = [
  {
    Icon: BarChart2,
    title: 'Save Hours of Manual Research',
    desc: 'Stop reading through Korean PDFs. Get structured, English-language summaries of every filing the moment it drops.',
    accent: '#00D4A6',
  },
  {
    Icon: Cpu,
    title: 'Catch Critical Events Faster',
    desc: 'Capital raises, M&A announcements, earnings surprises — flagged and scored before the market fully prices them in.',
    accent: '#4EA3FF',
  },
  {
    Icon: PieChart,
    title: 'Understand the Real Impact',
    desc: 'Not just the headline — investor-focused analysis tells you what it means for the stock, with a clear Buy / Neutral / Sell signal.',
    accent: '#a78bfa',
  },
  {
    Icon: BookOpen,
    title: 'Trust the Source',
    desc: 'Every signal links back to the original DART filing. Raw government data, AI-interpreted for speed and clarity.',
    accent: '#fb923c',
  },
];

export default function UseCases() {
  return (
    <Section className="bg-[#0D1117]" id="use-cases">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-white mb-3">Built for Speed, Clarity, and Edge</h2>
        <p className="text-gray-400">Everything you need to act on Korean market intelligence — fast.</p>
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
