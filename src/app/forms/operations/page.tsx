import OperationsForms from './OperationsForms';
import { getSession } from '@/lib/auth';

export default async function OperationsFormsPage() {
  const session = await getSession();
  const managerName = session?.user.name ?? '';
  return <OperationsForms managerName={managerName} />;
}
