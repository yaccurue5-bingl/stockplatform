import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0D1117] text-white flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <p className="text-7xl font-bold text-gray-800 select-none">404</p>
        <h1 className="text-2xl font-semibold text-white">Page not found</h1>
        <p className="text-gray-400 leading-relaxed">
          This page doesn&apos;t exist or may have been removed. Try searching for a company
          or browse the latest Korean market disclosures.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00D4A6] text-black text-sm font-semibold hover:bg-[#00bfa0] transition"
          >
            <ArrowLeft size={15} />
            Back to home
          </Link>
          <Link
            href="/disclosures"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-gray-700 text-sm font-medium hover:border-gray-500 transition"
          >
            Browse disclosures
          </Link>
        </div>
      </div>
    </main>
  );
}
