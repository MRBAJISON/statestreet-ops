import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (session.user.role === 'owner') {
    redirect('/dashboard/executive');
  }

  const dept = session.user.department === 'brand' ? 'brand-health' : session.user.department;
  redirect(`/dashboard/${dept}`);
}
