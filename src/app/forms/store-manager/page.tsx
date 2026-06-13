import StoreManagerForms from './StoreManagerForms';
import { getSession } from '@/lib/auth';

export default async function StoreManagerFormsPage() {
  const session = await getSession();
  const assignedStore = session?.user.store ?? '';
  const managerName = session?.user.name ?? '';

  return <StoreManagerForms managerName={managerName} assignedStore={assignedStore} />;
}
