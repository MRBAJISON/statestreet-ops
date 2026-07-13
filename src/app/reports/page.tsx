import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canIncludeCustomerContacts, getExportScopeConfig } from '@/lib/export';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const config = getExportScopeConfig(session.user.role);
  if (!config) redirect('/dashboard');

  return (
    <ReportsClient
      scope={config.scope}
      label={config.label}
      description={config.description}
      includeCustomerContacts={canIncludeCustomerContacts(session.user.role, config.scope)}
    />
  );
}
