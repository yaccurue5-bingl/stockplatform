'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function UserButton() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [supabase, setSupabase] = useState<any>(null);
  const [initError, setInitError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hasEnvVars =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!hasEnvVars) {
      setInitError(true);
      setIsLoading(false);
      return;
    }

    initializeSupabase();
  }, []);

  async function initializeSupabase() {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const client = createClient();
      setSupabase(client);

      const { data: { user } } = await client.auth.getUser();
      setUser(user ?? null);
      setIsLoading(false);

      const { data: { subscription } } = client.auth.onAuthStateChange(
        (_event: any, session: any) => {
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      );

      return () => { subscription.unsubscribe(); };
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      setInitError(true);
      setIsLoading(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      setUser(null);
      setShowMenu(false);
      window.location.href = '/';
    } catch {
      window.location.href = '/';
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

  // Guest
  if (!user || initError) {
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

  // Logged in
  return (
    <div className="flex items-center space-x-4">
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
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-20">
              <div className="px-4 py-3 border-b border-gray-800">
                <p className="text-sm font-medium truncate">{user.email}</p>
                <p className="text-xs text-gray-400 mt-1">Member</p>
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
