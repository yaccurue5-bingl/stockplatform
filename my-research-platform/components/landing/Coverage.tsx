import Section from './ui/Section';

const stats = [
  { value: '2,400+', label: 'Listed Companies', sub: 'KOSPI + KOSDAQ' },
  { value: '4.2M',   label: 'Disclosures Processed', sub: 'Since 2010' },
  { value: '18',     label: 'Sector Classifications', sub: 'KSIC-based' },
  { value: '15+',    label: 'Years of History', sub: 'Full archive' },
];

export default function Coverage() {
  return (
    <Section className="bg-[#0B0F14]" id="coverage">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-white mb-3">Market Coverage</h2>
        <p className="text-gray-400">
          Comprehensive Korean market data from DART — Korea&apos;s official corporate disclosure system.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div
            key={s.value}
            className="bg-[#121821] border border-gray-800 rounded-2xl p-8 text-center"
          >
            <p className="text-5xl font-extrabold text-[#00D4A6] mb-2">{s.value}</p>
            <p className="text-white font-semibold mb-1">{s.label}</p>
            <p className="text-xs text-gray-500">{s.sub}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
