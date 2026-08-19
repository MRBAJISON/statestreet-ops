import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { accessibleStores, allTradingStores, groupsForStores } from '@/lib/store-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Who may pick a store to pull a report for. A store manager gets their own
// stores from the same endpoint, so the report panel has one source of stores
// rather than a branch per role.
const REPORT_READERS = new Set(['owner', 'finance', 'commercial', 'operations', 'store-manager']);
const ALL_STORE_ROLES = new Set(['owner', 'finance', 'commercial', 'operations']);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!REPORT_READERS.has(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const readsEveryStore = ALL_STORE_ROLES.has(session.user.role);
  const stores = readsEveryStore ? await allTradingStores() : await accessibleStores(session.user);
  // Only groups the reader can open every member of, same rule as the cluster PDF.
  const groups = await groupsForStores(stores.map((store) => store.id));

  return NextResponse.json({
    stores,
    groups: groups.map((group) => ({ id: group.id, code: group.code, name: group.name, storeIds: group.storeIds })),
    // The whole-business report is for the roles that read across stores; a
    // manager sees their own shops and any cluster they fully cover.
    canReadGroupWide: readsEveryStore,
  });
}
