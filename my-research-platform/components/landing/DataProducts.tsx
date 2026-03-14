import Section from './ui/Section';
import Card from './ui/Card';

const products = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4A6" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    ),
    title: 'Corporate Events',
    desc: 'AI-classified DART disclosures',
    tags: ['Earnings', 'M&A', 'Capital Raise', 'Share Buybacks'],
    accent: '#00D4A6',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4EA3FF" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
    ),
    title: 'Sector Signals',
    desc: 'Momentum & flow indicators',
    tags: ['18 Sectors', 'Daily Signals', 'Momentum', 'Flow Data'],
    accent: '#4EA3FF',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    ),
    title: 'Market Radar',
    desc: 'Macro + foreign flow indicators',
    tags: ['KOSPI', 'KOSDAQ', 'Daily Updates', 'Foreign Flow'],
    accent: '#a78bfa',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
    ),
    title: 'Company Intelligence',
    desc: 'Event history & sentiment',
    tags: ['Event Timeline', 'Sentiment Signals', 'Full Coverage', 'API Access'],
    accent: '#fb923c',
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
            <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: `${p.accent}15` }}>
              {p.icon}
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">{p.title}</h3>
              <p className="text-xs text-gray-400">{p.desc}</p>
            </div>
            <ul className="flex flex-col gap-1.5 mt-auto">
              {p.tags.map((tag) => (
                <li key={tag} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-1 h-1 rounded-full" style={{ background: p.accent }} />
                  {tag}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Section>
  );
}
