import { and, eq, inArray } from 'drizzle-orm';
import type { AppUser } from './auth';
import { db } from './db';
import { storeGroupMembers, storeGroups, stores, userStores } from './db/foundation-schema';

// Which stores a user may act on.
//
// users.store still names a manager's primary store and is left as the source of
// truth for every workflow that is single-store by nature. This adds the second
// case: a manager covering more than one shop, held in user_stores. Only the daily
// report and its downstream reports consult it, so no existing permission path
// changes behaviour for a manager with a single store.

export interface AccessibleStore {
  id: number;
  code: string;
  name: string;
}

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

/** Names for a set of store ids, for report headers and per-store splits. */
export async function storeNames(storeIds: number[]): Promise<Map<number, string>> {
  if (!storeIds.length) return new Map();
  const rows = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .where(inArray(stores.id, storeIds));
  return new Map(rows.map((row) => [row.id, row.name]));
}
