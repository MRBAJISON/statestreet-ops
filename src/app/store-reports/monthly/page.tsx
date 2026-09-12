import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { MonthlyReviewWorkspace } from '@/components/reports/MonthlyReviewWorkspace';
export default async function MonthlyPerformancePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (
    !['owner', 'finance', 'commercial', 'operations'].includes(
      session.user.role
    )
  )
    redirect('/dashboard');
  return <MonthlyReviewWorkspace readOnly />;
}
