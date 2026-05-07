'use client';

import { useState, useEffect, useRef } from 'react';
import type { Paddle } from '@paddle/paddle-js';
import { CheckCircle, Loader2, ExternalLink } from 'lucide-react';

interface CheckoutClientProps {
  userId: string;
  userEmail: string;
  plan: 'starter' | 'pro';
  priceId: string;
  clientToken: string;
  isSandbox: boolean;
}

const PLAN_META = {
  starter: {
    name: 'Starter',
    price: '$99',
    period: '/month',
    color: '#4EA3FF',
    features: [
      '10,000 API calls / month',
      '7-day historical data',
      'Core endpoints: Events, Sector Signals, Market Radar',
      'JSON responses with AI-generated summaries',
      'Standard rate limits (60 req/min)',
      'Email support',
    ],
  },
  pro: {
    name: 'Pro',
    price: '$299',
    period: '/month',
    color: '#00D4A6',
    features: [
      '100,000 API calls / month',
      '30-day historical data',
      'All endpoints including Company profiles',
      'Bulk data access',
      'Higher rate limits (300 req/min)',
      'Priority support',
      'Signal tags & dilution scores',
    ],
  },
};

export default function CheckoutClient({
  userId,
  userEmail,
  plan,
  priceId,
  clientToken,
  isSandbox,
}: CheckoutClientProps) {
  const [paddle, setPaddle]     = useState<Paddle | null>(null);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const initialized = useRef(false);

  const meta = PLAN_META[plan];

  // Paddle 초기화 (최초 1회)
  useEffect(() => {
    if (initialized.current || !clientToken || !priceId) return;
    initialized.current = true;

    import('@paddle/paddle-js').then(({ initializePaddle }) => {
      initializePaddle({
        token: clientToken,
        environment: isSandbox ? 'sandbox' : 'production',
        eventCallback(event) {
          if (event.name === 'checkout.completed') {
            setSuccess(true);
            setLoading(false);
          }
          if (event.name === 'checkout.closed') {
            setLoading(false);
          }
          if (event.name === 'checkout.error') {
            setLoading(false);
          }
        },
      })
        .then((p) => {
          if (p) setPaddle(p);
        })
        .catch((e) => {
          console.error('[CheckoutClient] Paddle init error:', e);
          setInitError('Failed to load payment system. Please refresh and try again.');
        });
    });
  }, [clientToken, isSandbox, priceId]);

  function openCheckout() {
    if (!paddle) return;
    setLoading(true);

    try {
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: { email: userEmail },
        customData: { user_id: userId },
      });
    } catch (e) {
      console.error('[CheckoutClient] open error:', e);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle size={48} className="text-[#00D4A6] mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Subscription Activated!</h2>
        <p className="text-gray-400 mb-2">
          Your <strong className="text-white">{meta.name}</strong> plan is now active.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Your API key is ready. Go to your dashboard to get started.
        </p>
        <a
          href="/api-key"
          className="px-6 py-2.5 rounded-full bg-[#00D4A6] text-[#0B0F14] font-bold text-sm hover:bg-[#00bfa0] transition"
        >
          View API Key →
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Plan card */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-2xl overflow-hidden mb-6">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Plan</p>
              <h2 className="text-xl font-bold text-white">{meta.name}</h2>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold" style={{ color: meta.color }}>
                {meta.price}
              </span>
              <span className="text-gray-500 text-sm">{meta.period}</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="px-6 py-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Includes</p>
          <ul className="space-y-2.5">
            {meta.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                <span className="mt-0.5 flex-shrink-0 text-[#00D4A6]">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <div className="px-6 py-4 bg-[#121821] border-t border-gray-800">
          <p className="text-xs text-gray-500">
            Billed monthly. Cancel anytime via your billing portal.
            Payments processed securely by <strong className="text-gray-400">Paddle</strong>.
          </p>
        </div>
      </div>

      {/* CTA */}
      {initError ? (
        <div className="text-center py-4">
          <p className="text-sm text-red-400 mb-3">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-gray-400 hover:text-white underline"
          >
            Reload page
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={openCheckout}
            disabled={!paddle || loading}
            className="w-full py-3.5 rounded-full font-bold text-sm transition flex items-center justify-center gap-2"
            style={{
              background: !paddle || loading ? '#1f2937' : meta.color,
              color: !paddle || loading ? '#6b7280' : '#0B0F14',
              cursor: !paddle || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Opening checkout...
              </>
            ) : !paddle ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading payment system...
              </>
            ) : (
              `Continue to Checkout — ${meta.price}/mo`
            )}
          </button>

          <p className="text-center text-xs text-gray-600 mt-3">
            By continuing, you agree to our{' '}
            <a href="/terms" className="text-gray-500 hover:text-gray-300 underline">Terms</a>
            {' '}and{' '}
            <a href="/privacy" className="text-gray-500 hover:text-gray-300 underline">Privacy Policy</a>.
          </p>
        </>
      )}

      {/* Disclaimer */}
      <div className="mt-6 p-4 rounded-xl border border-gray-800 bg-[#0d1117]">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <strong className="text-gray-500">Not financial advice.</strong>{' '}
          Signals are probabilistic and provided for research purposes only.
          Past performance does not guarantee future results.
        </p>
      </div>

      {/* Enterprise link */}
      {plan === 'pro' && (
        <div className="mt-4 text-center">
          <a
            href="/api-access"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
          >
            <ExternalLink size={12} />
            Need Enterprise ($999+/mo)? Contact us →
          </a>
        </div>
      )}
    </div>
  );
}
