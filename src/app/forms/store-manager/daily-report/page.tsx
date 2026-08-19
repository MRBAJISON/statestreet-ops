import { getSession } from '@/lib/auth';
import { accessibleStores, groupsForStores, resolveActingStore } from '@/lib/store-access';
import TypedDailyReport from '../TypedDailyReport';

export default async function DailyReportPage() {
  const session = await getSession();
  const stores = session ? await accessibleStores(session.user) : [];
  // The store chosen on the tab strip. Passed down so the form re-fetches when the
  // tab changes, and so the screen and the write always name the same shop.
  const acting = session && stores.length ? await resolveActingStore(session.user) : null;
  // The combined report is offered only when they can open every store in the
  // group, so a total is never shown that is half closed to the reader.
  const groups = stores.length ? await groupsForStores(stores.map((store) => store.id)) : [];
  const group = groups[0] ?? null;

  return (
    <TypedDailyReport
      assignedStore={session?.user.store ?? ''}
      activeStoreId={acting?.id ?? null}
      storeGroup={group ? { id: group.id, code: group.code, name: group.name } : null}
    />
  );
}
