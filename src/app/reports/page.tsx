import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canIncludeCustomerContacts, getExportScopeConfig } from '@/lib/export';
import ReportsClient from './ReportsClient';
import { StoreReportPanel } from './StoreReportPanel';

// Roles that may pull a store's formatted PDF, as opposed to the Excel export.
const STORE_REPORT_READERS = new Set(['owner', 'finance', 'commercial', 'operations', 'store-manager']);

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const config = getExportScopeConfig(session.user.role);
  if (!config) redirect('/dashboard');

  return (
    <div className="flex flex-col gap-5">
      <ReportsClient
        scope={config.scope}
        label={config.label}
        description={config.description}
        includeCustomerContacts={canIncludeCustomerContacts(session.user.role, config.scope)}
      />
      {STORE_REPORT_READERS.has(session.user.role) ? <StoreReportPanel /> : null}
    </div>
  );
}
