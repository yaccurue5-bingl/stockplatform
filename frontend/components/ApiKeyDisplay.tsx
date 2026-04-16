'use client';

import { useState } from 'react';
import { Copy, Check, Eye, EyeOff } from 'lucide-react';

interface Props {
  apiKey: string;
}

function maskKey(key: string) {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 8) + '••••••••••••••••' + key.slice(-4);
}

export default function ApiKeyDisplay({ apiKey }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [copied,   setCopied]   = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 bg-gray-900/60 rounded-lg px-4 py-3">
      <code className="flex-1 text-xs text-gray-200 font-mono tracking-wide break-all">
        {revealed ? apiKey : maskKey(apiKey)}
      </code>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setRevealed((v) => !v)}
          className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition"
          title={revealed ? 'Hide' : 'Reveal'}
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded text-gray-500 hover:text-[#00D4A6] hover:bg-gray-800 transition"
          title="Copy"
        >
          {copied ? <Check size={14} className="text-[#00D4A6]" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
