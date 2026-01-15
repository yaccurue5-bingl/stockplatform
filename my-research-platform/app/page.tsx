import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'K-MarketInsight - Korean Stock Market Intelligence for Global Investors',
  description: 'AI-powered English analysis of Korean stock market (KOSPI/KOSDAQ). Get real-time disclosures, market insights, and AI summaries translated from Korean.',
  keywords: ['Korean stocks', 'KOSPI', 'KOSDAQ', 'stock analysis', 'AI translation', 'Korean market', 'stock research', 'DART', 'KRX'],
  openGraph: {
    title: 'K-MarketInsight - Korean Stock Market Intelligence',
    description: 'AI-powered English analysis of Korean stock market disclosures',
    type: 'website',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">K</span>
              </div>
              <h1 className="text-2xl font-bold text-white">K-MarketInsight</h1>
            </div>
            <div className="flex gap-4">
              <Link
                href="/login"
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-white mb-6">
            Korean Stock Market Intelligence
            <br />
            <span className="text-blue-400">For Global Investors</span>
          </h2>
          <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
            AI-powered English analysis of Korean stock disclosures (KOSPI/KOSDAQ).
            Break the language barrier and make informed investment decisions.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg"
            >
              Get Started Free
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors text-lg"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Market Indices */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-gray-400 text-sm font-medium mb-2">KOSPI</div>
            <div className="text-3xl font-bold text-white mb-1">2,520.15</div>
            <div className="text-green-400 text-sm font-medium">+15.32 (+0.61%)</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-gray-400 text-sm font-medium mb-2">KOSDAQ</div>
            <div className="text-3xl font-bold text-white mb-1">745.80</div>
            <div className="text-green-400 text-sm font-medium">+8.45 (+1.15%)</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <div className="text-gray-400 text-sm font-medium mb-2">USD/KRW</div>
            <div className="text-3xl font-bold text-white mb-1">1,329.50</div>
            <div className="text-red-400 text-sm font-medium">-5.30 (-0.40%)</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-gray-900/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-white mb-4">
              Why K-MarketInsight?
            </h3>
            <p className="text-xl text-gray-400">
              Everything you need to analyze Korean stocks in English
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Real-Time AI Translation</h4>
              <p className="text-gray-400">
                Get instant English summaries of Korean corporate disclosures from DART.
                AI-powered analysis highlights key insights and risks.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
              <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Comprehensive Market Data</h4>
              <p className="text-gray-400">
                Access real-time stock prices, financial reports, and market indices.
                All KRX data integrated in one platform.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Verified Data Sources</h4>
              <p className="text-gray-400">
                Official data from DART (Korean SEC) and KRX.
                Reliable, accurate, and compliant with Korean regulations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Disclosures Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h3 className="text-4xl font-bold text-white mb-4">
            Latest Corporate Disclosures
          </h3>
          <p className="text-xl text-gray-400">
            Stay updated with real-time Korean stock market news
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sample Disclosure Cards */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-lg font-bold text-white">Samsung Electronics</h4>
                <p className="text-sm text-gray-400">005930</p>
              </div>
              <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-medium rounded-full">
                Q4 Earnings
              </span>
            </div>
            <p className="text-gray-300 mb-4">
              AI Summary: Strong Q4 performance with semiconductor division showing 35% YoY growth.
              Operating profit exceeded analyst expectations.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">2 hours ago</span>
              <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
                Read Analysis →
              </Link>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-lg font-bold text-white">Hyundai Motor</h4>
                <p className="text-sm text-gray-400">005380</p>
              </div>
              <span className="px-3 py-1 bg-green-600/20 text-green-400 text-xs font-medium rounded-full">
                Major Contract
              </span>
            </div>
            <p className="text-gray-300 mb-4">
              AI Summary: Secured $2.5B EV battery supply contract with US manufacturer.
              Expected to boost 2026 revenue by 12%.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">5 hours ago</span>
              <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
                Read Analysis →
              </Link>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-lg font-bold text-white">NAVER Corporation</h4>
                <p className="text-sm text-gray-400">035420</p>
              </div>
              <span className="px-3 py-1 bg-purple-600/20 text-purple-400 text-xs font-medium rounded-full">
                Product Launch
              </span>
            </div>
            <p className="text-gray-300 mb-4">
              AI Summary: Launched AI-powered search assistant targeting global markets.
              Partnership with major cloud providers announced.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">1 day ago</span>
              <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
                Read Analysis →
              </Link>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-lg font-bold text-white">SK Hynix</h4>
                <p className="text-sm text-gray-400">000660</p>
              </div>
              <span className="px-3 py-1 bg-yellow-600/20 text-yellow-400 text-xs font-medium rounded-full">
                Stock Split
              </span>
            </div>
            <p className="text-gray-300 mb-4">
              AI Summary: Board approved 5-for-1 stock split to improve liquidity.
              Expected completion by March 2026.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">1 day ago</span>
              <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
                Read Analysis →
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/signup"
            className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Access All Disclosures - Sign Up Free
          </Link>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-gray-900/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h3>
            <p className="text-xl text-gray-400">
              Start free, upgrade when you need more
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
              <div className="text-center mb-6">
                <h4 className="text-2xl font-bold text-white mb-2">FREE</h4>
                <div className="text-4xl font-bold text-white mb-2">$0</div>
                <p className="text-gray-400">Forever free</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Latest disclosures feed</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Basic AI summaries</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Market indices tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-gray-500">Full stock analysis</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-gray-500">Advanced AI insights</span>
                </li>
              </ul>
              <Link
                href="/signup"
                className="block w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg text-center transition-colors"
              >
                Get Started
              </Link>
            </div>

            {/* PRO Plan */}
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-sm border-2 border-blue-500 rounded-xl p-8 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
                  MOST POPULAR
                </span>
              </div>
              <div className="text-center mb-6">
                <h4 className="text-2xl font-bold text-white mb-2">PRO</h4>
                <div className="text-4xl font-bold text-white mb-2">$49</div>
                <p className="text-gray-400">per month</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white font-medium">Everything in FREE</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white">Detailed stock analysis</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white">Advanced AI insights</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white">Financial report analysis</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white">Priority support</span>
                </li>
              </ul>
              <Link
                href="/signup"
                className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-center transition-colors"
              >
                Start PRO Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-center">
          <h3 className="text-4xl font-bold text-white mb-4">
            Ready to Unlock Korean Market Insights?
          </h3>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join global investors analyzing Korean stocks with AI-powered intelligence.
            Start your free account today.
          </p>
          <Link
            href="/signup"
            className="inline-block px-10 py-4 bg-white hover:bg-gray-100 text-blue-600 font-bold rounded-lg transition-colors text-lg"
          >
            Get Started Free - No Credit Card Required
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">K</span>
                </div>
                <span className="text-white font-bold text-lg">K-MarketInsight</span>
              </div>
              <p className="text-gray-400 text-sm">
                Korean Stock Market Intelligence for Global Investors
              </p>
            </div>

            <div>
              <h5 className="text-white font-semibold mb-4">Product</h5>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white text-sm transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-gray-400 hover:text-white text-sm transition-colors">Pricing</a></li>
                <li><Link href="/signup" className="text-gray-400 hover:text-white text-sm transition-colors">Sign Up</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="text-white font-semibold mb-4">Resources</h5>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Documentation</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">API</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Support</a></li>
              </ul>
            </div>

            <div>
              <h5 className="text-white font-semibold mb-4">Legal</h5>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              © 2026 K-MarketInsight. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
