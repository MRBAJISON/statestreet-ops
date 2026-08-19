import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { StoreReportPanel } from './StoreReportPanel';

// Roles that may pull a store's formatted PDF, as opposed to the Excel export.
const STORE_REPORT_READERS = new Set(['owner', 'finance', 'commercial', 'operations', 'store-manager']);

export default async function StoreReportsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!STORE_REPORT_READERS.has(session.user.role)) redirect('/dashboard');

  return <StoreReportPanel />;
}
