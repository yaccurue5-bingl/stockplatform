'use client';

import { useState } from 'react';
import AppShell from '@/components/app/AppShell';
import { Copy, Check, Eye, EyeOff, Trash2, Plus, ShieldCheck } from 'lucide-react';

type ApiKey = {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  status: 'active' | 'revoked';
};

const mockKeys: ApiKey[] = [
  {
    id: '1',
    name: 'Production',
    key: 'kmi_live_8dj392jd92k4f8s0d92jf',
    created: '2026-01-15',
    lastUsed: '2026-03-14',
    status: 'active',
  },
  {
    id: '2',
    name: 'Development',
    key: 'kmi_live_3kx029sl10d8f3j2k9s0xp',
    created: '2026-02-03',
    lastUsed: '2026-03-12',
    status: 'active',
  },
  {
    id: '3',
    name: 'Test (Old)',
    key: 'kmi_live_0as9d2jf83js9d2jf8s0dk',
    created: '2025-11-20',
    lastUsed: '2026-01-05',
    status: 'revoked',
  },
];

function maskKey(key: string) {
  return key.slice(0, 14) + '••••••••••••' + key.slice(-4);
}

export default function ApiKeyPage() {
  const [keys, setKeys] = useState<ApiKey[]>(mockKeys);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied]     = useState<Record<string, boolean>>({});
  const [showNew, setShowNew]   = useState(false);
  const [newName, setNewName]   = useState('');

  function toggleReveal(id: string) {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function copyKey(id: string, key: string) {
    navigator.clipboard.writeText(key);
    setCopied((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setCopied((prev) => ({ ...prev, [id]: false })), 2000);
  }

  function revokeKey(id: string) {
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, status: 'revoked' } : k));
  }

  function createKey() {
    if (!newName.trim()) return;
    const newKey: ApiKey = {
      id: String(Date.now()),
      name: newName.trim(),
      key: 'kmi_live_' + Math.random().toString(36).slice(2, 26),
      created: new Date().toISOString().slice(0, 10),
      lastUsed: '—',
      status: 'active',
    };
    setKeys((prev) => [newKey, ...prev]);
    setNewName('');
    setShowNew(false);
  }

  return (
    <AppShell title="API Keys" subtitle="Manage your API keys and access tokens">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-[#00D4A6]/5 border border-[#00D4A6]/20 rounded-xl p-4 mb-6">
        <ShieldCheck size={16} className="text-[#00D4A6] mt-0.5 shrink-0" />
        <p className="text-xs text-gray-400 leading-relaxed">
          API keys are used to authenticate requests. Include your key in the{' '}
          <code className="bg-gray-800 text-[#00D4A6] px-1.5 py-0.5 rounded text-[11px]">Authorization</code>{' '}
          header as <code className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[11px]">Bearer YOUR_API_KEY</code>.
          Keep keys secret — do not share or commit them to version control.
        </p>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{keys.filter((k) => k.status === 'active').length} active key(s)</p>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4A6] text-[#0B0F14] text-xs font-bold hover:bg-[#00bfa0] transition"
        >
          <Plus size={13} />
          New API Key
        </button>
      </div>

      {/* New key form */}
      {showNew && (
        <div className="bg-[#0d1117] border border-[#00D4A6]/30 rounded-xl p-5 mb-4">
          <p className="text-sm font-semibold text-white mb-3">Create New Key</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createKey()}
              placeholder="Key name (e.g. Production)"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4A6] transition"
            />
            <button
              onClick={createKey}
              className="px-4 py-2 rounded-lg bg-[#00D4A6] text-[#0B0F14] text-xs font-bold hover:bg-[#00bfa0] transition"
            >
              Create
            </button>
            <button
              onClick={() => { setShowNew(false); setNewName(''); }}
              className="px-4 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keys table */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left px-5 py-3 font-medium">Name</th>
              <th className="text-left px-5 py-3 font-medium">Key</th>
              <th className="text-left px-5 py-3 font-medium">Created</th>
              <th className="text-left px-5 py-3 font-medium">Last Used</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-right px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition">
                <td className="px-5 py-4 text-white font-medium text-xs">{k.name}</td>
                <td className="px-5 py-4">
                  <code className="text-xs text-gray-300 font-mono">
                    {revealed[k.id] ? k.key : maskKey(k.key)}
                  </code>
                </td>
                <td className="px-5 py-4 text-xs text-gray-500">{k.created}</td>
                <td className="px-5 py-4 text-xs text-gray-500">{k.lastUsed}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    k.status === 'active'
                      ? 'bg-[#00D4A6]/10 text-[#00D4A6]'
                      : 'bg-gray-700/50 text-gray-500'
                  }`}>
                    {k.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {k.status === 'active' && (
                      <>
                        <button
                          onClick={() => toggleReveal(k.id)}
                          className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition"
                          title={revealed[k.id] ? 'Hide' : 'Reveal'}
                        >
                          {revealed[k.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button
                          onClick={() => copyKey(k.id, k.key)}
                          className="p-1.5 rounded text-gray-500 hover:text-[#00D4A6] hover:bg-gray-800 transition"
                          title="Copy"
                        >
                          {copied[k.id] ? <Check size={13} className="text-[#00D4A6]" /> : <Copy size={13} />}
                        </button>
                        <button
                          onClick={() => revokeKey(k.id)}
                          className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800 transition"
                          title="Revoke"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Usage tip */}
      <div className="mt-6 bg-[#0d1117] border border-gray-800 rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Quick Start</p>
        <pre className="text-xs text-gray-300 font-mono bg-gray-900/60 rounded-lg p-4 overflow-x-auto leading-relaxed">{`curl https://api.k-market-insight.com/v1/events \\
  -H "Authorization: Bearer kmi_live_8dj392jd92k..." \\
  -H "Content-Type: application/json"`}</pre>
      </div>
    </AppShell>
  );
}
