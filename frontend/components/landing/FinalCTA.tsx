import Link from 'next/link';
import Section from './ui/Section';

export default function FinalCTA() {
  return (
    <Section className="bg-[#0D1117]">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-4xl font-bold text-white mb-4">
          Start Seeing the Market Differently
        </h2>
        <p className="text-gray-400 text-lg mb-10 leading-relaxed">
          Don&apos;t just read disclosures —<br className="hidden sm:block" />
          understand them before others do.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-bold px-10 py-4 rounded-xl transition text-base"
        >
          Get Access Now
        </Link>
      </div>
    </Section>
  );
}
