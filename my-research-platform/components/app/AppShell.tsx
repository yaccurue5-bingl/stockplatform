'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Key, BarChart2, Database, BookOpen, LogOut } from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Key,             label: 'API Key',   href: '/api-key' },
  { icon: BarChart2,       label: 'Usage',     href: '/usage' },
];

const publicItems = [
  { icon: Database,  label: 'Datasets', href: '/datasets' },
  { icon: BookOpen,  label: 'API Docs', href: '/api-docs' },
];

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AppShell({ children, title, subtitle }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#0B0F14]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#0d1117] border-r border-gray-800 flex flex-col py-6 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 px-2 mb-8">
          <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-sm bg-[#00D4A6] text-[#0B0F14]">K</div>
          <span className="font-semibold text-white text-sm">K-Market Insight</span>
        </Link>

        {/* App nav */}
        <p className="text-[10px] text-gray-600 uppercase tracking-widest px-3 mb-2">App</p>
        <div className="flex flex-col gap-1 mb-6">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-[#00D4A6]/10 text-[#00D4A6]'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="border-t border-gray-800 mb-4" />
        <p className="text-[10px] text-gray-600 uppercase tracking-widest px-3 mb-2">Explore</p>
        <div className="flex flex-col gap-1">
          {publicItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition"
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </div>

        {/* User */}
        <div className="mt-auto">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-gray-900/60 border border-gray-800">
            <div className="w-7 h-7 rounded-full bg-[#00D4A6]/20 flex items-center justify-center text-xs font-bold text-[#00D4A6]">S</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">smile</p>
              <p className="text-[10px] text-gray-500">Developer Plan</p>
            </div>
            <Link href="/login" className="text-gray-600 hover:text-gray-400 transition">
              <LogOut size={13} />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-auto">
        {/* Top bar */}
        <header className="border-b border-gray-800 px-8 py-5 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-white">{title}</h1>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <Link
            href="/api-docs"
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#00D4A6] text-[#0B0F14] hover:bg-[#00bfa0] transition"
          >
            View API Docs →
          </Link>
        </header>

        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
