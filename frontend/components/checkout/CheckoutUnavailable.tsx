'use client';

import { useState } from 'react';
import ContactModal from '@/components/ContactModal';

export default function CheckoutUnavailable() {
  const [open, setOpen] = useState(false);

  return (
    <div className="text-center py-12">
      <p className="text-red-400 text-sm mb-2">Checkout is temporarily unavailable.</p>
      <p className="text-gray-500 text-xs">
        Please{' '}
        <button
          onClick={() => setOpen(true)}
          className="text-[#00D4A6] hover:underline"
        >
          contact us
        </button>{' '}
        to complete your upgrade.
      </p>
      <ContactModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}
