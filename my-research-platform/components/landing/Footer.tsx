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
              Korean Market Intelligence API for quant funds, fintechs, and research platforms.
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

        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-xs text-gray-600">
            © 2026 K-Market Insight. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
