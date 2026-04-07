import Link from 'next/link';

const cols = [
  {
    title: 'Product',
    links: ['Datasets', 'API Docs', 'Pricing'],
    hrefs: ['#datasets', '#api-docs', '#pricing'],
  },
  {
    title: 'Company',
    links: ['About', 'Blog', 'Contact'],
    hrefs: ['#', '#', '#'],
  },
  {
    title: 'Legal',
    links: ['Terms', 'Privacy'],
    hrefs: ['/terms', '/privacy'],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#0B0F14] border-t border-gray-800 px-4 pt-16 pb-8">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md bg-[#00D4A6] flex items-center justify-center">
                <span className="text-[#0B0F14] font-bold text-sm">K</span>
              </div>
              <span className="font-semibold text-white text-sm">K-Market Insight</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Structured Korean market data API for quant funds, fintech platforms, and researchers.
            </p>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                {col.title}
              </p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link, i) => (
                  <li key={link}>
                    <Link
                      href={col.hrefs[i]}
                      className="text-sm text-gray-500 hover:text-white transition"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Data Sources Attribution */}
        <div className="border-t border-gray-800 pt-8 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Data Sources</p>
          <div className="space-y-1.5 text-xs text-gray-600 leading-relaxed max-w-3xl">
            <p>
              Disclosure analysis derived from{' '}
              <a href="https://dart.fss.or.kr" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400">
                DART (금융감독원 전자공시시스템)
              </a>{' '}
              open API. Export/Import trend analysis derived from reports by the{' '}
              <a href="https://www.motie.go.kr" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400">
                Ministry of Trade, Industry and Energy (산업통상자원부)
              </a>
              . Daily indicator analysis derived from reports by the{' '}
              <a href="https://www.moef.go.kr" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400">
                Ministry of Economy and Finance (기획재정부)
              </a>
              . AI-generated analysis only — raw government data is not redistributed. Not investment advice.
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-600">
            © 2026 K-Market Insight. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
