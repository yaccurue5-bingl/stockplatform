import Section from './ui/Section';

const problems = [
  'Written only in Korean',
  'Released in complex regulatory formats',
  'Difficult to interpret quickly',
];

export default function Problem() {
  return (
    <Section className="bg-[#0D1117]">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-white mb-6">
          The Korean Market Is Opaque<br className="hidden sm:block" /> to Global Investors
        </h2>
        <p className="text-gray-400 text-lg mb-8">Most Korean corporate disclosures are:</p>

        <ul className="flex flex-col gap-4 mb-10 text-left max-w-md mx-auto">
          {problems.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <span className="mt-1 w-5 h-5 rounded-full bg-red-500/15 text-red-400 text-xs flex items-center justify-center shrink-0 font-bold">✕</span>
              <span className="text-gray-300 text-base">{p}</span>
            </li>
          ))}
        </ul>

        <div className="bg-[#121821] border border-gray-800 rounded-2xl px-8 py-6 inline-block">
          <p className="text-white text-lg font-semibold leading-relaxed">
            By the time you understand the information,<br className="hidden sm:block" />
            <span className="text-red-400"> the market has already moved.</span>
          </p>
        </div>
      </div>
    </Section>
  );
}
