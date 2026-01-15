import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - K-MarketInsight',
  description: 'Terms and conditions for using K-MarketInsight services',
};

export default function TermsPage() {
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
        <h1 className="text-5xl font-bold text-white mb-4">Terms of Service</h1>
        <p className="text-gray-400 mb-12">Last updated: January 15, 2026</p>

        <div className="prose prose-invert prose-lg max-w-none">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing and using K-MarketInsight ("Service"), you accept and agree to be bound by the terms and provision of this agreement.
              If you do not agree to these Terms of Service, please do not use the Service.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              K-MarketInsight provides AI-powered analysis and English translations of Korean stock market disclosures and financial data.
              The Service includes:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Real-time Korean corporate disclosure feed
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                AI-generated summaries and translations
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Market indices tracking (KOSPI, KOSDAQ)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Stock analysis tools (PRO plan)
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              To access certain features of the Service, you must create an account. You agree to:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Provide accurate and complete information
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Maintain the security of your password
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Accept responsibility for all activities under your account
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Notify us immediately of any unauthorized use
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">4. Payment and Billing</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              For PRO subscription plans:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Subscriptions are billed monthly or annually
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Prices are in USD and may change with 30 days notice
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Automatic renewal unless cancelled before renewal date
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                No refunds for partial months (see Refund Policy)
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">5. Acceptable Use</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              You agree NOT to:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Use the Service for any illegal purpose
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Attempt to gain unauthorized access to any portion of the Service
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Interfere with or disrupt the Service or servers
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Scrape, crawl, or spider the Service
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Resell or redistribute data from the Service
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">6. Intellectual Property</h2>
            <p className="text-gray-300 leading-relaxed">
              The Service and its original content, features, and functionality are owned by K-MarketInsight and are protected by
              international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">7. Disclaimer of Warranties</h2>
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-4">
              <p className="text-yellow-200 font-medium">⚠️ IMPORTANT DISCLAIMER</p>
            </div>
            <p className="text-gray-300 leading-relaxed mb-4">
              The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind. We do not guarantee:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                Accuracy of AI-generated content or translations
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                Completeness or timeliness of data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                Investment advice or recommendations
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                Uninterrupted or error-free service
              </li>
            </ul>
            <p className="text-yellow-200 mt-4 font-medium">
              K-MarketInsight is NOT a registered investment advisor. All information is for research purposes only.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              K-MarketInsight shall not be liable for any indirect, incidental, special, consequential, or punitive damages,
              including loss of profits, data, or other intangible losses resulting from your use of the Service.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">9. Termination</h2>
            <p className="text-gray-300 leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice, for any reason, including breach of these Terms.
              Upon termination, your right to use the Service will immediately cease.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of material changes via email or in-app notification.
              Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">11. Governing Law</h2>
            <p className="text-gray-300 leading-relaxed">
              These Terms shall be governed by the laws of the Republic of Korea, without regard to its conflict of law provisions.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">12. Contact Information</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you have any questions about these Terms, please contact us:
            </p>
            <div className="text-gray-300">
              <p>Email: <a href="mailto:legal@k-marketinsight.com" className="text-blue-400 hover:text-blue-300">legal@k-marketinsight.com</a></p>
              <p className="mt-2 text-sm text-gray-400">(Contact details will be updated after company registration)</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-blue-400 hover:text-blue-300 font-medium">
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
              <Link href="/pricing" className="text-gray-400 hover:text-white text-sm transition-colors">
                Pricing
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
