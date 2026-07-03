import Link from 'next/link';
import type { EventMethodology } from '@/lib/config/event-methodology';

export default function MethodologySection({
  methodology,
}: {
  methodology: EventMethodology;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-3">
        How This Event Is Evaluated
      </p>
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{methodology.title}</h2>
          <p className="mt-2 text-sm text-gray-300 leading-relaxed">{methodology.description}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 space-y-2">
          <p className="text-xs text-gray-400 leading-relaxed">
            AI is used to interpret disclosures and extract structured data.
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Signal scores are generated using event-specific methodologies and quantitative models.
          </p>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {methodology.factors.map((factor) => (
            <li
              key={factor}
              className="rounded-lg bg-gray-800/50 px-3 py-2 text-xs text-gray-300"
            >
              {factor}
            </li>
          ))}
        </ul>
        <Link
          href="/methodology"
          className="inline-block text-xs text-[#00D4A6] hover:underline"
        >
          Read our full scoring methodology →
        </Link>
      </div>
    </div>
  );
}
