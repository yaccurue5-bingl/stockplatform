import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - K-MarketInsight',
  description: 'How we collect, use, and protect your information',
};

export default function PrivacyPage() {
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
        <h1 className="text-5xl font-bold text-white mb-4">Privacy Policy</h1>
        <p className="text-gray-400 mb-8">Last updated: 2026-01-18</p>
        <p className="text-gray-300 text-lg mb-12">
          K-MarketInsight respects your privacy and is committed to protecting your personal data.
        </p>

        <div className="space-y-8">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
            <p className="text-gray-300 mb-4">We may collect:</p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2"><span className="text-blue-400">•</span> Email address</li>
              <li className="flex items-start gap-2"><span className="text-blue-400">•</span> Account login information</li>
              <li className="flex items-start gap-2"><span className="text-blue-400">•</span> Subscription and payment status (processed by Paddle)</li>
              <li className="flex items-start gap-2"><span className="text-blue-400">•</span> Usage data related to service functionality</li>
            </ul>
            <p className="text-gray-400 mt-4 text-sm">We do not collect sensitive financial information such as credit card numbers.</p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-300 mb-4">We use your data to:</p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2"><span className="text-blue-400">•</span> Provide and maintain the Service</li>
              <li className="flex items-start gap-2"><span className="text-blue-400">•</span> Manage user accounts and subscriptions</li>
              <li className="flex items-start gap-2"><span className="text-blue-400">•</span> Communicate important service-related information</li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">3. Payment Processing</h2>
            <p className="text-gray-300 leading-relaxed">
              All payments are securely processed by <strong>Paddle</strong>, acting as Merchant of Record. We do not store payment details on our servers.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Sources</h2>
            <p className="text-gray-300 mb-4">Market and disclosure data are sourced from:</p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <a href="https://dart.fss.or.kr" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 underline">DART (https://dart.fss.or.kr)</a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <a href="https://global.krx.co.kr" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 underline">KRX (https://global.krx.co.kr)</a>
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">5. Data Retention</h2>
            <p className="text-gray-300 leading-relaxed">
              We retain personal data only as long as necessary to provide the Service or comply with legal obligations.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">6. Your Rights</h2>
            <p className="text-gray-300 mb-4">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2"><span className="text-blue-400">•</span> Access your personal data</li>
              <li className="flex items-start gap-2"><span className="text-blue-400">•</span> Request correction or deletion</li>
              <li className="flex items-start gap-2"><span className="text-blue-400">•</span> Object to processing</li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">7. Data Security</h2>
            <p className="text-gray-300 leading-relaxed">
              We implement reasonable technical and organizational measures to protect your data using industry-standard encryption and security protocols.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">8. Contact</h2>
            <p className="text-gray-300 leading-relaxed">
              For privacy-related inquiries, please contact us at:
              <br />
              <a href="mailto:support@k-marketinsight.com" className="text-blue-400 hover:text-blue-300 underline">
                support@k-marketinsight.com
              </a>
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
              <Link href="/privacy" className="text-white text-sm font-medium">
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
