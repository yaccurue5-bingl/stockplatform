'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';

interface ApiKeyButtonProps {
  className?: string;
  label?: string;
}

export default function ApiKeyButton({
  className,
  label = 'Get API Key →',
}: ApiKeyButtonProps) {
  const [href, setHref] = useState('/signup');

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => {
      if (data.user) setHref('/api-key');
    });
  }, []);

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
