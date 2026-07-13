import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-server';
import UserAdmin from './UserAdmin';

// Owner-only user administration.
export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.user.role !== 'owner') redirect('/dashboard/executive');
  const org = await getOrgSettings();
  return (
    <UserAdmin
      currentUserId={Number(session.user.id)}
      passwordMinLength={org.security.minPasswordLen}
      stores={org.stores}
    />
  );
}
