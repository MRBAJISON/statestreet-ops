'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold tracking-wider">STATESTREET</h1>
          <p className="text-xs text-[#c8a951] tracking-widest">RETAIL GROUP</p>
          <h2 className="text-lg font-semibold text-gray-300 mt-4">Reset your password</h2>
        </div>

        <div className="bg-[var(--c-card)] border border-[var(--c-border)] rounded-xl p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-300">
                If an account exists for <span className="text-[var(--c-fg)]">{email}</span>, a reset link has been sent.
                The link expires in 1 hour.
              </p>
              <a href="/login" className="inline-block text-sm text-[#c8a951] hover:underline">Back to sign in</a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-500">Enter your email and we&apos;ll send you a reset link.</p>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" placeholder="your@email.com" required />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <div className="text-center">
                <a href="/login" className="text-xs text-gray-500 hover:text-[#c8a951]">Back to sign in</a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
