'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MarketIndices from '@/components/MarketIndices';
import LatestDisclosures from '@/components/LatestDisclosures';
import UserButton from '@/components/UserButton';
import WaitlistModal from '@/components/WaitlistModal';
import SearchDropdown from '@/components/SearchDropdown';
import { isSuperAdmin } from '@/lib/constants';
import { getSupabase, startSessionTimer, clearSessionTimer } from '@/lib/supabase/client';

export default function LandingPage() {
  const router = useRouter();
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const isSuper = isSuperAdmin(userEmail);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 검색 결과 선택 시 처리
  const handleSearchSelect = (stockCode: string) => {
    if (isSuper) {
      router.push(`/disclosures?stock=${stockCode}`);
    } else {
      setIsWaitlistOpen(true);
    }
  };

  // 키보드 단축키 (Cmd+K / Ctrl+K) - 검색 입력창에 포커스
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // SearchDropdown 내부의 input에 포커스
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();

    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        // 30분 세션 타이머 시작
        startSessionTimer(() => {
          setUserEmail(null);
          window.location.href = '/login';
        });
      }
    });

    // 인증 상태 변화 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        startSessionTimer(() => {
          setUserEmail(null);
          window.location.href = '/login';
        });
      } else {
        setUserEmail(null);
        clearSessionTimer();
      }
    });

    return () => {
      subscription.unsubscribe();
      clearSessionTimer();
    };
  }, []);

  return (
    <div className="bg-gray-950 text-white font-sans min-h-screen">
      {/* Modals */}
      <WaitlistModal isOpen={isWaitlistOpen} onClose={() => setIsWaitlistOpen(false)} />

      {/* Fixed Sidebar - Hidden on mobile */}
      <div className="hidden md:flex fixed left-0 top-0 h-full w-16 bg-black border-r border-gray-800 flex-col items-center py-6 z-50">
        <Link href="/" className="mb-12">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
            K
          </div>
        </Link>

        <div className="flex-1 flex flex-col items-center space-y-6">
          <Link href="/" className="text-white bg-blue-600 p-3 rounded-lg">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 576 512">
              <path d="M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c0 2.7-.2 5.4-.5 8.1V472c0 22.1-17.9 40-40 40H456c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1H416 392c-22.1 0-40-17.9-40-40V448 384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v64 24c0 22.1-17.9 40-40 40H160 128.1c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2H104c-22.1 0-40-17.9-40-40V360c0-.9 0-1.9 .1-2.8V287.6H32c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z"/>
            </svg>
          </Link>

          <button onClick={() => setIsWaitlistOpen(true)} className="text-gray-500 hover:text-white p-3 rounded-lg transition">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 512 512">
              <path d="M64 64c0-17.7-14.3-32-32-32S0 46.3 0 64V400c0 44.2 35.8 80 80 80H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H80c-8.8 0-16-7.2-16-16V64zm406.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L320 210.7l-57.4-57.4c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L240 221.3l57.4 57.4c12.5 12.5 32.8 12.5 45.3 0l128-128z"/>
            </svg>
          </button>

          <button onClick={() => setIsWaitlistOpen(true)} className="text-gray-500 hover:text-white p-3 rounded-lg transition">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 384 512">
              <path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM112 256H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/>
            </svg>
          </button>

          <button onClick={() => setIsWaitlistOpen(true)} className="text-gray-500 hover:text-white p-3 rounded-lg transition">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 448 512">
              <path d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"/>
            </svg>
          </button>

          <button onClick={() => setIsWaitlistOpen(true)} className="text-gray-500 hover:text-white p-3 rounded-lg transition">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 384 512">
              <path d="M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z"/>
            </svg>
          </button>
        </div>

        <button onClick={() => setIsWaitlistOpen(true)} className="text-gray-500 hover:text-white p-3 rounded-lg transition">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 512 512">
            <path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/>
          </svg>
        </button>
      </div>

      {/* Header */}
      <header className="md:ml-16 bg-black border-b border-gray-800 px-4 md:px-8 py-5">
        <div className="flex justify-between items-center gap-2 md:gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-xl md:text-2xl font-semibold mb-1">K-Market Insight</h1>
            <p className="hidden md:block text-sm text-gray-400">Korean Stock Market Intelligence for Global Investors</p>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {/* 인라인 검색 드롭다운 */}
            <div className="hidden sm:block w-32 sm:w-48 md:w-80">
              <SearchDropdown
                onSelectStock={handleSearchSelect}
                isSuperUser={isSuper}
                placeholder="Search... ⌘K"
              />
            </div>
            <button className="hidden sm:flex bg-gray-900 hover:bg-gray-800 rounded-lg px-3 md:px-4 py-2 text-xs md:text-sm transition items-center">
              <svg className="w-4 h-4 mr-1 md:mr-2" fill="currentColor" viewBox="0 0 512 512">
                <path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/>
              </svg>
              EN
            </button>
            <UserButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="md:ml-16">
        {/* Hero Banner */}
        <section className="bg-gradient-to-r from-blue-900 to-blue-700 px-4 md:px-8 py-8 md:py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
              <div className="flex-1 w-full">
                <div className="inline-block bg-blue-800 bg-opacity-50 rounded-full px-4 py-1 text-xs font-medium mb-4">
                  <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                  COMING SOON - Beta
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-3">Real-time Korean Market Disclosures</h2>
                <p className="text-blue-100 text-base md:text-lg mb-6">AI-powered analysis and translation of KOSPI & KOSDAQ public announcements</p>
                <div className="overflow-x-auto">
                  <MarketIndices />
                </div>
              </div>
              <div className="w-full md:w-96 h-48 bg-blue-800 bg-opacity-30 rounded-xl p-4">
                <div className="text-xs text-blue-200 mb-2">Today&apos;s Disclosure Volume</div>
                <div className="flex items-end justify-between h-32">
                  <div className="w-8 bg-blue-500 rounded-t" style={{height: '45%'}}></div>
                  <div className="w-8 bg-blue-500 rounded-t" style={{height: '62%'}}></div>
                  <div className="w-8 bg-blue-500 rounded-t" style={{height: '78%'}}></div>
                  <div className="w-8 bg-blue-500 rounded-t" style={{height: '55%'}}></div>
                  <div className="w-8 bg-blue-500 rounded-t" style={{height: '88%'}}></div>
                  <div className="w-8 bg-blue-600 rounded-t" style={{height: '100%'}}></div>
                  <div className="w-8 bg-blue-400 rounded-t opacity-50" style={{height: '35%'}}></div>
                </div>
                <div className="flex justify-between text-xs text-blue-300 mt-2">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span className="font-bold">Today</span>
                  <span className="opacity-50">Avg</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Latest Disclosures */}
        <section className="px-4 md:px-8 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-xl font-semibold mb-1">Latest Disclosures</h3>
                <p className="text-sm text-gray-400">AI-analyzed and translated in real-time</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto">
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">All</button>
                <button className="bg-gray-900 text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition whitespace-nowrap">Material</button>
                <button className="bg-gray-900 text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition whitespace-nowrap">Financial</button>
                <button className="bg-gray-900 text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition whitespace-nowrap">Corporate</button>
              </div>
            </div>

            <LatestDisclosures
              onCardClick={() => setIsWaitlistOpen(true)}
              isSuperUser={isSuper}
            />

            {/* View More */}
            <div className="text-center mt-8">
              {isSuper ? (
                <Link
                  href="/disclosures"
                  className="inline-block bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-600 rounded-lg px-8 py-3 text-sm font-medium transition"
                >
                  View All Disclosures →
                </Link>
              ) : (
                <button
                  onClick={() => setIsWaitlistOpen(true)}
                  className="inline-block bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-600 rounded-lg px-8 py-3 text-sm font-medium transition"
                >
                  View All Disclosures →
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 md:px-8 py-12 md:py-16 bg-gray-900">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">Why K-MarketInsight?</h3>
              <p className="text-gray-400">Everything you need to analyze Korean stocks in English</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-gray-950 border border-gray-800 rounded-xl p-6">
                <div className="w-12 h-12 bg-blue-600 bg-opacity-20 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold mb-2">Real-Time AI Translation</h4>
                <p className="text-gray-400 text-sm">
                  Get instant English summaries of Korean corporate disclosures from DART. AI-powered analysis highlights key insights.
                </p>
              </div>

              <div className="bg-gray-950 border border-gray-800 rounded-xl p-6">
                <div className="w-12 h-12 bg-green-600 bg-opacity-20 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold mb-2">Comprehensive Market Data</h4>
                <p className="text-gray-400 text-sm">
                  Access real-time stock prices, financial reports, and market indices. All DART data integrated in one platform.
                </p>
              </div>

              <div className="bg-gray-950 border border-gray-800 rounded-xl p-6">
                <div className="w-12 h-12 bg-purple-600 bg-opacity-20 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold mb-2">Verified Data Sources</h4>
                <p className="text-gray-400 text-sm">
                  Official data from DART (Korean SEC). Reliable, accurate, and compliant with Korean regulations.
                </p>
              </div>
            </div>

            <div className="text-center mt-12">
              <button
                onClick={() => setIsWaitlistOpen(true)}
                className="inline-block bg-blue-600 hover:bg-blue-700 rounded-lg px-8 py-3 font-medium transition"
              >
                Join Waitlist for Early Access
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 md:px-8 py-12 border-t border-gray-800">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Customer Support */}
              <div>
                <h3 className="text-white font-semibold mb-4">Customer Support</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-gray-400 mb-1">Service Inquiries</div>
                    <a
                      href="mailto:support@k-marketinsight.com"
                      className="text-blue-400 hover:text-blue-300 transition inline-flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      support@k-marketinsight.com
                    </a>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Billing & Refunds</div>
                    <div className="text-gray-300 text-sm mb-1">
                      For payment-related issues or refund requests, please visit:
                    </div>
                    <a
                      href="https://www.paddle.com/help"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition inline-flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Paddle Help Center
                    </a>
                  </div>
                </div>
              </div>

              {/* Legal Links */}
              <div>
                <h3 className="text-white font-semibold mb-4">Legal</h3>
                <div className="flex flex-col space-y-2 text-sm">
                  <Link href="/terms" className="text-gray-400 hover:text-white transition">Terms of Service</Link>
                  <Link href="/privacy" className="text-gray-400 hover:text-white transition">Privacy Policy</Link>
                  <Link href="/refund-policy" className="text-gray-400 hover:text-white transition">Refund Policy</Link>
                  <Link href="/pricing" className="text-gray-400 hover:text-white transition">Pricing</Link>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="pt-8 border-t border-gray-800">
              <div className="text-sm text-gray-400 text-center">
                © 2026 K-MarketInsight. All rights reserved.
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
