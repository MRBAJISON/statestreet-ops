import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AppShell from '@/components/layout/AppShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return <AppShell userName={session.user.name} userRole={session.user.role} departments={session.departments}>{children}</AppShell>;
}
