'use client';

import { useEffect, useState } from 'react';
import { Eye, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ImpersonationBanner() {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)impersonating=([^;]+)/);
    setName(match ? decodeURIComponent(match[1]) : null);
  }, []);

  if (!name) return null;

  async function returnToAdmin() {
    setBusy(true);
    try {
      const response = await fetch('/api/impersonate', { method: 'DELETE' });
      const payload = (await response.json().catch(() => ({}))) as { redirect?: string };
      window.location.href = payload.redirect || '/dashboard/admin';
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-50 flex min-h-11 flex-wrap items-center justify-center gap-3 border-b border-chart-2/25 bg-chart-2/15 px-4 py-2 text-xs text-foreground">
      <span className="flex min-w-0 items-center gap-2">
        <Eye className="size-4 shrink-0 text-chart-2" aria-hidden="true" />
        <span className="truncate">Viewing as <strong>{name}</strong></span>
      </span>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={returnToAdmin}>
        {busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
        Return to admin
      </Button>
    </div>
  );
}
