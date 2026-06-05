import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';

// Persist a form submission. Body: { department, formType, payload }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { department, formType, payload } = body ?? {};
    if (!department || !formType || typeof payload !== 'object' || payload === null) {
      return NextResponse.json(
        { error: 'department, formType, and payload are required' },
        { status: 400 }
      );
    }
    const [row] = await db
      .insert(entries)
      .values({ department, formType, payload })
      .returning();
    return NextResponse.json({ ok: true, entry: row });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// List raw entries, optionally filtered by ?department= &formType=
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const department = sp.get('department');
    const formType = sp.get('formType');
    const conds = [];
    if (department) conds.push(eq(entries.department, department));
    if (formType) conds.push(eq(entries.formType, formType));
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
