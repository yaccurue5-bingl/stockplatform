'use client';

import { useState } from 'react';
import CodeBlock from './CodeBlock';

export interface LangTab {
  label: string;
  code: string;
  language: string;
}

export default function LangTabs({ tabs }: { tabs: LangTab[] }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="flex gap-1 mb-2">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              active === i
                ? 'bg-[#00D4A6]/15 text-[#00D4A6]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <CodeBlock code={tabs[active].code} language={tabs[active].language} />
    </div>
  );
}
