import { getSession } from '@/lib/auth';
import { accessibleStores, groupsForStores } from '@/lib/store-access';
import TypedDailyReport from '../TypedDailyReport';

export default async function DailyReportPage() {
  const session = await getSession();
  // A manager covering more than one shop picks which one they are filing for.
  // With a single store the picker never appears.
  const stores = session ? await accessibleStores(session.user) : [];
  // The combined report is offered only when they can open every store in the
  // group, so a total is never shown that is half closed to the reader.
  const groups = stores.length ? await groupsForStores(stores.map((store) => store.id)) : [];
  const group = groups[0] ?? null;

  return (
    <TypedDailyReport
      assignedStore={session?.user.store ?? ''}
      stores={stores}
      storeGroup={group ? { id: group.id, code: group.code, name: group.name } : null}
    />
  );
}
