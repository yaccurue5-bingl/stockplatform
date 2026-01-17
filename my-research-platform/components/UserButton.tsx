'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type UserStatus = 'guest' | 'free' | 'premium';

export default function UserButton() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userStatus, setUserStatus] = useState<UserStatus>('guest');
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // 초기 사용자 확인
    checkUser();

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          checkSubscription(session.user.id);
        } else {
          setUser(null);
          setUserStatus('guest');
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUser(user);
        await checkSubscription(user.id);
      } else {
        setUser(null);
        setUserStatus('guest');
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setUser(null);
      setUserStatus('guest');
    } finally {
      setIsLoading(false);
    }
  }

  async function checkSubscription(userId: string) {
    try {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_type, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (subscription?.plan_type === 'premium') {
        setUserStatus('premium');
      } else {
        setUserStatus('free');
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setUserStatus('free');
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserStatus('guest');
      setShowMenu(false);
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center space-x-4">
        <div className="h-10 w-20 bg-gray-800 rounded-lg animate-pulse"></div>
        <div className="w-10 h-10 bg-gray-800 rounded-full animate-pulse"></div>
      </div>
    );
  }

  // Guest (로그인 안됨)
  if (!user) {
    return (
      <div className="flex items-center space-x-4">
        <Link
          href="/signup"
          className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 text-sm transition font-medium"
        >
          Sign Up
        </Link>
        <Link href="/login">
          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 448 512">
              <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/>
            </svg>
          </div>
        </Link>
      </div>
    );
  }

  // Logged in user
  const getStatusBadge = () => {
    if (userStatus === 'premium') {
      return (
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg px-4 py-2 text-sm font-semibold flex items-center">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 576 512">
            <path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/>
          </svg>
          Premium
        </div>
      );
    } else {
      return (
        <div className="bg-gray-700 hover:bg-gray-600 rounded-lg px-4 py-2 text-sm font-medium transition">
          Free
        </div>
      );
    }
  };

  return (
    <div className="flex items-center space-x-4">
      {getStatusBadge()}

      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 448 512">
            <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/>
          </svg>
        </button>

        {showMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />

            {/* Menu */}
            <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-20">
              <div className="px-4 py-3 border-b border-gray-800">
                <p className="text-sm font-medium truncate">{user.email}</p>
                <p className="text-xs text-gray-400 mt-1 capitalize">{userStatus} Plan</p>
              </div>

              <div className="py-2">
                <Link
                  href="/dashboard"
                  className="block px-4 py-2 text-sm hover:bg-gray-800 transition"
                  onClick={() => setShowMenu(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm hover:bg-gray-800 transition"
                  onClick={() => setShowMenu(false)}
                >
                  Settings
                </Link>
                {userStatus === 'free' && (
                  <Link
                    href="/pricing"
                    className="block px-4 py-2 text-sm text-blue-400 hover:bg-gray-800 transition"
                    onClick={() => setShowMenu(false)}
                  >
                    Upgrade to Premium
                  </Link>
                )}
              </div>

              <div className="border-t border-gray-800 py-2">
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
