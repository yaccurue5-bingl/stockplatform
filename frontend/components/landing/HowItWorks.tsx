import Section from './ui/Section';

const steps = [
  {
    num: '01',
    title: 'Track',
    desc: 'Track all Korean corporate disclosures in real time as they are filed with regulators.',
    accent: '#00D4A6',
  },
  {
    num: '02',
    title: 'Analyze',
    desc: 'AI extracts key financial and strategic signals — earnings beats, dilution risk, M&A, and more.',
    accent: '#4EA3FF',
  },
  {
    num: '03',
    title: 'Decide',
    desc: 'Get instant investment interpretation and quantified signal scoring. Act before the market catches up.',
    accent: '#a78bfa',
  },
];

export default function HowItWorks() {
  return (
    <Section className="bg-[#0B0F14]">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-white mb-3">How It Works</h2>
        <p className="text-gray-400">Three steps from raw filing to actionable signal.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {steps.map((s, i) => (
          <div key={s.num} className="relative flex flex-col gap-4 bg-[#121821] border border-gray-800 rounded-2xl p-7">
            {/* connector line */}
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-10 left-full w-6 h-px bg-gray-700 z-10" />
            )}
            <span className="text-4xl font-black" style={{ color: s.accent }}>{s.num}</span>
            <h3 className="text-white font-bold text-xl">{s.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
