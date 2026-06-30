import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { entries, auditLog } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-server';
import { STORES } from '@/lib/config';

export const runtime = 'nodejs';

// The store each audited daily-sales entry was ORIGINALLY created under, read from
// the create snapshot — survives any later store recode, so it can undo a bad move.
async function originalStores(): Promise<{ byEntry: Map<number, string>; createCount: number; withStore: number }> {
  const creates = await db.select().from(auditLog).where(eq(auditLog.action, 'create'));
  const byEntry = new Map<number, string>();
  let withStore = 0;
  for (const a of creates) {
    const snap = (a.changes as { snapshot?: Record<string, unknown> } | null)?.snapshot;
    const s = String(snap?.store ?? '').trim();
    if (s) { withStore += 1; if (!byEntry.has(a.entryId)) byEntry.set(a.entryId, s); }
  }
  return { byEntry, createCount: creates.length, withStore };
}

const labelOf = (code: string, org: Awaited<ReturnType<typeof getOrgSettings>>) =>
  org.stores.find((s) => s.value === code)?.label?.trim() || STORES.find((s) => s.value === code)?.label || code;

// GET: group audited daily-sales records by their ORIGINAL store, and show where
// each group currently sits — so a mis-move (women's sales now under a men's store)
// is obvious. Owner-only.
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }
    const { byEntry: original, createCount, withStore } = await originalStores();
    const rows = await db.select().from(entries);
    const org = await getOrgSettings();
    const cur = new Map(rows.map((r) => [r.id, String((r.payload as Record<string, unknown>).store ?? '').trim()]));

    // origCode -> { total, misplaced, now: {curStore -> count} }
    const groups = new Map<string, { total: number; misplaced: number; now: Map<string, number> }>();
    for (const [entryId, origCode] of original) {
      const curCode = cur.get(entryId);
      if (curCode === undefined) continue; // entry no longer exists
      const g = groups.get(origCode) ?? { total: 0, misplaced: 0, now: new Map() };
      g.total += 1;
      if (curCode !== origCode) g.misplaced += 1;
      g.now.set(curCode, (g.now.get(curCode) ?? 0) + 1);
      groups.set(origCode, g);
    }

    const result = [...groups.entries()]
      .map(([code, g]) => ({
        code,
        label: labelOf(code, org),
        total: g.total,
        misplaced: g.misplaced,
        now: [...g.now.entries()].map(([s, n]) => ({ store: s, label: labelOf(s, org), count: n })).sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.misplaced - a.misplaced);

    return NextResponse.json({ groups: result, stores: org.stores, diag: { auditCreates: createCount, withStore, entriesScanned: rows.length, mapped: original.size } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST: move every audited entry ORIGINALLY created under `from` to store `to`
// (regardless of where it currently sits). Preview unless { apply: true }. Owner-only.
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

    const { byEntry: original } = await originalStores();
    const ids = [...original.entries()].filter(([, code]) => code === from).map(([id]) => id);
    const rows = (await db.select().from(entries)).filter((r) => ids.includes(r.id));

    const org = await getOrgSettings();
    const toLabel = labelOf(to, org);
    const sample = rows.slice(0, 25).map((m) => {
      const p = m.payload as Record<string, unknown>;
      return {
        id: m.id,
        date: String(p.date ?? ''),
        currentStore: labelOf(String(p.store ?? '').trim(), org),
        grossRevenue: Number(p.grossRevenue ?? 0) || 0,
      };
    });

    if (!apply) {
      return NextResponse.json({ ok: true, preview: true, count: rows.length, toLabel, sample });
    }

    let updated = 0;
    for (const m of rows) {
      const p = m.payload as Record<string, unknown>;
      if (String(p.store ?? '').trim() === to) continue; // already correct
      await db.update(entries).set({ payload: { ...p, store: to } }).where(eq(entries.id, m.id));
      updated += 1;
    }
    return NextResponse.json({ ok: true, updated, from, to, toLabel });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
