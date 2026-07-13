import { NextRequest, NextResponse } from 'next/server';
import { and, count, eq, ne, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { homeDepartmentForRole, isUserRole } from '@/lib/access';
import { updateUserSchema } from '@/lib/contracts/user';
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

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function validRetailStore(store: string | null): Promise<boolean> {
  if (!store) return false;
  const [row] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(sql`${stores.code} = ${store} and ${stores.active} = true and ${stores.type} = 'store'`)
    .limit(1);
  return Boolean(row);
}

async function hasAnotherActiveOwner(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.role, 'owner'), eq(users.active, true), ne(users.id, userId)));
  return Number(row?.value ?? 0) > 0;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const userId = parseId((await params).id);
    if (!userId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existing || !isUserRole(existing.role)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const parsed = updateUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
    }
    const input = parsed.data;
    if (input.password) {
      const minPasswordLength = (await getOrgSettings()).security.minPasswordLen;
      if (input.password.length < minPasswordLength) {
        return NextResponse.json({ error: `Password must be at least ${minPasswordLength} characters` }, { status: 400 });
      }
    }
    const role = input.role ?? existing.role;
    const department = homeDepartmentForRole(role);
    if (input.department && input.department !== department) {
      return NextResponse.json({ error: `Department must be ${department} for this role` }, { status: 400 });
    }
    const requestedStore = input.store === undefined ? existing.store : input.store?.trim() || null;
    const store = role === 'store-manager' ? requestedStore : null;
    if (role === 'store-manager' && !(await validRetailStore(store))) {
      return NextResponse.json({ error: 'An active retail store is required for a store manager' }, { status: 400 });
    }
    const active = input.active ?? existing.active;
    if (String(userId) === session.user.id && !active) {
      return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
    }
    if (existing.role === 'owner' && existing.active && (!active || role !== 'owner') && !(await hasAnotherActiveOwner(userId))) {
      return NextResponse.json({ error: 'At least one active owner account is required' }, { status: 409 });
    }
    const passwordHash = input.password ? await hashPassword(input.password) : existing.passwordHash;
    const securityChanged =
      role !== existing.role ||
      department !== existing.department ||
      store !== existing.store ||
      active !== existing.active ||
      input.email !== undefined ||
      input.password !== undefined;
    const sessionVersion = existing.sessionVersion + (securityChanged ? 1 : 0);
    const actorUserId = sessionUserId(session.user.id);
    const removingActiveOwner = existing.role === 'owner' && existing.active && (!active || role !== 'owner');
    const result = await db.execute(sql`
      with owner_guard as materialized (
        select pg_advisory_xact_lock(734883221) as locked
      ), before_user as materialized (
        select target.*
        from users target
        cross join owner_guard
        where target.id = ${userId}
        for update of target
      ), updated_user as (
        update users target
        set name = ${input.name ?? existing.name},
            email = ${input.email ?? existing.email},
            password_hash = ${passwordHash},
            role = ${role},
            department = ${department},
            store = ${store},
            active = ${active},
            session_version = ${sessionVersion},
            updated_at = now()
        from before_user before
        where target.id = before.id
          and date_trunc('milliseconds', before.updated_at) = date_trunc('milliseconds', ${input.expectedUpdatedAt}::timestamptz)
          and (
            ${!removingActiveOwner}
            or exists (
              select 1 from users other
              where other.role = 'owner' and other.active = true and other.id <> before.id
            )
          )
        returning target.*
      ), new_audit as (
        insert into ${auditEvents} (entity_type, entity_id, action, actor_user_id, before, after)
        select 'user', updated.id, 'update', ${actorUserId},
               to_jsonb(before) - 'password_hash', to_jsonb(updated) - 'password_hash'
        from updated_user updated
        join before_user before on before.id = updated.id
        returning id
      )
      select id, name, email, role, department, store, active, updated_at from updated_user
    `);
    const [user] = result.rows as Array<Record<string, unknown>>;
    if (!user) {
      if (removingActiveOwner && !(await hasAnotherActiveOwner(userId))) {
        return NextResponse.json({ error: 'At least one active owner account is required' }, { status: 409 });
      }
      return NextResponse.json({ error: 'This account changed after you opened it. Refresh and try again.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    if (databaseErrorCode(error) === '23505') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const userId = parseId((await params).id);
  if (!userId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  if (String(userId) === session.user.id) {
    return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
  }
  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!existing.active) return NextResponse.json({ ok: true });
  if (existing.role === 'owner' && !(await hasAnotherActiveOwner(userId))) {
    return NextResponse.json({ error: 'At least one active owner account is required' }, { status: 409 });
  }
  const actorUserId = sessionUserId(session.user.id);
  const result = await db.execute(sql`
    with owner_guard as materialized (
      select pg_advisory_xact_lock(734883221) as locked
    ), before_user as materialized (
      select target.*
      from users target
      cross join owner_guard
      where target.id = ${userId} and target.active = true
      for update of target
    ), updated_user as (
      update users target
      set active = false, session_version = target.session_version + 1, updated_at = now()
      from before_user before
      where target.id = before.id
        and (
          before.role <> 'owner'
          or exists (
            select 1 from users other
            where other.role = 'owner' and other.active = true and other.id <> before.id
          )
        )
      returning target.*
    ), new_audit as (
      insert into ${auditEvents} (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'user', updated.id, 'update', ${actorUserId},
             to_jsonb(before) - 'password_hash', to_jsonb(updated) - 'password_hash',
             jsonb_build_object('reason', 'deactivated')
      from updated_user updated
      join before_user before on before.id = updated.id
      returning id
    )
    select id from updated_user
  `);
  if (!result.rows.length) {
    if (existing.role === 'owner') {
      return NextResponse.json({ error: 'At least one active owner account is required' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
