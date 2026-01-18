'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    // 5초 후 자동으로 랜딩페이지로 이동
    const timer = setTimeout(() => {
      router.push('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-green-600 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-3">
          Email Confirmed!
        </h1>

        {/* Message */}
        <p className="text-gray-400 mb-6">
          Your email has been successfully verified. You can now access all features of K-MarketInsight.
        </p>

        {/* Auto redirect notice */}
        <p className="text-sm text-gray-500 mb-6">
          Redirecting to homepage in 5 seconds...
        </p>

        {/* Buttons */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
          >
            Sign In Now
          </Link>
          <Link
            href="/"
            className="block w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-lg transition"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
