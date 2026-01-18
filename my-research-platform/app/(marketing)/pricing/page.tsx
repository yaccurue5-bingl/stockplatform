import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - K-MarketInsight',
  description: 'Get instant access to AI-powered market analysis reports',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">K</span>
              </div>
              <h1 className="text-2xl font-bold text-white">K-MarketInsight</h1>
            </Link>
            <div className="flex gap-4">
              <Link href="/login" className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link href="/signup" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-white mb-4">
            AI-Powered Market Analysis
          </h2>
          <p className="text-xl text-gray-400">
            Get instant access to professional-grade insights
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Main Pricing Card */}
          <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-sm border-2 border-blue-500 rounded-2xl p-10 relative hover:border-blue-400 transition-colors">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
                INSTANT ACCESS
              </span>
            </div>

            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-white mb-4">AI Analysis Reports</h3>
              <div className="text-6xl font-bold text-white mb-2">$19.99</div>
              <p className="text-blue-200 text-lg">per month</p>
            </div>

            <div className="bg-blue-950/30 rounded-xl p-6 mb-8">
              <h4 className="text-white font-semibold mb-3">Product Summary</h4>
              <p className="text-blue-100 text-sm leading-relaxed">
                Get instant access to AI-powered market analysis reports designed to help you make faster, smarter decisions.
              </p>
              <ul className="mt-4 space-y-2 text-blue-100 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  AI-driven insights and structured analysis
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  On-demand digital reports
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Instant access after payment
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  No physical delivery required
                </li>
              </ul>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Real-Time Market Analysis</div>
                  <div className="text-sm text-blue-200">AI-powered insights on Korean stocks (KOSPI & KOSDAQ)</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Detailed Stock Analysis</div>
                  <div className="text-sm text-blue-200">Deep dive into company financials and disclosures</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Sentiment Analysis & Predictions</div>
                  <div className="text-sm text-blue-200">AI-driven market sentiment and trend forecasting</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">English Translation</div>
                  <div className="text-sm text-blue-200">Korean disclosures translated to English instantly</div>
                </div>
              </li>
            </ul>

            {/* Refund Notice */}
            <div className="bg-green-900/20 border border-green-600/50 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="text-sm">
                  <div className="text-green-200 font-semibold mb-1">14-Day Money-Back Guarantee</div>
                  <p className="text-green-100">
                    <strong>No questions asked. Full refund within 14 days of purchase.</strong>
                  </p>

                </div>
              </div>
            </div>

            <Link
              href="/signup"
              className="block w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg text-center transition-colors shadow-lg"
            >
              Subscribe - $19.99/month
            </Link>

            <p className="text-center text-sm text-blue-200 mt-4">
              Secure payment processed by Paddle
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h3 className="text-3xl font-bold text-white text-center mb-10">
            Frequently Asked Questions
          </h3>

          <div className="space-y-6">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <h4 className="text-lg font-bold text-white mb-2">
                What payment methods do you accept?
              </h4>
              <p className="text-gray-400">
                We accept all major credit cards (Visa, Mastercard, American Express) through our payment processor Paddle.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <h4 className="text-lg font-bold text-white mb-2">
                Is this a subscription?
              </h4>
              <p className="text-gray-400">
                Yes, this is a monthly subscription at $19.99/month. You can cancel anytime.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <h4 className="text-lg font-bold text-white mb-2">
                What's your refund policy?
              </h4>
              <p className="text-gray-400">
                We offer a 14-day money-back guarantee, no questions asked. You can request a full refund within 14 days of your purchase for any reason. See our <Link href="/refund-policy" className="text-blue-400 hover:text-blue-300 underline">Refund Policy</Link> for full details.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <h4 className="text-lg font-bold text-white mb-2">
                When do I get access after payment?
              </h4>
              <p className="text-gray-400">
                You get immediate access to paid AI analysis content right after successful payment. All content is delivered digitally.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              © 2026 K-MarketInsight. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors">
                Privacy Policy
              </Link>
              <Link href="/refund-policy" className="text-gray-400 hover:text-white text-sm transition-colors">
                Refund Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
