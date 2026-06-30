import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { getOrgRow, getOrgSettings } from '@/lib/org-server';
import { mergeOrg } from '@/lib/org';
import { STORES } from '@/lib/config';

export const runtime = 'nodejs';

// Store fields an entry can reference a store through.
const STORE_FIELDS = ['store', 'fromStore', 'toStore'] as const;

// GET: find store CODES used in the data that no longer exist in the org store list
// (orphaned by an earlier rename that changed the code). Owner-only.
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }
    const rows = await db.select().from(entries);
    const counts = new Map<string, number>();
    for (const r of rows) {
      const p = r.payload as Record<string, unknown>;
      for (const f of STORE_FIELDS) {
        const v = String(p[f] ?? '').trim();
        if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
    const org = await getOrgSettings();
    const orgVals = new Set(org.stores.map((s) => s.value));
    const orphans = [...counts.entries()]
      .filter(([code]) => !orgVals.has(code))
      .map(([code, count]) => ({ code, count, wasLabel: STORES.find((s) => s.value === code)?.label ?? '' }))
      .sort((a, b) => b.count - a.count);
    return NextResponse.json({ orphans, stores: org.stores });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST: recode a store CODE across every entry (store/fromStore/toStore), reattaching
// orphaned history to a current store. Preview unless { apply: true }. Owner-only.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const from = String(body?.from ?? '').trim();
    const to = String(body?.to ?? '').trim();
    const apply = body?.apply === true;
    if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
    if (from === to) return NextResponse.json({ error: 'from and to are the same' }, { status: 400 });

    const rows = await db.select().from(entries);
    const matches = rows.filter((r) => {
      const p = r.payload as Record<string, unknown>;
      return STORE_FIELDS.some((f) => String(p[f] ?? '').trim() === from);
    });

    const org = await getOrgSettings();
    const toLabel = org.stores.find((s) => s.value === to)?.label ?? to;

    const sample = matches.slice(0, 25).map((m) => {
      const p = m.payload as Record<string, unknown>;
      return {
        id: m.id,
        department: m.department,
        formType: m.formType,
        date: String(p.date ?? ''),
        grossRevenue: Number(p.grossRevenue ?? p.sales ?? 0) || 0,
      };
    });

    if (!apply) {
      return NextResponse.json({ ok: true, preview: true, count: matches.length, toLabel, sample });
    }

    // Apply: rewrite every store field that equals `from` to `to` (amounts untouched).
    let updated = 0;
    for (const m of matches) {
      const p = { ...(m.payload as Record<string, unknown>) };
      let changed = false;
      for (const f of STORE_FIELDS) {
        if (String(p[f] ?? '').trim() === from) { p[f] = to; changed = true; }
      }
      if (changed) { await db.update(entries).set({ payload: p }).where(eq(entries.id, m.id)); updated += 1; }
    }

    // If the orphaned code still lingers in the org store list, drop it so the list and data agree.
    const row = await getOrgRow();
    const current = mergeOrg((row?.payload as Record<string, unknown>) ?? null);
    if (row && current.stores.some((s) => s.value === from)) {
      const stores = current.stores.filter((s) => s.value !== from);
      const next = mergeOrg({ ...current, stores });
      await db.update(entries).set({ payload: next as unknown as Record<string, unknown> }).where(eq(entries.id, row.id));
    }

    return NextResponse.json({ ok: true, updated, from, to, toLabel });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
