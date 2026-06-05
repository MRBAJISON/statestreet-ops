import type { Entry } from './db/schema';

const num = (v: unknown) => Number(String(v ?? '').replace(/[, ]/g, '')) || 0;

const BRAND_LABELS: Record<string, string> = {
  'boulevard-men': 'Boulevard Men',
  'boulevard-women': 'Boulevard Women',
  dangelo: "D'Angelo",
  woodpeckers: 'Woodpeckers',
  'carbon-shoes': 'Carbon Shoes',
};

export interface FinanceMetrics {
  revenueMtd: number;
  revenueByBrand: { name: string; value: number }[];
  daily: number[];
  labels: string[];
  transactions: number;
  footfall: number;
  itemsSold: number;
  expensesByCategory: { name: string; actual: number }[];
  entryCount: number;
}

function financeMetrics(rows: Entry[]): FinanceMetrics {
  const labels = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const daily = new Array(31).fill(0);
  const brandMap = new Map<string, number>();
  let revenueMtd = 0;
  let transactions = 0;
  let footfall = 0;
  let itemsSold = 0;

  for (const r of rows) {
    if (r.formType !== 'revenue') continue;
    const p = r.payload as Record<string, unknown>;
    const gross = num(p.grossRevenue);
    revenueMtd += gross;
    transactions += num(p.transactions);
    footfall += num(p.footfall);
    itemsSold += num(p.itemsSold);

    const brandKey = String(p.brand ?? '');
    const brand = BRAND_LABELS[brandKey] ?? (brandKey || 'Others');
    brandMap.set(brand, (brandMap.get(brand) ?? 0) + gross);

    const dateVal = p.date ? new Date(String(p.date)) : null;
    const day = dateVal && !isNaN(dateVal.getTime()) ? dateVal.getDate() : 0;
    if (day >= 1 && day <= 31) daily[day - 1] += gross;
  }

  const expMap = new Map<string, number>();
  for (const r of rows) {
    if (r.formType !== 'expenses') continue;
    const p = r.payload as Record<string, unknown>;
    const cat = String(p.category ?? 'other');
    expMap.set(cat, (expMap.get(cat) ?? 0) + num(p.amount));
  }

  return {
    revenueMtd,
    revenueByBrand: [...brandMap].map(([name, value]) => ({ name, value })),
    daily,
    labels,
    transactions,
    footfall,
    itemsSold,
    expensesByCategory: [...expMap].map(([name, actual]) => ({ name, actual })),
    entryCount: rows.length,
  };
}

// Generic aggregation for departments not yet given a bespoke aggregator:
// sums every numeric field per formType so dashboards can surface real totals.
function genericMetrics(rows: Entry[]) {
  const byForm: Record<string, { count: number; sums: Record<string, number> }> = {};
  for (const r of rows) {
    const bucket = (byForm[r.formType] ??= { count: 0, sums: {} });
    bucket.count += 1;
    const p = r.payload as Record<string, unknown>;
    for (const [k, v] of Object.entries(p)) {
      const n = num(v);
      if (n) bucket.sums[k] = (bucket.sums[k] ?? 0) + n;
    }
  }
  return { byForm, entryCount: rows.length };
}

export function computeMetrics(department: string, rows: Entry[]) {
  if (department === 'finance') return { department, ...financeMetrics(rows) };
  return { department, ...genericMetrics(rows) };
}

export type Metrics = ReturnType<typeof computeMetrics>;
