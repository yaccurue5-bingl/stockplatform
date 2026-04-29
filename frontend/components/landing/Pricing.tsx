'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import PricingModal from './PricingModal';

type PlanId = 'Starter' | 'Pro' | 'API';

const plans = [
  {
    id: 'Starter' as PlanId,
    name: 'Starter',
    price: '$19',
    period: '/mo',
    desc: 'Individual investors & developers',
    highlight: false,
    badge: null,
    features: [
      'Limited disclosure signals',
      '500 API requests / month',
      'Core event types (Earnings, Contract)',
      'Basic filtering',
      'Community support',
    ],
    cta: 'Request Access',
    ctaClass: 'border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white',
  },
  {
    id: 'Pro' as PlanId,
    name: 'Pro',
    price: '$49',
    period: '/mo',
    desc: 'Quant traders & fintech teams',
    highlight: true,
    badge: 'Recommended',
    features: [
      'Full disclosure signal coverage',
      '10,000 API requests / month',
      'All 8 event types',
      'Win rate & return statistics',
      'Advanced filtering & sorting',
      'Priority updates (< 15 min)',
      'Email support',
    ],
    cta: 'Request Access',
    ctaClass: 'bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-bold',
  },
  {
    id: 'API' as PlanId,
    name: 'API',
    price: '$199',
    period: '/mo',
    desc: 'Funds, data platforms & institutions',
    highlight: false,
    badge: null,
    features: [
      'Full dataset access',
      '100,000 API requests / month',
      'Historical data (15+ years)',
      'Event + probability data',
      'REST API + bulk export',
      'Institutional use rights',
      'Dedicated support channel',
    ],
    cta: 'Request Access',
    ctaClass: 'border border-[#4EA3FF]/50 text-[#4EA3FF] hover:border-[#4EA3FF] hover:bg-[#4EA3FF]/5',
  },
];

export default function Pricing() {
  const [modalPlan, setModalPlan] = useState<PlanId | null>(null);

  return (
    <section id="pricing" className="bg-[#0B0F14] py-20 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Simple Pricing for Market Signals
          </h2>
          <p className="text-gray-400">
            Built for serious users. No hidden fees. Pricing on request — we'll reach out within 2 days.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`
                relative rounded-2xl p-7 flex flex-col gap-6 border transition
                ${p.highlight
                  ? 'bg-[#121821] border-[#00D4A6]/40 ring-1 ring-[#00D4A6]/20'
                  : 'bg-[#121821] border-gray-800 hover:border-gray-600'}
              `}
            >
              {p.badge && (
                <div className="absolute top-4 right-4 text-[10px] font-bold tracking-widest uppercase bg-[#00D4A6]/15 text-[#00D4A6] border border-[#00D4A6]/30 px-2 py-0.5 rounded-full">
                  {p.badge}
                </div>
              )}

              {/* Pricing */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{p.name}</h3>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-extrabold text-white">{p.price}</span>
                  <span className="text-gray-500 text-sm mb-1">{p.period}</span>
                </div>
                <p className="text-xs text-gray-500">{p.desc}</p>
              </div>

              {/* Features */}
              <ul className="flex flex-col gap-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check size={14} className="text-[#00D4A6] shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => setModalPlan(p.id)}
                className={`w-full text-sm py-3 rounded-xl transition text-center ${p.ctaClass}`}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-gray-600 text-sm text-center mt-10">
          Early access. Pricing may change as data coverage expands. No commitment required.
        </p>
      </div>

      {/* Modal */}
      {modalPlan && (
        <PricingModal
          plan={modalPlan}
          onClose={() => setModalPlan(null)}
        />
      )}
    </section>
  );
}
