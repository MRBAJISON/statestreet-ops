import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen">
      <Sidebar userName={session.user.name} userRole={session.user.role} departments={session.departments} />
      <main className="overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
