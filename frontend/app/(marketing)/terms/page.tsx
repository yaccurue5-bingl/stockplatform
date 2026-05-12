import Link from 'next/link';
import type { Metadata } from 'next';
import Footer from '@/components/Footer';

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
        <p className="text-gray-400 mb-8">Last updated: 2026-01-18</p>
        <div className="text-gray-300 text-lg mb-12 space-y-4">
          <p>Welcome to K-MarketInsight (“Service”, “we”, “our”, “us”).</p>
          <p>By accessing or using K-MarketInsight, you agree to be bound by these Terms of Service.</p>
        </div>

        <div className="space-y-8">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">1. Service Description</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              K-MarketInsight provides AI-assisted analysis and summaries of publicly available Korean market disclosures and related information.
            </p>
            <p className="text-gray-300 mb-2 font-medium">All data is sourced from official public institutions, including:</p>
            <ul className="space-y-2 text-gray-400 mb-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <a href="https://dart.fss.or.kr" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 underline">DART — Financial Supervisory Service (금융감독원 전자공시시스템)</a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <a href="https://www.data.go.kr" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 underline">data.go.kr — Korea Public Data Portal (공공데이터포털)</a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <a href="https://ecos.bok.or.kr" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 underline">ECOS — Bank of Korea Economic Statistics System</a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                <a href="https://www.motie.go.kr" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 underline">MOTIE — Ministry of Trade, Industry and Energy (산업통상자원부)</a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Other official Korean government Open APIs
              </li>
            </ul>
            <p className="text-blue-200 text-sm italic">
              The Service is provided for informational and educational purposes only and does not constitute investment advice.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">2. No Investment Advice</h2>
            <p className="text-gray-300 mb-4 font-medium">The content provided by K-MarketInsight:</p>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Is not a recommendation to buy or sell securities
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Does not constitute financial, legal, or tax advice
              </li>
            </ul>
            <p className="text-gray-300 mt-4 font-bold">
              Users are solely responsible for their investment decisions.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts</h2>
            <p className="text-gray-300 leading-relaxed">
              You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">4. Subscription & Billing</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Paid features are offered on a subscription basis. Payments are processed by <strong>Paddle</strong>, our authorized Merchant of Record.
            </p>
            <p className="text-gray-300">
              Pricing, billing cycles, and renewal terms are clearly displayed at checkout and managed through your account settings.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">5. Refunds</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Refunds are handled in accordance with our Refund Policy, which provides a **14-day unconditional refund** for initial purchases.
            </p>
            <Link href="/refund-policy" className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center">
              View Refund Policy <span className="ml-1">→</span>
            </Link>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">6. Intellectual Property</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              All original content, including AI-generated summaries, UI elements, and branding, is the property of K-MarketInsight.
            </p>
            <p className="text-gray-400 text-sm">
              Note: Public disclosure texts remain the property of their respective issuing institutions or corporations.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">7. Service Availability &amp; External Data Sources</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We strive to maintain continuous availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable for scheduled maintenance or updates.
            </p>

            <h3 className="text-lg font-semibold text-white mt-6 mb-3">External Data Source Availability</h3>
            <p className="text-gray-300 leading-relaxed mb-4">
              K-MarketInsight integrates data from external public institutions and government APIs, including DART, data.go.kr, ECOS, and MOTIE.
              These third-party data sources are operated and maintained by their respective government agencies independently of K-MarketInsight.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              Data updates may be temporarily delayed or interrupted due to reasons beyond our control, including but not limited to:
            </p>
            <ul className="space-y-2 text-gray-400 mb-4">
              <li className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">•</span> Scheduled or emergency maintenance by the data provider</li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">•</span> API rate limits, service outages, or infrastructure issues at the source</li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">•</span> Changes to the data provider&apos;s API structure or access policies</li>
              <li className="flex items-start gap-2"><span className="text-yellow-400 mt-0.5">•</span> Network interruptions or response delays</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mb-3">
              To mitigate these disruptions, the Service applies caching and error-handling measures.
              In some cases, the most recently available data may be displayed rather than a real-time update.
            </p>
            <p className="text-amber-300 text-sm font-medium border border-amber-500/30 bg-amber-500/10 rounded-lg px-4 py-3">
              K-MarketInsight does not guarantee complete real-time data availability and shall not be liable for any temporary data delays
              or interruptions arising from the operational status of external data providers.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              To the maximum extent permitted by law, K-MarketInsight shall not be liable for any indirect or consequential damages arising from the use of or inability to use the Service.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">9. Governing Law</h2>
            <p className="text-gray-300 leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable international consumer protection laws and regulations.
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">10. Contact</h2>
            <p className="text-gray-300 leading-relaxed">
              For questions regarding these Terms, please contact:
              <br />
              <a href="mailto:support@k-marketinsight.com" className="text-blue-400 hover:text-blue-300 underline mt-2 inline-block">
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

      <Footer />
    </div>
  );
}
