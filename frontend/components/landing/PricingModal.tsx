'use client';

import { useState } from 'react';
import { X, ArrowRight, CheckCircle } from 'lucide-react';

interface Props {
  plan: string;
  onClose: () => void;
}

export default function PricingModal({ plan, onClose }: Props) {
  const [email, setEmail]     = useState('');
  const [useCase, setUseCase] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, useCase, plan }),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 bg-[#121821] border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {done ? (
          /* ── Success state ── */
          <div className="text-center py-4">
            <CheckCircle size={44} className="text-[#00D4A6] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Request Received</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              We'll review your request and get back to you within{' '}
              <span className="text-white font-medium">1–2 business days</span>.
            </p>
            <button
              onClick={onClose}
              className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition"
            >
              Close
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <>
            <div className="mb-6">
              <span className="text-xs font-bold tracking-widest text-[#00D4A6] uppercase">
                {plan} Plan
              </span>
              <h2 className="text-xl font-bold text-white mt-1">Request Access</h2>
              <p className="text-sm text-gray-400 mt-1">
                No credit card. We'll reach out within 1–2 business days.
              </p>
            </div>

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
                  How will you use this data?
                </label>
                <textarea
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  rows={3}
                  placeholder="e.g. Event-driven signals for Korean equities, quant fund research..."
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
                {loading ? 'Submitting…' : <>Submit Request <ArrowRight size={15} /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
