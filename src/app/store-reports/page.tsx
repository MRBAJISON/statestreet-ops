import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { StoreReportPanel } from './StoreReportPanel';

// Commercial, who reads across every store, plus the owner. Store managers are not
// here: they download their own store's reports from the daily report screen. The
// underlying endpoints still permit the other roles, so nothing is taken away —
// this is about who gets the page in their sidebar.
const STORE_REPORT_READERS = new Set(['owner', 'commercial']);

export default async function StoreReportsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!STORE_REPORT_READERS.has(session.user.role)) redirect('/dashboard');

  return <StoreReportPanel />;
}
