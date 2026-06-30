import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-server';

export const runtime = 'nodejs';

const num = (v: unknown) => Number(String(v ?? '').replace(/[, ]/g, '')) || 0;

// Daily-sales rows (finance/revenue) for one store, with their store + category.
async function salesRows() {
  const rows = await db.select().from(entries);
  return rows.filter((r) => r.department === 'finance' && r.formType === 'revenue');
}

// GET ?store=<code>: category breakdown of that store's daily sales, so the owner can
// pick which categories (the women's products) belong to a different store. Owner-only.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }
    const store = req.nextUrl.searchParams.get('store') || '';
    const org = await getOrgSettings();
    const catLabel = (c: string) => org.categories.find((x) => x.value === c)?.label?.trim() || c || '(none)';
    const rows = (await salesRows()).filter((r) => String((r.payload as Record<string, unknown>).store ?? '').trim() === store);
    const byCat = new Map<string, { count: number; revenue: number }>();
    for (const r of rows) {
      const p = r.payload as Record<string, unknown>;
      const c = String(p.category ?? '').trim();
      const g = byCat.get(c) ?? { count: 0, revenue: 0 };
      g.count += 1; g.revenue += num(p.grossRevenue);
      byCat.set(c, g);
    }
    const categories = [...byCat.entries()]
      .map(([code, g]) => ({ code, label: catLabel(code), count: g.count, revenue: g.revenue }))
      .sort((a, b) => b.revenue - a.revenue);
    return NextResponse.json({ store, total: rows.length, categories, stores: org.stores });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST { fromStore, toStore, categories[], apply }: move daily-sales records under
// fromStore whose category is in the chosen set to toStore. Preview unless apply. Owner-only.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const fromStore = String(body?.fromStore ?? '').trim();
    const toStore = String(body?.toStore ?? '').trim();
    const cats: string[] = Array.isArray(body?.categories) ? body.categories.map((c: unknown) => String(c)) : [];
    const apply = body?.apply === true;
    if (!fromStore || !toStore) return NextResponse.json({ error: 'fromStore and toStore are required' }, { status: 400 });
    if (fromStore === toStore) return NextResponse.json({ error: 'fromStore and toStore are the same' }, { status: 400 });
    if (cats.length === 0) return NextResponse.json({ error: 'Pick at least one category to move' }, { status: 400 });
    const catSet = new Set(cats);

    const matches = (await salesRows()).filter((r) => {
      const p = r.payload as Record<string, unknown>;
      return String(p.store ?? '').trim() === fromStore && catSet.has(String(p.category ?? '').trim());
    });

    const org = await getOrgSettings();
    const toLabel = org.stores.find((s) => s.value === toStore)?.label?.trim() || toStore;
    const sample = matches.slice(0, 25).map((m) => {
      const p = m.payload as Record<string, unknown>;
      return { id: m.id, date: String(p.date ?? ''), category: org.categories.find((c) => c.value === String(p.category ?? '').trim())?.label?.trim() || String(p.category ?? ''), grossRevenue: num(p.grossRevenue) };
    });

    if (!apply) return NextResponse.json({ ok: true, preview: true, count: matches.length, toLabel, sample });

    let updated = 0;
    for (const m of matches) {
      const p = m.payload as Record<string, unknown>;
      await db.update(entries).set({ payload: { ...p, store: toStore } }).where(eq(entries.id, m.id));
      updated += 1;
    }
    return NextResponse.json({ ok: true, updated, toLabel });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
