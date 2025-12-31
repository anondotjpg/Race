'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const initWallets = async () => {
    setLoading(true);
    const res = await fetch('/api/init-wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret })
    });
    setResult(await res.json());
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin - Init Horse Wallets</h1>
      <input
        type="password"
        placeholder="Admin Secret"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        className="w-full p-2 border rounded mb-4 text-black"
      />
      <button
        onClick={initWallets}
        disabled={loading}
        className="bg-purple-600 text-white px-4 py-2 rounded"
      >
        {loading ? 'Creating...' : 'Initialize Wallets'}
      </button>
      {result && (
        <pre className="mt-4 p-4 bg-gray-900 rounded overflow-auto text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}