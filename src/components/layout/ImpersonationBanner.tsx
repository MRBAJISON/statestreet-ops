'use client';

import { useEffect, useState } from 'react';

// Shows a banner while the owner is viewing another user's account, with a
// one-click return to the admin (owner) session. Driven by the non-httpOnly
// `impersonating` cookie (display name only).
export default function ImpersonationBanner() {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)impersonating=([^;]+)/);
    setName(m ? decodeURIComponent(m[1]) : null);
  }, []);

  if (!name) return null;

  async function returnToAdmin() {
    setBusy(true);
    try {
      const res = await fetch('/api/impersonate', { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      window.location.href = json.redirect || '/dashboard/admin';
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-3 bg-[#c8a951] text-black text-xs font-medium px-4 py-2">
      <span>👁 Viewing as <span className="font-bold">{name}</span> (impersonation)</span>
      <button onClick={returnToAdmin} disabled={busy}
        className="rounded bg-black/85 text-white px-3 py-1 font-semibold hover:bg-black disabled:opacity-50">
        {busy ? 'Returning…' : 'Return to my admin account'}
      </button>
    </div>
  );
}
