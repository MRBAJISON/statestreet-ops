import { NextRequest, NextResponse } from 'next/server';
import { asc, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { homeDepartmentForRole } from '@/lib/access';
import { createUserSchema } from '@/lib/contracts/user';
import { formatContractError } from '@/lib/contracts/shared';
import { db } from '@/lib/db';
import { auditEvents, stores } from '@/lib/db/foundation-schema';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/password';
import { databaseErrorCode, sessionUserId } from '@/lib/server-errors';
import { getOrgSettings } from '@/lib/org-server';

async function requireOwner() {
  const session = await getSession();
  return session?.user.role === 'owner' ? session : null;
}

async function validateStoreAssignment(role: string, store: string | null): Promise<string | null> {
  if (role !== 'store-manager') return null;
  if (!store) return 'A store is required for a store manager';
  const [row] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(sql`${stores.code} = ${store} and ${stores.active} = true and ${stores.type} = 'store'`)
    .limit(1);
  return row ? null : 'The selected retail store is not available';
}

export async function GET() {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await db.select().from(users).orderBy(asc(users.name), asc(users.id));
  return NextResponse.json({
    users: rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      store: user.store ?? '',
      active: user.active,
      updatedAt: user.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const parsed = createUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
    }
    const input = parsed.data;
    const department = homeDepartmentForRole(input.role);
    if (input.department && input.department !== department) {
      return NextResponse.json({ error: `Department must be ${department} for this role` }, { status: 400 });
    }
    const store = input.role === 'store-manager' ? input.store?.trim() || null : null;
    const storeError = await validateStoreAssignment(input.role, store);
    if (storeError) return NextResponse.json({ error: storeError }, { status: 400 });
    const minPasswordLength = (await getOrgSettings()).security.minPasswordLen;
    if (input.password.length < minPasswordLength) {
      return NextResponse.json({ error: `Password must be at least ${minPasswordLength} characters` }, { status: 400 });
    }
    const actorUserId = sessionUserId(session.user.id);
    const passwordHash = await hashPassword(input.password);
    const result = await db.execute(sql`
      with new_user as (
        insert into users (name, email, password_hash, role, department, store)
        values (${input.name}, ${input.email}, ${passwordHash}, ${input.role}, ${department}, ${store})
        returning *
      ), new_audit as (
        insert into ${auditEvents} (entity_type, entity_id, action, actor_user_id, after)
        select 'user', created.id, 'create', ${actorUserId}, to_jsonb(created) - 'password_hash'
        from new_user created
        returning id
      )
      select id, name, email, role, department, store, active, updated_at from new_user
    `);
    const [user] = result.rows as Array<Record<string, unknown>>;
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    if (databaseErrorCode(error) === '23505') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
