import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - K-MarketInsight',
  description: 'Choose the perfect plan for your Korean stock market research needs',
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
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-400">
            Start free, upgrade when you need more
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Free Plan */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:border-gray-600 transition-colors">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">FREE</h3>
              <div className="text-5xl font-bold text-white mb-2">$0</div>
              <p className="text-gray-400">Forever free</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Latest Disclosures Feed</div>
                  <div className="text-sm text-gray-400">Real-time Korean corporate disclosures</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Basic AI Summaries</div>
                  <div className="text-sm text-gray-400">English translations of key disclosures</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Market Indices Tracking</div>
                  <div className="text-sm text-gray-400">KOSPI, KOSDAQ, USD/KRW</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-gray-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <div>
                  <div className="text-gray-500 font-medium line-through">Full Stock Analysis</div>
                  <div className="text-sm text-gray-600">PRO only</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-gray-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <div>
                  <div className="text-gray-500 font-medium line-through">Advanced AI Insights</div>
                  <div className="text-sm text-gray-600">PRO only</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-gray-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <div>
                  <div className="text-gray-500 font-medium line-through">Financial Report Analysis</div>
                  <div className="text-sm text-gray-600">PRO only</div>
                </div>
              </li>
            </ul>

            <Link
              href="/signup"
              className="block w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg text-center transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* PRO Plan */}
          <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-sm border-2 border-blue-500 rounded-2xl p-8 relative hover:border-blue-400 transition-colors">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
                MOST POPULAR
              </span>
            </div>

            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">PRO</h3>
              <div className="text-5xl font-bold text-white mb-2">$49</div>
              <p className="text-blue-200">per month</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-bold">Everything in FREE</div>
                  <div className="text-sm text-blue-200">Plus premium features</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Detailed Stock Analysis</div>
                  <div className="text-sm text-blue-200">Deep dive into company financials</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Advanced AI Insights</div>
                  <div className="text-sm text-blue-200">Sentiment analysis & predictions</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Financial Report Analysis</div>
                  <div className="text-sm text-blue-200">Quarterly & annual reports</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Historical Data Access</div>
                  <div className="text-sm text-blue-200">5+ years of disclosure history</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-white font-medium">Priority Support</div>
                  <div className="text-sm text-blue-200">Email support within 24h</div>
                </div>
              </li>
            </ul>

            <Link
              href="/signup"
              className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-center transition-colors"
            >
              Start PRO Trial
            </Link>
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
                Can I switch plans anytime?
              </h4>
              <p className="text-gray-400">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any differences.
              </p>
            </div>

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
                Is there a free trial for PRO?
              </h4>
              <p className="text-gray-400">
                Yes! PRO plan comes with a 14-day free trial. No credit card required to start.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <h4 className="text-lg font-bold text-white mb-2">
                What's your refund policy?
              </h4>
              <p className="text-gray-400">
                We offer a 30-day money-back guarantee. If you're not satisfied, contact us for a full refund. See our <Link href="/refund-policy" className="text-blue-400 hover:text-blue-300">Refund Policy</Link> for details.
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
