'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setToken(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    const res = await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push('/login'), 1500);
    } else {
      setError(json.error || 'Could not reset password');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold tracking-wider">STATESTREET</h1>
          <p className="text-xs text-[#c8a951] tracking-widest">RETAIL GROUP</p>
          <h2 className="text-lg font-semibold text-gray-300 mt-4">Set a new password</h2>
        </div>

        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
          {done ? (
            <p className="text-sm text-green-400 text-center">Password updated. Redirecting to sign in…</p>
          ) : !token ? (
            <p className="text-sm text-red-400 text-center">
              Missing reset token. Please use the link from your email, or{' '}
              <a href="/forgot-password" className="text-[#c8a951] hover:underline">request a new one</a>.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg">{error}</div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">New password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" placeholder="At least 6 characters" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirm password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full" placeholder="Re-enter password" required />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
