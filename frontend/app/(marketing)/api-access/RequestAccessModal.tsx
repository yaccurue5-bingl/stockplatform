'use client';

import { useState } from 'react';
import { ArrowRight, X, CheckCircle } from 'lucide-react';

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
  const [open, setOpen]       = useState(false);
  const [email, setEmail]     = useState('');
  const [org, setOrg]         = useState('');
  const [useCase, setUseCase] = useState('');
  const [dataReqs, setDataReqs] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  const handleClose = () => {
    setOpen(false);
    // 닫을 때 상태 초기화 (딜레이 후 — 애니메이션 보호)
    setTimeout(() => {
      setDone(false);
      setError('');
      setEmail('');
      setOrg('');
      setUseCase('');
      setDataReqs('');
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // useCase에 Organization + Use Case + Data Requirements 합침
    const combinedUseCase = [
      org       ? `Organization: ${org}` : '',
      useCase   ? `Use Case: ${useCase}` : '',
      dataReqs  ? `Data Requirements: ${dataReqs}` : '',
    ].filter(Boolean).join('\n');

    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, useCase: combinedUseCase, plan: 'API' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Something went wrong.');
      }

      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
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
            onClick={handleClose}
          />
          <div className="relative z-10 bg-[#121821] border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {done ? (
              /* ── 성공 상태 ── */
              <div className="text-center py-4">
                <CheckCircle size={44} className="text-[#00D4A6] mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Request Received</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                  We'll review your request and get back to you within{' '}
                  <span className="text-white font-medium">1–2 business days</span>.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition"
                >
                  Close
                </button>
              </div>
            ) : (
              /* ── 폼 ── */
              <>
                <h2 className="text-xl font-bold text-white mb-2">Request API Access</h2>
                <p className="text-sm text-gray-400 mb-6">
                  Tell us about your use case. We'll respond within 1–2 business days.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 font-medium mb-1 block">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@company.com"
                      className="w-full bg-[#0B0F14] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4A6] transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 font-medium mb-1 block">
                      Organization <span className="text-red-400">*</span>
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

                  {error && (
                    <p className="text-red-400 text-xs">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#00D4A6] hover:bg-[#00bfa0] disabled:opacity-50 disabled:cursor-not-allowed text-[#0B0F14] font-bold py-3 rounded-lg transition text-sm flex items-center justify-center gap-2"
                  >
                    {loading ? 'Submitting…' : <> Submit Request <ArrowRight size={16} /></>}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
