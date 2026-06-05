'use client';

import { useCallback, useEffect, useState } from 'react';

// Collect a form's named fields and POST them as one entry.
export async function submitEntry(
  department: string,
  formType: string,
  form: HTMLFormElement
) {
  const fd = new FormData(form);
  const payload: Record<string, unknown> = {};
  fd.forEach((v, k) => {
    payload[k] = typeof v === 'string' ? v : '';
  });
  return postEntry(department, formType, payload);
}

export async function postEntry(
  department: string,
  formType: string,
  payload: Record<string, unknown>
) {
  const res = await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ department, formType, payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to save');
  return json;
}

export async function postEntries(
  department: string,
  formType: string,
  payloads: Record<string, unknown>[]
) {
  for (const payload of payloads) await postEntry(department, formType, payload);
}

// Live metrics hook: fetches a department's aggregated metrics and exposes a refresh().
export function useMetrics<T = Record<string, unknown>>(department: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/metrics/${department}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [department]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
