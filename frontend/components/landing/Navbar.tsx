'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, LogOut, LayoutDashboard } from 'lucide-react';
import { getSupabase, signOut } from '@/lib/supabase/client';

const navItems = [
  { label: 'Datasets',   href: '/datasets'    },
  { label: 'API Docs',   href: '/api-docs'    },
  { label: 'API Access', href: '/api-access'  },
];

type PlanType = 'free' | 'developer' | 'pro';

const PLAN_CONFIG: Record<PlanType, { label: string; ring: string; text: string; bg: string }> = {
  free:      { label: 'FREE', ring: 'border-gray-500',  text: 'text-gray-400',   bg: 'bg-gray-500' },
  developer: { label: 'DEV',  ring: 'border-blue-400',  text: 'text-blue-400',   bg: 'bg-blue-400' },
  pro:       { label: 'PRO',  ring: 'border-[#00D4A6]', text: 'text-[#00D4A6]',  bg: 'bg-[#00D4A6]' },
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userPlan, setUserPlan] = useState<PlanType>('free');
  const [userEmail, setUserEmail] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 같은 페이지(/)에서 해시 앵커 클릭 시 부드러운 스크롤, 다른 페이지에서는 navigate
  const handleHashNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('/#')) return;
    const id = href.slice(2);
    if (pathname === '/') {
      e.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      setMobileOpen(false);
    }
    // 다른 페이지에서는 Next.js가 /#id로 정상 이동 처리
  };

  // 로고 클릭: 이미 홈(/)이면 최상단으로 스크롤, 아니면 /로 navigate
  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const fetchUserPlan = async (userId: string) => {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('users')
        .select('plan')
        .eq('id', userId)
        .maybeSingle();
      const row = data as { plan?: string | null } | null;
      const raw = row?.plan ?? 'free';
      const plan: PlanType = raw === 'pro' ? 'pro' : raw === 'developer' ? 'developer' : 'free';
      setUserPlan(plan);
    } catch {
      setUserPlan('free');
    }
  };

  useEffect(() => {
    const supabase = getSupabase();

    // 초기 세션 확인
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setIsLoggedIn(true);
        setUserEmail(data.user.email ?? '');
        fetchUserPlan(data.user.id);
      }
    });

    // 로그인/아웃 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
      if (session?.user) {
        setUserEmail(session.user.email ?? '');
        fetchUserPlan(session.user.id);
      } else {
        setUserPlan('free');
        setUserEmail('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {}
    setDropdownOpen(false);
    router.push('/');
  };

  const plan = PLAN_CONFIG[userPlan];

  return (
    <nav className="sticky top-0 z-50 bg-[#0B0F14]/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-[1200px] mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2 shrink-0">
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
              onClick={(e) => handleHashNav(e, item.href)}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isLoggedIn ? (
            /* 로그인 상태 */
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`flex items-center gap-2 text-sm transition px-3 py-1.5 rounded-lg border hover:border-gray-500 ${plan.ring} hover:opacity-90`}
              >
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide text-[#0B0F14] shrink-0 ${plan.bg}`}>
                  {plan.label}
                </span>
                <span className="font-medium text-xs text-gray-300 max-w-[80px] truncate">
                  {userEmail ? userEmail.split('@')[0] : '···'}
                </span>
                <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 드롭다운 메뉴 */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-[#121821] border border-gray-700 rounded-xl shadow-lg overflow-hidden z-50">
                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
                  >
                    <LayoutDashboard size={14} />
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* 비로그인 상태 */
            <>
              <Link
                href="/login"
                className="text-sm text-gray-300 hover:text-white transition px-3 py-1.5"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="text-sm font-semibold bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] px-4 py-2 rounded-lg transition flex items-center gap-1.5"
              >
                GET API KEY →
              </Link>
            </>
          )}
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
              onClick={(e) => { handleHashNav(e, item.href); setMobileOpen(false); }}
            >
              {item.label}
            </Link>
          ))}
          <div className="flex gap-3 pt-2">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 text-sm px-3 py-2 border rounded-lg ${plan.ring}`}
                >
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-black text-[#0B0F14] shrink-0 ${plan.bg}`}>
                    {plan.label}
                  </span>
                  <span className="text-xs text-gray-300 max-w-[70px] truncate">
                    {userEmail ? userEmail.split('@')[0] : '···'}
                  </span>
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="text-sm text-gray-300 hover:text-white px-3 py-2"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-400 hover:text-red-300 px-3 py-2"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-300 hover:text-white px-3 py-2">Login</Link>
                <Link
                  href="/signup"
                  className="text-sm font-semibold bg-[#00D4A6] text-[#0B0F14] px-4 py-2 rounded-lg"
                >
                  GET API KEY
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
