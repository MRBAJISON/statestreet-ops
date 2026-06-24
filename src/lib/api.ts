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

export async function deleteEntry(id: number) {
  const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to delete');
}

export async function updateEntry(id: number, payload: Record<string, unknown>) {
  const res = await fetch(`/api/entries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to update');
}

export async function postEntries(
  department: string,
  formType: string,
  payloads: Record<string, unknown>[]
) {
  for (const payload of payloads) await postEntry(department, formType, payload);
}

export interface EntryRow {
  id: number;
  department: string;
  formType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

// Recent raw entries for a department (for "recent activity" tables).
export function useEntries(department: string, limit = 8) {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/entries?department=${department}`, { cache: 'no-store' });
      const json = await res.json();
      setEntries(Array.isArray(json.entries) ? json.entries.slice(0, limit) : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [department, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, loading, refresh };
}

export type Period = 'day' | 'week' | 'mtd' | 'ytd' | 'all';

// Live metrics hook: fetches a department's aggregated metrics for a period (+ optional anchor date).
export function useMetrics<T = Record<string, unknown>>(
  department: string,
  period: Period = 'mtd',
  date = '',
  store = '',
  reviewed = false
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const q = `period=${period}${date ? `&date=${date}` : ''}${store ? `&store=${encodeURIComponent(store)}` : ''}${reviewed ? '&reviewed=1' : ''}`;
      const res = await fetch(`/api/metrics/${department}?${q}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [department, period, date, store, reviewed]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
