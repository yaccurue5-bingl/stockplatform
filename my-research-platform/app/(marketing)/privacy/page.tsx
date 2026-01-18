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
        <p className="text-gray-400 mb-12">Last updated: January 16, 2026</p>

        <div className="space-y-8">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">1. Data Collection</h2>
            <p className="text-gray-300 leading-relaxed">
              We collect only the information necessary to provide our service, including email address and payment confirmation data.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">2. Payment Information</h2>
            <p className="text-gray-300 leading-relaxed">
              All payment information is handled directly by Paddle, our authorized payment processor. We do not store or process credit card details on our servers.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">3. Data Usage</h2>
            <p className="text-gray-300 leading-relaxed">
              User data is used solely for service delivery, customer support, and essential communications. We do not sell or share your personal information with third parties for marketing purposes.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">4. Cookies and Tracking</h2>
            <p className="text-gray-300 leading-relaxed">
              We use essential cookies to maintain your session and provide a better user experience. We do not use third-party advertising cookies.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">5. Data Security</h2>
            <p className="text-gray-300 leading-relaxed">
              We implement industry-standard security measures to protect your personal information. All data transmission is encrypted using SSL/TLS protocols.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">6. Data Retention</h2>
            <p className="text-gray-300 leading-relaxed">
              We retain your personal information only for as long as necessary to provide our services and comply with legal obligations.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">7. Your Rights</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Access your personal data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Request correction of inaccurate data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Request deletion of your data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Object to data processing
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Request data portability
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">8. Third-Party Services</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We use the following third-party services:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Paddle</strong> - Payment processing
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Supabase</strong> - Database and authentication
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Vercel</strong> - Hosting and deployment
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">9. International Data Transfers</h2>
            <p className="text-gray-300 leading-relaxed">
              Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to Privacy Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify users of any significant changes via email or through our service.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              For questions about this Privacy Policy or to exercise your rights, please contact us at:
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
