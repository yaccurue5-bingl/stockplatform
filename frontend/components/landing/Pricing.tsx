'use client';

import { useState } from 'react';
import { Sparkles, Zap, Filter, RefreshCw, Mail } from 'lucide-react';
import PricingModal from './PricingModal';

const features = [
  { icon: Zap,        text: 'AI-interpreted Korean disclosures — structured & in English' },
  { icon: Sparkles,   text: 'Signal scoring & filtering across key disclosure events' },
  { icon: Filter,     text: 'Fast structured summaries for faster disclosure review' },
  { icon: RefreshCw,  text: 'Rolling improvements as data coverage expands' },
];

export default function Pricing() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section id="pricing" className="bg-[#0B0F14] py-24 px-6">
      <div className="max-w-2xl mx-auto text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#00D4A6] bg-[#00D4A6]/10 border border-[#00D4A6]/20 rounded-full px-3 py-1 mb-6 uppercase tracking-widest">
          Early Access
        </div>

        {/* Heading */}
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
          Get early access to<br />
          <span className="text-[#00D4A6]">Korean market signals</span>
        </h2>

        <p className="text-gray-400 text-base mb-10 leading-relaxed max-w-lg mx-auto">
          We're building structured intelligence on Korean corporate disclosures.
          Join early access — tell us how you'd use it and we'll be in touch.
        </p>

        {/* Feature list */}
        <ul className="flex flex-col gap-3 text-left max-w-sm mx-auto mb-10">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-gray-300">
              <span className="mt-0.5 w-6 h-6 rounded-md bg-[#00D4A6]/10 flex items-center justify-center shrink-0">
                <Icon size={13} className="text-[#00D4A6]" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-bold px-8 py-3.5 rounded-xl transition text-sm"
        >
          <Mail size={15} />
          Request Early Access
        </button>

        <p className="text-gray-600 text-xs mt-5">
          No commitment. Pricing shared individually based on use case.
        </p>
      </div>

      {modalOpen && (
        <PricingModal plan="Early Access" onClose={() => setModalOpen(false)} />
      )}
    </section>
  );
}
