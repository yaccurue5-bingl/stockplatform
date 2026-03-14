import Section from './ui/Section';
import Card from './ui/Card';

const events = [
  { company: 'Samsung Electronics', ticker: '005930', event: 'Earnings Beat',      impact: '+0.83', positive: true,  color: 'bg-[#00D4A6]/10 text-[#00D4A6] border-[#00D4A6]/30' },
  { company: 'SK Hynix',            ticker: '000660', event: 'Capital Investment',  impact: '+0.71', positive: true,  color: 'bg-[#4EA3FF]/10 text-[#4EA3FF] border-[#4EA3FF]/30' },
  { company: 'Hyundai Motor',        ticker: '005380', event: 'Strategic Contract', impact: '+0.65', positive: true,  color: 'bg-purple-400/10 text-purple-400 border-purple-400/30' },
];

export default function LiveEvents() {
  return (
    <Section className="bg-[#0D1117]" id="events">
      <div className="flex items-center gap-2 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#00D4A6"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        <span className="text-xs text-[#00D4A6] font-semibold uppercase tracking-widest">Real-time</span>
      </div>
      <h2 className="text-3xl font-bold text-white mb-2">Live Corporate Events</h2>
      <p className="text-gray-400 mb-10">AI-classified signals from DART disclosures, updated in real-time.</p>
      <div className="flex flex-col gap-3">
        {events.map((e) => (
          <Card key={e.company} hover className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-300">
                  {e.company.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{e.company}</p>
                <p className="text-xs text-gray-500">{e.ticker}</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${e.color}`}>{e.event}</span>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${e.positive ? 'text-[#00D4A6]' : 'text-red-400'}`}>{e.impact}</p>
              <p className="text-xs text-gray-500">Impact Score</p>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
