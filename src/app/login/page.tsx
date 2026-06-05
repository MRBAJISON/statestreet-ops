'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEMO_ACCOUNTS = [
  { label: 'Owner / CEO', email: 'owner@statestreet.com', password: 'owner123' },
  { label: 'Finance Manager', email: 'finance@statestreet.com', password: 'finance123' },
  { label: 'Commercial Director', email: 'commercial@statestreet.com', password: 'commercial123' },
  { label: 'Marketing Director', email: 'marketing@statestreet.com', password: 'marketing123' },
  { label: 'Operations Manager', email: 'operations@statestreet.com', password: 'operations123' },
  { label: 'Inventory Manager', email: 'inventory@statestreet.com', password: 'inventory123' },
  { label: 'Brand Manager', email: 'brand@statestreet.com', password: 'brand123' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.user.role === 'owner') {
        router.push('/dashboard/executive');
      } else {
        router.push(`/dashboard/${data.user.department}`);
      }
    } else {
      setError('Invalid email or password');
    }
    setLoading(false);
  }

  function quickLogin(acc: typeof DEMO_ACCOUNTS[0]) {
    setEmail(acc.email);
    setPassword(acc.password);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#c8a951] rounded-lg flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold tracking-wider">STATESTREET</h1>
              <p className="text-xs text-[#c8a951] tracking-widest">RETAIL GROUP</p>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-300">Operations Command Center</h2>
          <p className="text-sm text-gray-500 mt-1">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full" placeholder="your@email.com" required />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full" placeholder="Enter password" required />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6">
          <p className="text-xs text-gray-500 text-center mb-3">Quick Login (Demo)</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map(acc => (
              <button key={acc.email} onClick={() => quickLogin(acc)}
                className="bg-[#111] border border-[#2a2a2a] hover:border-[#c8a951]/50 text-xs text-gray-400 hover:text-[#c8a951] py-2 px-3 rounded-lg transition-colors text-left">
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
