import InventoryForms from './InventoryForms';
import { getSession } from '@/lib/auth';

export default async function InventoryFormsPage() {
  const session = await getSession();
  const managerName = session?.user.name ?? '';
  return <InventoryForms managerName={managerName} />;
}
