import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-server';
import { STORES } from '@/lib/config';

export const runtime = 'nodejs';

const num = (v: unknown) => Number(String(v ?? '').replace(/[, ]/g, '')) || 0;
const humanize = (s: string) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const storeOf = (p: Record<string, unknown>) => String(p.store ?? '').trim();

// READ-ONLY. Maps every store CODE seen anywhere (sales, weekly targets, operations
// entries, catalog) so a drifted/merged store is obvious. Owner-only; writes nothing.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }
    const rows = await db.select().from(entries);
    const org = await getOrgSettings();
    const catalog = new Map(org.stores.map((s) => [s.value, s.label]));
    const label = (code: string) => catalog.get(code) || STORES.find((s) => s.value === code)?.label || humanize(code) || '(blank)';

    // Optional drill-in: the daily-sales records for one store code (the "history").
    const recordsFor = (req.nextUrl.searchParams.get('records') || '').trim();
    if (recordsFor) {
      const recs = rows
        .filter((r) => r.department === 'finance' && r.formType === 'revenue' && storeOf(r.payload as Record<string, unknown>) === recordsFor)
        .map((r) => {
          const p = r.payload as Record<string, unknown>;
          return {
            id: r.id,
            date: String(p.date ?? ''),
            category: org.categories.find((c) => c.value === String(p.category ?? '').trim())?.label?.trim() || String(p.category ?? ''),
            gross: num(p.grossRevenue),
            items: num(p.itemsSold),
          };
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      return NextResponse.json({ code: recordsFor, label: label(recordsFor), count: recs.length, records: recs });
    }

    // Aggregate: per store code, counts across the four data sources.
    type Cell = { code: string; sales: number; salesRevenue: number; targets: number; ops: number; inCatalog: boolean };
    const map = new Map<string, Cell>();
    const cell = (code: string): Cell => {
      let c = map.get(code);
      if (!c) { c = { code, sales: 0, salesRevenue: 0, targets: 0, ops: 0, inCatalog: catalog.has(code) }; map.set(code, c); }
      return c;
    };
    // Seed catalog codes so even data-less stores appear.
    for (const s of org.stores) cell(s.value);

    for (const r of rows) {
      const p = r.payload as Record<string, unknown>;
      const code = storeOf(p);
      if (!code) continue;
      if (r.department === 'finance' && r.formType === 'revenue') { const c = cell(code); c.sales += 1; c.salesRevenue += num(p.grossRevenue); }
      else if (r.department === 'commercial' && r.formType === 'weekly-target') cell(code).targets += 1;
      else if (r.department === 'operations') cell(code).ops += 1;
    }

    const stores = [...map.values()]
      .map((c) => ({ ...c, label: label(c.code) }))
      .sort((a, b) => Number(b.inCatalog) - Number(a.inCatalog) || b.sales - a.sales);

    return NextResponse.json({ stores, catalog: org.stores });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
