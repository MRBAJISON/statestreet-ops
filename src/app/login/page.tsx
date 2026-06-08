'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
      } else if (data.user.role === 'store-manager') {
        router.push('/forms/store-manager');
      } else {
        const seg = data.user.department === 'brand' ? 'brand-health' : data.user.department;
        router.push(`/dashboard/${seg}`);
      }
    } else {
      setError('Invalid email or password');
    }
    setLoading(false);
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

        <form onSubmit={handleLogin} className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-xl p-6 space-y-4">
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

          <div className="text-center">
            <a href="/forgot-password" className="text-xs text-gray-500 hover:text-[#c8a951]">Forgot password?</a>
          </div>
        </form>

        <p className="text-[0.65rem] text-gray-600 text-center mt-4">Authorized personnel only.</p>
      </div>
    </div>
  );
}
