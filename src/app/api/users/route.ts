import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { asc } from 'drizzle-orm';

const ROLES = ['owner', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'];
const DEPARTMENTS = ['executive', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'];

async function requireOwner() {
  const session = await getSession();
  return session?.user.role === 'owner' ? session : null;
}

// List users (owner only). Never returns password hashes.
export async function GET() {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await db.select().from(users).orderBy(asc(users.id));
  return NextResponse.json({
    users: rows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, department: u.department })),
  });
}

// Create a user (owner only).
export async function POST(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { name, email, password, role, department } = (await req.json()) ?? {};
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }
    if (!ROLES.includes(role) || !DEPARTMENTS.includes(department)) {
      return NextResponse.json({ error: 'Invalid role or department' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    const passwordHash = await hashPassword(String(password));
    const [row] = await db
      .insert(users)
      .values({ name, email: String(email).toLowerCase().trim(), passwordHash, role, department })
      .returning();
    return NextResponse.json({ ok: true, user: { id: row.id, name: row.name, email: row.email, role: row.role, department: row.department } });
  } catch (e) {
    const msg = (e as Error).message;
    if (/unique|duplicate/i.test(msg)) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
