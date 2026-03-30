'use client';

import Link from 'next/link';
import StatBadge from './ui/StatBadge';
import MarketRadar from './MarketRadar';

export default function Hero() {
  return (
    <section className="bg-[#0B0F14] py-16 md:py-20 px-4 overflow-hidden">
      <div className="max-w-[1200px] mx-auto grid md:grid-cols-2 gap-12 items-center">

        {/* Left */}
        <div>
          <div className="inline-flex items-center gap-2 bg-[#121821] border border-gray-800 rounded-full px-3 py-1.5 text-xs text-gray-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4A6] animate-pulse" />
            LIVE DATA · Updated 14:32 KST
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            Korean Market<br />
            <span className="text-[#00D4A6]">Intelligence API</span>
          </h1>

          <p className="text-gray-400 text-lg mb-8 leading-relaxed">
            Structured corporate events, sector signals, and market flows from Korean listed companies.
          </p>

          <div className="flex flex-wrap gap-2 mb-10">
            <StatBadge value="2,400+" label="Companies" />
            <StatBadge value="4.2M" label="Disclosures" />
            <StatBadge value="18" label="Sectors" />
            <StatBadge value="Since 2010" label="" />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-bold px-6 py-3 rounded-lg transition text-sm"
            >
              Get API Key →
            </Link>
            <Link
              href="/api-docs"
              className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium px-6 py-3 rounded-lg transition text-sm"
            >
              View Documentation
            </Link>
          </div>
        </div>

        {/* Right – Market Radar Widget */}
        <MarketRadar />

      </div>
    </section>
  );
}
