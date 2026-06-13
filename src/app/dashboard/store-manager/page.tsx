import StoreDashboard from './StoreDashboard';
import { getSession } from '@/lib/auth';

export default async function StoreManagerDashboardPage() {
  const session = await getSession();
  const assignedStore = session?.user.store ?? '';
  const managerName = session?.user.name ?? '';
  return <StoreDashboard assignedStore={assignedStore} managerName={managerName} />;
}
