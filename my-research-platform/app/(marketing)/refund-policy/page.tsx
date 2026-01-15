import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy - K-MarketInsight',
  description: 'Our refund and cancellation policy for K-MarketInsight subscriptions',
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
        <p className="text-gray-400 mb-12">Last updated: January 15, 2026</p>

        <div className="prose prose-invert prose-lg max-w-none">
          <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-6 mb-8">
            <p className="text-green-200 leading-relaxed">
              We want you to be completely satisfied with K-MarketInsight. If you're not happy with your purchase,
              we offer a 30-day money-back guarantee.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">1. 30-Day Money-Back Guarantee</h2>
            <p className="text-gray-300 mb-4">
              For PRO plan subscriptions, you can request a full refund within 30 days of your initial purchase if:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                This is your first subscription with K-MarketInsight
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                The request is made within 30 days of the original purchase date
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                You have not violated our Terms of Service
              </li>
            </ul>
            <p className="text-blue-200 mt-4 text-sm">
              No questions asked - if you're not satisfied, we'll refund you.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">2. How to Request a Refund</h2>
            <p className="text-gray-300 mb-4">To request a refund:</p>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">1.</span>
                <div>
                  Email us at <a href="mailto:support@k-marketinsight.com" className="text-blue-400 hover:text-blue-300 underline">support@k-marketinsight.com</a> with subject "Refund Request"
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">2.</span>
                <div>
                  Include your account email and order number (found in your purchase confirmation email)
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">3.</span>
                <div>
                  Optionally, let us know why you're requesting a refund (helps us improve)
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">4.</span>
                <div>
                  We'll process your refund within 5-7 business days
                </div>
              </li>
            </ol>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">3. Subscription Renewals</h2>
            <p className="text-gray-300 mb-4">
              For subscription renewals (after the first 30 days):
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <strong>No refunds for renewal charges</strong> - You must cancel before the renewal date
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <strong>Prorated refunds:</strong> Not available for partial months
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <strong>Cancellation:</strong> Takes effect at the end of the billing period
              </li>
            </ul>
            <p className="text-gray-400 mt-4 text-sm">
              Example: If you cancel on March 15, your access continues until March 31 (no refund for remaining days).
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">4. How to Cancel Your Subscription</h2>
            <p className="text-gray-300 mb-4">
              You can cancel your subscription anytime:
            </p>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">1.</span>
                <div>
                  Log in to your K-MarketInsight account
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">2.</span>
                <div>
                  Go to Settings → Billing
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">3.</span>
                <div>
                  Click "Cancel Subscription"
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">4.</span>
                <div>
                  Confirm cancellation
                </div>
              </li>
            </ol>
            <p className="text-green-200 mt-4">
              Your access will continue until the end of your current billing period.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">5. Exceptions to Refund Policy</h2>
            <p className="text-gray-300 mb-4">
              We cannot provide refunds in the following cases:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-red-400">✗</span>
                Accounts terminated for Terms of Service violations
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">✗</span>
                Refund requests made after 30 days of initial purchase
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">✗</span>
                Previous refunds already received for same account
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">✗</span>
                Fraudulent or abusive refund requests
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">✗</span>
                FREE plan (no purchase required)
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">6. Refund Processing Time</h2>
            <p className="text-gray-300 mb-4">
              Once your refund request is approved:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Processing:</strong> 5-7 business days
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Credit/Debit Cards:</strong> 5-10 business days to appear on statement
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>PayPal:</strong> 3-5 business days
              </li>
            </ul>
            <p className="text-gray-400 mt-4 text-sm">
              Refunds are issued to the original payment method only.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">7. Chargebacks</h2>
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 mb-4">
              <p className="text-red-200 font-medium">⚠️ Important Notice</p>
            </div>
            <p className="text-gray-300 mb-4">
              If you dispute a charge with your bank without contacting us first:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Your account will be immediately suspended
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                We may not be able to provide a refund after chargeback
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Future access to K-MarketInsight may be blocked
              </li>
            </ul>
            <p className="text-yellow-200 mt-4">
              Please contact us first - we're happy to help resolve any billing issues!
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">8. Annual Plans</h2>
            <p className="text-gray-300 mb-4">
              For annual subscriptions:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                30-day money-back guarantee applies (full refund)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                After 30 days: No refunds for remaining months
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                Cancellation takes effect at the end of 12-month period
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">9. Service Outages</h2>
            <p className="text-gray-300 mb-4">
              If we experience extended service downtime:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Planned Maintenance:</strong> No compensation (we notify in advance)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Unplanned Outage (>24h):</strong> Contact us for service credit
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">10. Questions?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Have questions about our refund policy? We're here to help:
            </p>
            <div className="text-gray-300">
              <p>Email: <a href="mailto:support@k-marketinsight.com" className="text-blue-400 hover:text-blue-300 underline">support@k-marketinsight.com</a></p>
              <p className="mt-2">Response time: Within 24 hours (business days)</p>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-6 mt-8">
            <h3 className="text-xl font-bold text-white mb-3">💡 Before Requesting a Refund</h3>
            <p className="text-blue-200 mb-3">
              Not satisfied with the service? Let us help! Common issues we can solve:
            </p>
            <ul className="space-y-2 text-blue-200">
              <li className="flex items-start gap-2">
                <span>•</span>
                Technical difficulties - our support team can help troubleshoot
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                Feature questions - we provide onboarding assistance
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                Data accuracy concerns - we can verify and correct issues
              </li>
            </ul>
            <p className="text-blue-200 mt-3">
              Contact us at <a href="mailto:support@k-marketinsight.com" className="underline">support@k-marketinsight.com</a> - we want to make it right!
            </p>
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
              <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
