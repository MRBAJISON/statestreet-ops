import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { isAudited, recordAudit } from '@/lib/audit';
import { getSession } from '@/lib/auth';
import {
  canReadLegacyDepartment,
  canWriteLegacyForm,
  isKnownLegacyForm,
  isLegacyDepartment,
  legacyEntryBelongsToStore,
} from '@/lib/entry-permissions';

// Persist a form submission. Body: { department, formType, payload }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const { department, formType, payload } = body ?? {};

    if (!isLegacyDepartment(String(department))) {
      return NextResponse.json({ error: `Unknown department "${department}"` }, { status: 400 });
    }
    if (!formType || typeof formType !== 'string') {
      return NextResponse.json({ error: 'formType is required' }, { status: 400 });
    }
    if (typeof payload !== 'object' || payload === null) {
      return NextResponse.json({ error: 'payload object is required' }, { status: 400 });
    }
    if (!isKnownLegacyForm(department, formType)) {
      return NextResponse.json({ error: `Unknown form type "${formType}"` }, { status: 400 });
    }
    if (!canWriteLegacyForm(session.user, department, formType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Drop empty fields and require at least one meaningful value.
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (v !== '' && v !== null && v !== undefined) cleaned[k] = typeof v === 'string' ? v.trim() : v;
    }
    if (Object.keys(cleaned).length === 0) {
      return NextResponse.json({ error: 'Cannot save an empty entry' }, { status: 400 });
    }
    if (
      session.user.role === 'store-manager' &&
      (!session.user.store || !legacyEntryBelongsToStore(department, formType, cleaned, session.user.store))
    ) {
      return NextResponse.json({ error: 'Store ownership fields do not match this account' }, { status: 403 });
    }

    const [row] = await db
      .insert(entries)
      .values({ department, formType, payload: cleaned })
      .returning();
    if (isAudited(String(department), String(formType))) {
      await recordAudit(row.id, 'create', { snapshot: cleaned });
    }
    return NextResponse.json({ ok: true, entry: row });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// List raw entries, optionally filtered by ?department= &formType=
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sp = req.nextUrl.searchParams;
    const department = sp.get('department');
    const formType = sp.get('formType');
    const conds = [];
    if (department) {
      if (!isLegacyDepartment(department)) {
        return NextResponse.json({ error: `Unknown department "${department}"` }, { status: 400 });
      }
      if (!canReadLegacyDepartment(session.user.role, department)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      conds.push(eq(entries.department, department));
    } else if (!['owner', 'finance', 'operations'].includes(session.user.role)) {
      return NextResponse.json({ error: 'A department filter is required' }, { status: 400 });
    }
    if (formType) {
      if (!department || !isKnownLegacyForm(department, formType)) {
        return NextResponse.json({ error: `Unknown form type "${formType}"` }, { status: 400 });
      }
      conds.push(eq(entries.formType, formType));
    }
    // A store manager only ever sees their own store's submissions (the store
    // lives in the payload under store / fromStore / toStore). Other roles
    // oversee all stores, so they are unaffected.
    if (session.user.role === 'store-manager' && session.user.store) {
      const s = session.user.store;
      conds.push(
        sql`(${entries.payload} ->> 'store' = ${s} OR ${entries.payload} ->> 'fromStore' = ${s} OR ${entries.payload} ->> 'toStore' = ${s})`
      );
    }
    const rows = await db
      .select()
      .from(entries)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(entries.createdAt))
      .limit(2000);
    return NextResponse.json({ entries: rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
