import { cookies } from 'next/headers';
import { and, eq, inArray } from 'drizzle-orm';
import type { AppUser } from './auth';
import { db } from './db';
import { storeGroupMembers, storeGroups, stores, userStores } from './db/foundation-schema';
import { HttpError } from './server-errors';

// Which stores a user may act on, and which one they are acting as right now.
//
// A manager covering more than one shop picks a store from the tab strip and every
// workflow they then record belongs to that store. The choice is held in a cookie
// so it survives moving between forms, and is re-checked server-side on each use —
// a cookie is a convenience, never the authority on what someone may write to.
//
// For a manager with a single store this changes nothing: there is no tab strip,
// and the one store on their account is always the acting store.

export interface AccessibleStore {
  id: number;
  code: string;
  name: string;
}

/** Cookie holding the acting store id. Convenience only; never trusted on its own. */
export const ACTING_STORE_COOKIE = 'acting-store';

/**
 * The trading stores this user may file for, in name order.
 *
 * Falls back to the single users.store code when no membership rows exist, so an
 * account that predates the membership table keeps working untouched.
 */
export async function accessibleStores(user: AppUser): Promise<AccessibleStore[]> {
  const columns = { id: stores.id, code: stores.code, name: stores.name };
  const active = and(eq(stores.type, 'store'), eq(stores.active, true));

  const userId = Number(user.id);
  if (Number.isSafeInteger(userId) && userId > 0) {
    const rows = await db
      .select(columns)
      .from(userStores)
      .innerJoin(stores, eq(stores.id, userStores.storeId))
      .where(and(eq(userStores.userId, userId), active))
      .orderBy(stores.name);
    if (rows.length) return rows;
  }

  if (!user.store) return [];
  return db.select(columns).from(stores).where(and(eq(stores.code, user.store), active)).orderBy(stores.name);
}

/** True when the user may act on this store. */
export async function canUseStore(user: AppUser, storeId: number): Promise<boolean> {
  const allowed = await accessibleStores(user);
  return allowed.some((store) => store.id === storeId);
}

/**
 * The store this user is acting as.
 *
 * Order: an explicitly requested store, then the tab they last selected, then
 * their only store. Anything not assigned to them is refused rather than quietly
 * falling back — a manager who somehow asks for another shop should be told no,
 * not silently given their own, which would file the entry under the wrong name.
 */
export async function resolveActingStore(
  user: AppUser,
  requestedStoreId?: number
): Promise<AccessibleStore> {
  const allowed = await accessibleStores(user);
  if (!allowed.length) throw new HttpError(403, 'No store is assigned to this account');

  if (requestedStoreId) {
    const match = allowed.find((store) => store.id === requestedStoreId);
    if (!match) throw new HttpError(403, 'That store is not assigned to this account');
    return match;
  }

  if (allowed.length === 1) return allowed[0];

  const cookieStore = await cookies();
  const selected = Number(cookieStore.get(ACTING_STORE_COOKIE)?.value ?? '');
  const chosen = Number.isSafeInteger(selected)
    ? allowed.find((store) => store.id === selected)
    : undefined;
  // No valid selection yet: the first store by name, which is what the tab strip
  // shows as active, so the screen and the write always agree.
  return chosen ?? allowed[0];
}

export interface StoreGroupSummary {
  id: number;
  code: string;
  name: string;
  storeIds: number[];
}

/**
 * Store groups fully covered by the given stores.
 *
 * "Fully covered" matters: a combined report is only honest when the reader can
 * act on every member. Someone who can see one shop of a pair gets the single
 * store report, not a group total half of which they cannot open.
 */
export async function groupsForStores(storeIds: number[]): Promise<StoreGroupSummary[]> {
  if (!storeIds.length) return [];
  const rows = await db
    .select({
      id: storeGroups.id,
      code: storeGroups.code,
      name: storeGroups.name,
      storeId: storeGroupMembers.storeId,
    })
    .from(storeGroups)
    .innerJoin(storeGroupMembers, eq(storeGroupMembers.storeGroupId, storeGroups.id))
    .where(eq(storeGroups.active, true));

  const grouped = new Map<number, StoreGroupSummary>();
  for (const row of rows) {
    const existing = grouped.get(row.id);
    if (existing) existing.storeIds.push(row.storeId);
    else grouped.set(row.id, { id: row.id, code: row.code, name: row.name, storeIds: [row.storeId] });
  }
  const accessible = new Set(storeIds);
  return [...grouped.values()].filter((group) => group.storeIds.every((id) => accessible.has(id)));
}

/** Member store ids of a group, or an empty list when it does not exist. */
export async function storesInGroup(groupId: number): Promise<number[]> {
  const rows = await db
    .select({ storeId: storeGroupMembers.storeId })
    .from(storeGroupMembers)
    .innerJoin(stores, eq(stores.id, storeGroupMembers.storeId))
    .where(and(eq(storeGroupMembers.storeGroupId, groupId), eq(stores.active, true)));
  return rows.map((row) => row.storeId);
}

/**
 * Every active trading store, for the roles that read across the business.
 *
 * Warehouses and offices are excluded: they file no daily report, so including
 * them would put permanent empty rows in the group-wide split.
 */
export async function allTradingStores(): Promise<AccessibleStore[]> {
  return db
    .select({ id: stores.id, code: stores.code, name: stores.name })
    .from(stores)
    .where(and(eq(stores.type, 'store'), eq(stores.active, true)))
    .orderBy(stores.name);
}

/** Names for a set of store ids, for report headers and per-store splits. */
export async function storeNames(storeIds: number[]): Promise<Map<number, string>> {
  if (!storeIds.length) return new Map();
  const rows = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .where(inArray(stores.id, storeIds));
  return new Map(rows.map((row) => [row.id, row.name]));
}
