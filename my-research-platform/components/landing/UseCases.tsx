import Section from './ui/Section';
import Card from './ui/Card';

const cases = [
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D4A6" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    title: 'Quant Funds',
    desc: 'Event-driven alpha signals from structured corporate disclosures and real-time DART feeds.',
    accent: '#00D4A6',
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4EA3FF" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
    title: 'ETF Providers',
    desc: 'Sector allocation models powered by 18-sector classification and momentum indicators.',
    accent: '#4EA3FF',
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
    title: 'Fintech Apps',
    desc: 'Embed live market intelligence APIs directly into your financial applications.',
    accent: '#a78bfa',
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
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
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${c.accent}15` }}>
              {c.icon}
            </div>
            <h3 className="text-white font-semibold mb-2">{c.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{c.desc}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
