import { redirect } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { getSession } from '@/lib/auth';

export default async function StoreReportsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <AppShell
      userName={session.user.name}
      userRole={session.user.role}
      departments={session.departments}
    >
      {children}
    </AppShell>
  );
}
