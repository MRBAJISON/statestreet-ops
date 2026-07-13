import { getSession } from '@/lib/auth';
import TypedDailyReport from '../TypedDailyReport';

export default async function DailyReportPage() {
  const session = await getSession();
  return <TypedDailyReport assignedStore={session?.user.store ?? ''} />;
}
