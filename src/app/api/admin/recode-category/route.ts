import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { getOrgRow, getOrgSettings } from '@/lib/org-server';
import { mergeOrg } from '@/lib/org';

export const runtime = 'nodejs';

// Owner-only: rename a category CODE across every entry that uses it (and in the
// org category list), without touching amounts. Used to fix bad codes like a
// first-letter "d"/"a" that should be "dresses"/"accessories".
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

    // Every entry whose category code === from.
    const matches = await db
      .select()
      .from(entries)
      .where(sql`(${entries.payload} ->> 'category') = ${from}`);

    const org = await getOrgSettings();
    const orgHas = org.categories.some((c) => c.value === from);
    const orgLabel = org.categories.find((c) => c.value === from)?.label ?? '';

    const sample = matches.slice(0, 25).map((m) => {
      const p = m.payload as Record<string, unknown>;
      return {
        id: m.id,
        department: m.department,
        formType: m.formType,
        store: String(p.store ?? ''),
        date: String(p.date ?? ''),
        grossRevenue: Number(p.grossRevenue ?? p.sales ?? 0) || 0,
      };
    });

    if (!apply) {
      return NextResponse.json({ ok: true, preview: true, count: matches.length, orgHas, orgLabel, sample });
    }

    // Apply: retag each matching entry's category (amounts untouched).
    let updated = 0;
    for (const m of matches) {
      const p = { ...(m.payload as Record<string, unknown>), category: to };
      await db.update(entries).set({ payload: p }).where(eq(entries.id, m.id));
      updated += 1;
    }

    // Fix the code in the org category list too, so the list and data agree.
    let orgUpdated = false;
    if (orgHas) {
      const row = await getOrgRow();
      const current = mergeOrg((row?.payload as Record<string, unknown>) ?? null);
      const categories = current.categories.map((c) => (c.value === from ? { ...c, value: to } : c));
      const next = mergeOrg({ ...current, categories });
      if (row) {
        await db.update(entries).set({ payload: next as unknown as Record<string, unknown> }).where(eq(entries.id, row.id));
        orgUpdated = true;
      }
    }

    return NextResponse.json({ ok: true, updated, orgUpdated, from, to });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
