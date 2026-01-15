import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - K-MarketInsight',
  description: 'How we collect, use, and protect your personal information',
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
        <p className="text-gray-400 mb-12">Last updated: January 15, 2026</p>

        <div className="prose prose-invert prose-lg max-w-none">
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-6 mb-8">
            <p className="text-blue-200 leading-relaxed">
              K-MarketInsight ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains
              how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.1 Information You Provide</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Account Information:</strong> Email address, name, password
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Payment Information:</strong> Processed by Paddle (we do not store credit card details)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Profile Information:</strong> Optional preferences and settings
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.2 Automatically Collected Information</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Usage Data:</strong> Pages visited, features used, time spent
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Device Information:</strong> Browser type, IP address, operating system
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Cookies:</strong> For authentication and preferences
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.3 Third-Party Data</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>OAuth Data:</strong> If you sign in with Google (name, email, profile picture)
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-300 mb-4">We use your information to:</p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Provide and maintain the Service
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Process payments and manage subscriptions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Send service announcements and updates
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Improve and personalize user experience
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Analyze usage patterns and trends
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Detect and prevent fraud or abuse
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Comply with legal obligations
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Share Your Information</h2>
            <p className="text-gray-300 mb-4">We do NOT sell your personal information. We may share your information with:</p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.1 Service Providers</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Supabase:</strong> Database and authentication
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Paddle:</strong> Payment processing
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Vercel:</strong> Hosting and deployment
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>OpenAI/GROQ:</strong> AI analysis (anonymized data only)
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">3.2 Legal Requirements</h3>
            <p className="text-gray-300">
              We may disclose your information if required by law, court order, or to protect our rights and safety.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Security</h2>
            <p className="text-gray-300 mb-4">We implement security measures to protect your information:</p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">🔒</span>
                TLS/SSL encryption for data in transit
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">🔒</span>
                Encrypted passwords using bcrypt
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">🔒</span>
                Row-level security (RLS) in database
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">🔒</span>
                Regular security audits and updates
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">🔒</span>
                Access controls and authentication
              </li>
            </ul>
            <p className="text-yellow-200 mt-4 text-sm">
              However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">5. Data Retention</h2>
            <p className="text-gray-300 mb-4">
              We retain your information for as long as your account is active or as needed to provide services.
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Account Data:</strong> Until account deletion + 30 days
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Usage Logs:</strong> 90 days
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Payment Records:</strong> 7 years (legal requirement)
              </li>
            </ul>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">6. Your Rights</h2>
            <p className="text-gray-300 mb-4">You have the right to:</p>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <div>
                  <strong>Access:</strong> Request a copy of your personal data
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <div>
                  <strong>Correction:</strong> Update inaccurate or incomplete information
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <div>
                  <strong>Deletion:</strong> Request deletion of your account and data
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <div>
                  <strong>Portability:</strong> Receive your data in a structured format
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <div>
                  <strong>Opt-out:</strong> Unsubscribe from marketing emails
                </div>
              </li>
            </ul>
            <p className="text-gray-400 mt-4 text-sm">
              To exercise these rights, contact us at privacy@k-marketinsight.com
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">7. Cookies and Tracking</h2>
            <p className="text-gray-300 mb-4">We use cookies for:</p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Essential Cookies:</strong> Authentication and security (required)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Analytics Cookies:</strong> Usage statistics (Vercel Analytics)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <strong>Preference Cookies:</strong> Remember your settings
              </li>
            </ul>
            <p className="text-gray-300 mt-4">
              You can control cookies through your browser settings, but this may affect Service functionality.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">8. International Data Transfers</h2>
            <p className="text-gray-300">
              Your information may be transferred to and processed in countries other than your country of residence.
              We ensure appropriate safeguards are in place for such transfers.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">9. Children's Privacy</h2>
            <p className="text-gray-300">
              Our Service is not intended for users under 18 years of age. We do not knowingly collect personal information
              from children. If you are a parent and believe your child has provided us with information, please contact us.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to This Policy</h2>
            <p className="text-gray-300">
              We may update this Privacy Policy from time to time. We will notify you of material changes via email or
              in-app notification. Your continued use after changes indicates acceptance.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you have questions about this Privacy Policy or our data practices:
            </p>
            <div className="text-gray-300">
              <p>Email: <a href="mailto:privacy@k-marketinsight.com" className="text-blue-400 hover:text-blue-300">privacy@k-marketinsight.com</a></p>
              <p className="mt-4 text-sm text-gray-400">
                Data Protection Officer: (To be appointed after company registration)
              </p>
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
              <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                Terms of Service
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
