import Link from 'next/link';
import type { Metadata } from 'next';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Pricing — K-MarketInsight',
  description: 'Transparent pricing for Korean market signal analytics. Free, Developer, and Pro plans.',
};

const PLANS = [
  {
    id:       'free',
    name:     'Free',
    price:    '$0',
    period:   '',
    badge:    null,
    quota:    '50 requests / day',
    color:    'border-gray-700',
    btnClass: 'bg-gray-800 hover:bg-gray-700 text-white',
    btnLabel: 'Get Started',
    btnHref:  '/signup',
    features: [
      'Basic endpoints',
      'Delayed data (T+1)',
      'Public DART filing access',
      'Signal Score (event-type level)',
    ],
    locked: [
      'Real-time signals',
      'Bulk / batch endpoints',
      'Historical backfill',
      'Priority latency',
    ],
  },
  {
    id:       'developer',
    name:     'Developer',
    price:    '$29',
    period:   '/ month',
    badge:    'Most Popular',
    quota:    '8,000 requests / month',
    color:    'border-[#00D4A6]',
    btnClass: 'bg-[#00D4A6] hover:bg-[#00bfa0] text-black',
    btnLabel: 'Subscribe',
    btnHref:  '/signup?plan=developer',
    features: [
      'Real-time signals',
      'All core endpoints',
      '3-day history window',
      'Signal Score + grade',
      'Event impact analytics',
    ],
    locked: [
      'Bulk / batch endpoints',
      'Full historical backfill',
      'Priority latency',
    ],
  },
  {
    id:       'pro',
    name:     'Pro',
    price:    '$99',
    period:   '/ month',
    badge:    null,
    quota:    '80,000 requests / month',
    color:    'border-purple-500',
    btnClass: 'bg-purple-600 hover:bg-purple-500 text-white',
    btnLabel: 'Subscribe',
    btnHref:  '/signup?plan=pro',
    features: [
      'Everything in Developer',
      'Bulk endpoints (batch)',
      'Full historical backfill (30d)',
      'Higher rate limit',
      'Priority latency',
      'Dedicated support',
    ],
    locked: [],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#00D4A6] rounded-md flex items-center justify-center">
              <span className="text-black font-black text-sm">K</span>
            </div>
            <span className="font-bold text-white">K-MarketInsight</span>
          </Link>
          <div className="flex gap-4 items-center">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition">Sign In</Link>
            <Link href="/signup" className="px-4 py-2 bg-[#00D4A6] text-black text-sm font-semibold rounded-full hover:bg-[#00bfa0] transition">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#00D4A6] mb-3">Pricing</p>
        <h1 className="text-4xl sm:text-5xl font-black mb-4">
          Korean Market Signal Analytics
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Data intelligence SaaS for DART filings — transparent, usage-based pricing.
          No hidden fees.
        </p>
      </section>

      {/* Plan Cards */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 ${plan.color} bg-gray-900/50 p-7 flex flex-col`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-[#00D4A6] text-black text-xs font-bold rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">{plan.name}</p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black">{plan.price}</span>
                  {plan.period && <span className="text-gray-500 text-sm mb-1">{plan.period}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-2 font-medium">{plan.quota}</p>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <span className="text-[#00D4A6] mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
                {plan.locked.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 line-through">
                    <span className="text-gray-700 mt-0.5 shrink-0">✗</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.btnHref}
                className={`block w-full py-3 rounded-full text-sm font-semibold text-center transition ${plan.btnClass}`}
              >
                {plan.btnLabel}
              </Link>
            </div>
          ))}
        </div>

        {/* Comparison note */}
        <p className="text-center text-xs text-gray-600 mt-8">
          All prices in USD · Monthly billing · Cancel anytime ·{' '}
          <Link href="/refund-policy" className="text-gray-500 hover:text-gray-300 underline">14-day refund policy</Link>
        </p>

        {/* FAQ */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">FAQ</h2>
          <div className="space-y-4">
            {[
              {
                q: 'What counts as a request?',
                a: 'Each call to any /api/v1/* endpoint (events, sector-signals, market-radar, company, etc.) counts as 1 request.',
              },
              {
                q: 'What happens if I exceed the quota?',
                a: 'API calls return HTTP 429 until the next billing cycle. Free plan resets daily; paid plans reset monthly.',
              },
              {
                q: 'Is there a free trial for paid plans?',
                a: 'We offer a 14-day money-back guarantee. Subscribe, evaluate, and request a full refund within 14 days if it\'s not a fit.',
              },
              {
                q: 'What is "delayed data" on the Free plan?',
                a: 'Free plan data is offset by approximately T+1 business day. Developer and Pro plans deliver signals as they are processed from DART.',
              },
              {
                q: 'What is the data source?',
                a: 'All signal data is derived from public DART (Data Analysis, Retrieval and Transfer) filings. This is informational only and does not constitute investment advice.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                <summary className="text-sm font-semibold text-white cursor-pointer list-none flex justify-between items-center">
                  {q}
                  <span className="text-gray-500 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="text-sm text-gray-400 mt-3 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Legal */}
        <p className="text-center text-xs text-gray-700 mt-12">
          This service provides data analytics only. Content is for informational purposes and does not constitute investment advice.
        </p>
      </section>

      <Footer />
    </div>
  );
}
