import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { getOrgSettings } from '@/lib/org-server';
import { eq } from 'drizzle-orm';

const ROLES = ['owner', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand', 'store-manager'];
const DEPARTMENTS = ['executive', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'];

async function requireOwner() {
  const session = await getSession();
  return session?.user.role === 'owner' ? session : null;
}

// Update a user (owner only): name, role, department, and/or password reset.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const numId = Number((await params).id);
    if (!Number.isInteger(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const body = (await req.json()) ?? {};
    const patch: Record<string, unknown> = {};
    if (body.name) patch.name = String(body.name);
    if (body.role) {
      if (!ROLES.includes(body.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      patch.role = body.role;
    }
    if (body.department) {
      if (!DEPARTMENTS.includes(body.department)) return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
      patch.department = body.department;
    }
    if ('store' in body) {
      const s = body.store;
      const storeValues = (await getOrgSettings()).stores.map((o) => o.value);
      if (s !== '' && s !== null && !storeValues.includes(String(s))) {
        return NextResponse.json({ error: 'Invalid store' }, { status: 400 });
      }
      patch.store = s || null;
    }
    if (body.password) {
      if (String(body.password).length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      patch.passwordHash = await hashPassword(String(body.password));
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    const [row] = await db.update(users).set(patch).where(eq(users.id, numId)).returning();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, user: { id: row.id, name: row.name, email: row.email, role: row.role, department: row.department, store: row.store ?? '' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Delete a user (owner only; cannot delete yourself).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const numId = Number((await params).id);
    if (!Number.isInteger(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    if (String(numId) === session.user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }
    const [row] = await db.delete(users).where(eq(users.id, numId)).returning();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
