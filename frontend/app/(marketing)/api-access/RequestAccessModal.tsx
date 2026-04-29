'use client';

import { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';

interface Props {
  className?: string;
  label?: string;
  size?: number;
}

export default function RequestAccessModal({
  className = 'inline-flex items-center gap-2 bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-semibold px-6 py-3 rounded-lg transition',
  label = 'Request Access',
  size = 16,
}: Props) {
  const [open, setOpen] = useState(false);
  const [org, setOrg] = useState('');
  const [useCase, setUseCase] = useState('');
  const [dataReqs, setDataReqs] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = 'API Access Request — K-Market Insight';
    const body = `Hi,\n\nOrganization: ${org}\nUse case: ${useCase}\nData requirements: ${dataReqs}\n\n`;
    window.location.href = `mailto:yaccurue5@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {label} <ArrowRight size={size} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-[#121821] border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-white mb-2">Request API Access</h2>
            <p className="text-sm text-gray-400 mb-6">
              Tell us about your use case. We'll respond within 1–2 business days.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">
                  Organization
                </label>
                <input
                  type="text"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  required
                  placeholder="Your company or fund name"
                  className="w-full bg-[#0B0F14] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4A6] transition"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">
                  Use Case
                </label>
                <textarea
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  required
                  rows={2}
                  placeholder="e.g. Event-driven signal generation for Korean equities"
                  className="w-full bg-[#0B0F14] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4A6] transition resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">
                  Data Requirements
                </label>
                <textarea
                  value={dataReqs}
                  onChange={(e) => setDataReqs(e.target.value)}
                  rows={2}
                  placeholder="e.g. Real-time DART disclosures, historical since 2020"
                  className="w-full bg-[#0B0F14] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4A6] transition resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#00D4A6] hover:bg-[#00bfa0] text-[#0B0F14] font-bold py-3 rounded-lg transition text-sm flex items-center justify-center gap-2"
              >
                Send Request <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
