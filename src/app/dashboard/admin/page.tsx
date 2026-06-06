import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import UserAdmin from './UserAdmin';

// Owner-only user administration.
export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.user.role !== 'owner') redirect('/dashboard/executive');
  return <UserAdmin />;
}
