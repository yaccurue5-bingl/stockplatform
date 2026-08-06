'use client';

import Link from 'next/link';
import MarketRadar from './MarketRadar';
import { Check } from 'lucide-react';

const points = [
  'Instantly understand Korean disclosures — no language barrier',
  'See Bullish / Bearish signals with clear reasoning',
  'Focus only on events that actually move prices',
];

export default function Hero() {
  return (
    <section className="bg-[#0B0F14] py-16 md:py-24 px-4 overflow-hidden">
      <div className="max-w-[1200px] mx-auto grid md:grid-cols-2 gap-12 items-center">

        {/* Left */}
        <div>
          <div className="inline-flex items-center gap-2 bg-[#121821] border border-gray-800 rounded-full px-3 py-1.5 text-xs text-gray-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4A6] animate-pulse" />
            LIVE · Korean Market Disclosures
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
            Korean Market Disclosures,<br />
            <span className="text-[#00D4A6]">Translated and Scored</span><br />
            in Real Time
          </h1>

          <p className="text-gray-400 text-lg mb-6 leading-relaxed">
            Identify market-moving corporate events before the market fully reacts.
            AI-powered analysis of official Korean filings — built for global investors.
          </p>

          <ul className="flex flex-col gap-2.5 mb-10">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check size={15} className="text-[#00D4A6] shrink-0 mt-0.5" />
                {p}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/disclosures"
              className="bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-bold px-6 py-3 rounded-lg transition text-sm"
            >
              See Live Signals
            </Link>
            <Link
              href="/disclosures"
              className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium px-6 py-3 rounded-lg transition text-sm"
            >
              Explore Latest Disclosures
            </Link>
          </div>
        </div>

        {/* Right – Market Radar Widget */}
        <MarketRadar />

      </div>
    </section>
  );
}
