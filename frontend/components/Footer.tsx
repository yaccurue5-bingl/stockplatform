import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Customer Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">Customer Support</h3>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Service Inquiries</div>
                <a
                  href="mailto:support@k-marketinsight.com"
                  className="text-blue-400 hover:text-blue-300 transition inline-flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  support@k-marketinsight.com
                </a>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Billing & Refunds</div>
                <div className="text-gray-300 text-sm mb-1">
                  For payment-related issues or refund requests, please visit:
                </div>
                <a
                  href="https://www.paddle.com/help"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition inline-flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Paddle Help Center
                </a>
              </div>
            </div>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <div className="flex flex-col space-y-2 text-sm">
              <Link href="/terms" className="text-gray-400 hover:text-white transition">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white transition">
                Privacy Policy
              </Link>
              <Link href="/refund-policy" className="text-gray-400 hover:text-white transition">
                Refund Policy
              </Link>
              <Link href="/pricing" className="text-gray-400 hover:text-white transition">
                Pricing
              </Link>
            </div>
          </div>
        </div>

        {/* Data Sources Attribution */}
        <div className="pt-8 border-t border-gray-800 mb-8">
          <h3 className="text-white font-semibold mb-3 text-sm">Data Sources</h3>
          <div className="space-y-2 text-xs text-gray-500 leading-relaxed">
            <p>
              <span className="text-gray-400 font-medium">Disclosure filings:</span>{' '}
              AI-processed summaries derived from the{' '}
              <a
                href="https://dart.fss.or.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 transition"
              >
                DART (금융감독원 전자공시시스템)
              </a>{' '}
              open API. Original filings remain the property of the respective disclosing companies.
            </p>
            <p>
              <span className="text-gray-400 font-medium">Export/Import trend data:</span>{' '}
              AI-processed analysis derived from the Monthly Export-Import Trend report published by the{' '}
              <a
                href="https://www.motie.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 transition"
              >
                Ministry of Trade, Industry and Energy (산업통상자원부)
              </a>
              . Source: motir.go.kr. Original publication © Republic of Korea.
            </p>
            <p>
              <span className="text-gray-400 font-medium">Daily economic indicators:</span>{' '}
              AI-processed analysis derived from the Daily Economic Indicators report published by the{' '}
              <a
                href="https://www.moef.go.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 transition"
              >
                Ministry of Economy and Finance (기획재정부)
              </a>
              . Original publication © Republic of Korea.
            </p>
            <p className="text-gray-600 pt-1">
              All AI-generated content represents independent analysis and does not constitute an official
              publication or endorsement by any government ministry. Raw government data is not redistributed.
              This platform does not provide investment advice.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800">
          <div className="text-sm text-gray-400 text-center">
            © 2026 K-MarketInsight. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
