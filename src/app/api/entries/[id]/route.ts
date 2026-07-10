import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isAudited, recordAudit, diffPayload } from '@/lib/audit';
import { getSession } from '@/lib/auth';
import { canMutateLegacyEntry } from '@/lib/entry-permissions';

function parseId(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Update an entry's payload.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const numId = parseId(id);
    if (!numId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const body = await req.json();
    const { payload } = body ?? {};
    if (typeof payload !== 'object' || payload === null) {
      return NextResponse.json({ error: 'payload object required' }, { status: 400 });
    }
    const [before] = await db.select().from(entries).where(eq(entries.id, numId));
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canMutateLegacyEntry(session.user, before, 'update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!canMutateLegacyEntry(session.user, { ...before, payload }, 'update')) {
      return NextResponse.json({ error: 'Store ownership fields cannot be changed' }, { status: 403 });
    }
    const [row] = await db.update(entries).set({ payload }).where(eq(entries.id, numId)).returning();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (before && isAudited(before.department, before.formType)) {
      await recordAudit(numId, 'update', { fields: diffPayload(before.payload, payload) });
    }
    return NextResponse.json({ ok: true, entry: row });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Delete an entry. Store managers may edit their entries but not delete them.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const numId = parseId(id);
    if (!numId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const [before] = await db.select().from(entries).where(eq(entries.id, numId));
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canMutateLegacyEntry(session.user, before, 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const [row] = await db.delete(entries).where(eq(entries.id, numId)).returning();
    if (isAudited(row.department, row.formType)) {
      await recordAudit(numId, 'delete', { snapshot: row.payload });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
