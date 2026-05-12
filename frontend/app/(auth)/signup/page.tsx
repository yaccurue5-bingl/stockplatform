'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp, signInWithGoogle, getSupabase } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace('/');
    });
  }, [router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleGoogleSignup = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      await signInWithGoogle('/');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign up failed');
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setAlreadyExists(false);

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      await signUp(email, password);
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed';
      const isExisting =
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already been registered') ||
        msg.toLowerCase().includes('user already exists');
      const isEmailError =
        msg.toLowerCase().includes('sending confirmation') ||
        msg.toLowerCase().includes('email');

      if (isExisting) {
        setAlreadyExists(true);
      } else if (isEmailError) {
        setErrorMessage('Failed to send confirmation email. Try again or use a Gmail address.');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Account already exists ── */
  if (alreadyExists) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-5">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-amber-100">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Account already exists</h2>
            <p className="mt-2 text-sm text-gray-500">
              <strong>{email}</strong> is already registered.
            </p>
          </div>
          <div className="space-y-2">
            <Link href="/login"
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition">
              Sign in →
            </Link>
            <Link href="/forgot-password"
              className="block w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition">
              Forgot password?
            </Link>
          </div>
          <button onClick={() => { setAlreadyExists(false); setEmail(''); }}
            className="text-xs text-gray-400 hover:text-gray-600">
            ← Try a different email
          </button>
        </div>
      </div>
    );
  }

  /* ── Success (email confirmation sent) ── */
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Check your inbox</h2>
          <p className="text-sm text-gray-500">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <p className="text-xs text-gray-400">Didn&apos;t receive it? Check your spam folder.</p>
          <Link href="/" className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-500 font-medium">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  /* ── Main signup form ── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-white font-black text-xl">K</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">Start analyzing Korean stocks today</p>
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3.5">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-3">

          {/* Google — Primary */}
          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4
                       bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50
                       rounded-xl font-medium text-gray-700 text-sm
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Email form — toggle */}
          {!showEmailForm ? (
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full py-3 px-4 text-sm font-medium text-gray-600
                         border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Continue with email
            </button>
          ) : (
            <form onSubmit={handleEmailSignup} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent transition outline-none"
                placeholder="Email address"
                autoFocus
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent transition outline-none"
                placeholder="Password (min. 6 characters)"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm
                           font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        {/* Sign in link */}
        <p className="mt-5 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>

        {/* Terms + Digest notice */}
        <p className="mt-3 text-center text-xs text-gray-400 leading-relaxed px-2">
          By signing up, you agree to our{' '}
          <a href="/terms" className="underline hover:text-gray-600">Terms</a> and{' '}
          <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>.
          You&apos;ll receive our daily market digest — unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}
