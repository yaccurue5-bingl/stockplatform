'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const navItems = [
  { label: 'Datasets', href: '/datasets' },
  { label: 'API Docs', href: '/api-docs'  },
  { label: 'Pricing',  href: '/#pricing'  },
  { label: 'Company',  href: '#'          },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#0B0F14]/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-[1200px] mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-[#00D4A6] flex items-center justify-center">
            <span className="text-[#0B0F14] font-bold text-sm">K</span>
          </div>
          <span className="font-semibold text-white text-sm tracking-tight">K-Market Insight</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-300 hover:text-white transition px-3 py-1.5"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] px-4 py-2 rounded-lg transition flex items-center gap-1.5"
          >
            GET API KEY →
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800 bg-[#0B0F14] px-4 py-4 flex flex-col gap-3">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm text-gray-400 hover:text-white transition py-1"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="flex gap-3 pt-2">
            <Link href="/login" className="text-sm text-gray-300 hover:text-white px-3 py-2">Login</Link>
            <Link
              href="/login"
              className="text-sm font-semibold bg-[#00D4A6] text-[#0B0F14] px-4 py-2 rounded-lg"
            >
              GET API KEY
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
