import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy - K-MarketInsight',
  description: '7-day refund policy for digital content purchases',
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
        <p className="text-gray-400 mb-12">Last updated: January 16, 2026</p>

        <div className="bg-yellow-900/20 border-2 border-yellow-600/50 rounded-xl p-6 mb-12">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-yellow-200 font-bold mb-2">Important Notice</h3>
              <p className="text-yellow-100 text-sm">
                Due to the digital nature of our service, refunds are subject to the conditions below.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Eligibility for Refund</h2>
            <div className="space-y-4 text-gray-300">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p>
                  <strong>Refund requests must be made within 7 days of the initial purchase</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p>
                  <strong>A full refund is available only if no paid AI analysis content has been accessed</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Limitations</h2>
            <div className="space-y-4 text-gray-300">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p>
                  If a user has accessed two (2) or more paid AI analysis reports, <strong>a refund may be restricted or declined</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p>
                  Once digital content has been accessed, it is considered delivered
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Rationale</h2>
            <p className="text-gray-300 leading-relaxed">
              This policy is in place due to the instant-access and non-returnable nature of digital content.
              Once AI analysis reports are accessed, the digital product has been delivered and consumed,
              similar to downloading an ebook or streaming a movie.
            </p>
          </div>

          <div className="bg-blue-900/20 border border-blue-600/50 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">How to Request a Refund</h2>
            <p className="text-blue-100 leading-relaxed mb-4">
              Please contact us at:
            </p>
            <a
              href="mailto:support@k-marketinsight.com"
              className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 font-medium text-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              support@k-marketinsight.com
            </a>
            <p className="text-blue-200 text-sm mt-4">
              All refunds are processed through Paddle, our payment processor. Please allow 5-10 business days for refunds to appear in your account.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Processing Time</h2>
            <p className="text-gray-300 leading-relaxed">
              Approved refunds are typically processed within 5-10 business days. The refund will be returned to your original payment method.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Exceptions</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We reserve the right to make exceptions to this policy on a case-by-case basis for:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Technical issues preventing access to purchased content
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Billing errors or duplicate charges
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Service outages affecting content delivery
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Contact Information</h2>
            <p className="text-gray-300 leading-relaxed">
              For questions about this Refund Policy or to request a refund, please contact:
              <br /><br />
              <strong className="text-white">Email:</strong>
              <a href="mailto:support@k-marketinsight.com" className="text-blue-400 hover:text-blue-300 underline ml-2">
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
              <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors">
                Privacy Policy
              </Link>
              <Link href="/refund-policy" className="text-white text-sm font-medium">
                Refund Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
