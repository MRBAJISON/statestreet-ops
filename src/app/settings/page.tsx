import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { STORE_LABELS, labelFor } from '@/lib/config';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [u] = await db.select().from(users).where(eq(users.id, Number(session.user.id)));
  const user = {
    name: u?.name ?? session.user.name,
    email: u?.email ?? '',
    role: u?.role ?? session.user.role,
    store: u?.store ? labelFor(STORE_LABELS, u.store) : '',
  };

  const role = u?.role ?? session.user.role;
  return <SettingsClient user={user} isOwner={role === 'owner'} />;
}
