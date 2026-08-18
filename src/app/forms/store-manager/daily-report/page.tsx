import { getSession } from '@/lib/auth';
import { accessibleStores } from '@/lib/store-access';
import TypedDailyReport from '../TypedDailyReport';

export default async function DailyReportPage() {
  const session = await getSession();
  // A manager covering more than one shop picks which one they are filing for.
  // With a single store the picker never appears.
  const stores = session ? await accessibleStores(session.user) : [];
  return <TypedDailyReport assignedStore={session?.user.store ?? ''} stores={stores} />;
}
