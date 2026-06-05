'use client';

// Client-side live data store for the Finance revenue vertical.
//
// Why client-side (localStorage) rather than a database:
//  - It works identically in local dev AND on Vercel (no server state / no DB to provision).
//  - Updates propagate live: same-tab via an in-memory subscriber set, cross-tab via the
//    browser `storage` event.
//
// The store seeds from the static defaults in data.ts, so the very first server render and
// the first client render match (no hydration mismatch). After mount, the hook hydrates from
// localStorage and subscribes to changes.

import { useEffect, useState } from 'react';
import { financeData } from './data';

const KEY = 'statestreet:financeLive:v1';
const EVENT = 'statestreet:financeLive:update';

// Maps the form's brand <select> values to the display names used in the revenue-by-brand chart.
const BRAND_LABELS: Record<string, string> = {
  'boulevard-men': 'Boulevard Men',
  'boulevard-women': 'Boulevard Women',
  dangelo: "D'Angelo",
  woodpeckers: 'Woodpeckers',
  'carbon-shoes': 'Carbon Shoes',
};

export interface RevenueEntry {
  date?: string;
  store?: string;
  brand?: string; // form value, e.g. "boulevard-men"
  grossRevenue: number;
  discounts?: number;
  netRevenue?: number;
  transactions?: number;
  footfall?: number;
  itemsSold?: number;
}

export interface FinanceLive {
  revenueMtd: number;
  revenueTarget: number;
  daily: number[];
  labels: string[];
  revenueByBrand: { name: string; value: number }[];
  entries: RevenueEntry[];
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// Deterministic seed from the static defaults. Used on the server and as a fallback.
function seed(): FinanceLive {
  return {
    revenueMtd: financeData.revenue.mtd,
    revenueTarget: financeData.revenue.target,
    daily: clone(financeData.revenue.daily),
    labels: clone(financeData.revenue.labels),
    revenueByBrand: clone(financeData.revenueByBrand),
    entries: [],
  };
}

let current: FinanceLive | null = null;
const listeners = new Set<() => void>();

function load(): FinanceLive {
  if (typeof window === 'undefined') return seed();
  if (current) return current;
  let next: FinanceLive;
  try {
    const raw = window.localStorage.getItem(KEY);
    next = raw ? { ...seed(), ...JSON.parse(raw) } : seed();
  } catch {
    next = seed();
  }
  current = next;
  return next;
}

function persist(next: FinanceLive) {
  current = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
    window.dispatchEvent(new CustomEvent(EVENT));
  }
  listeners.forEach((l) => l());
}

export function getFinanceLive(): FinanceLive {
  return load();
}

export function addRevenueEntry(entry: RevenueEntry) {
  const s = clone(load());
  const gross = Number(entry.grossRevenue) || 0;

  // Revenue MTD
  s.revenueMtd += gross;

  // Revenue by brand (fold unknown brands into "Others")
  if (entry.brand) {
    const name = BRAND_LABELS[entry.brand] ?? entry.brand;
    const hit = s.revenueByBrand.find((b) => b.name === name);
    if (hit) {
      hit.value += gross;
    } else {
      const others = s.revenueByBrand.find((b) => b.name === 'Others');
      if (others) others.value += gross;
      else s.revenueByBrand.push({ name, value: gross });
    }
  }

  // Daily series: add to the matching day-of-month bucket, else the last point.
  let idx = s.daily.length - 1;
  if (entry.date) {
    const day = new Date(entry.date).getDate();
    if (day >= 1 && day <= s.daily.length) idx = day - 1;
  }
  s.daily[idx] += gross;

  s.entries.push(entry);
  persist(s);
}

export function addRevenueEntries(entries: RevenueEntry[]) {
  entries.forEach(addRevenueEntry);
}

export function resetFinanceLive() {
  persist(seed());
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// React hook: components read live finance data and re-render on any update.
export function useFinanceLive(): FinanceLive {
  const [state, setState] = useState<FinanceLive>(seed);

  useEffect(() => {
    setState(getFinanceLive());
    const sync = () => setState({ ...getFinanceLive() });
    const unsub = subscribe(sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        current = null; // invalidate cache so it re-reads the other tab's write
        sync();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return state;
}
