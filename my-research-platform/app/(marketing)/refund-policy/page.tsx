import Link from 'next/link';
import type { Metadata } from 'next';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Refund Policy - K-MarketInsight',
  description: '14-day unconditional refund policy for initial subscriptions',
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">K</span>
            </div>
            <h1 className="text-2xl font-bold text-white">K-MarketInsight</h1>
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h1 className="text-5xl font-bold text-white mb-4">Refund Policy</h1>
        <p className="text-gray-400 mb-12">Last updated: 2026-01-18</p>

        <div className="bg-blue-900/20 border-2 border-blue-600/50 rounded-xl p-6 mb-12">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-blue-200 font-bold mb-2">14-Day Money-Back Guarantee</h3>
              <p className="text-blue-100 text-sm">
                We offer a 14-day unconditional refund on all initial subscription purchases to ensure your complete satisfaction.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">1. Eligibility</h2>
            <p className="text-gray-300 leading-relaxed">
              You may request a full refund within <strong>14 days of your initial purchase</strong>, for any reason, without conditions. We believe in the value of our insights and want you to explore them with confidence.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">2. How to Request a Refund</h2>
            <p className="text-gray-300 leading-relaxed mb-6">
              All payments and refunds are handled by <strong>Paddle</strong>, our authorized payment processor. To request a refund, please contact Paddle directly:
            </p>
            <a
              href="https://www.paddle.com/help"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium text-lg mb-6 bg-blue-900/30 px-6 py-3 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Visit Paddle Help Center
            </a>
            <div className="space-y-2 text-gray-400 text-sm">
              <p>
                ✓ Paddle processes all refund requests within 5-10 business days
              </p>
              <p>
                ✓ Refunds are issued to your original payment method
              </p>
              <p>
                ✓ You can also reach Paddle support directly through their help center for immediate assistance
              </p>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">3. Subscription Renewals</h2>
            <p className="text-gray-300 leading-relaxed">
              Refunds generally apply only to the <strong>initial purchase</strong> and do not automatically apply to renewals, unless required by applicable law in your jurisdiction.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">4. Processing Time</h2>
            <p className="text-gray-300 leading-relaxed">
              Approved refunds are typically processed within a few business days. Please allow 5-10 business days for the credit to appear on your statement, depending on your financial institution.
            </p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
