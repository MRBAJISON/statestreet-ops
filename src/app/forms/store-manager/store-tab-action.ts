'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { ACTING_STORE_COOKIE, accessibleStores } from '@/lib/store-access';

/**
 * Switches the store this manager is recording against.
 *
 * The cookie only remembers the choice; every write re-checks it server-side, so
 * a tampered cookie buys nothing. Rejecting an unassigned store here as well
 * means the tab strip and the writes can never disagree about which shop is live.
 */
export async function selectActingStore(storeId: number): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const allowed = await accessibleStores(session.user);
  if (!allowed.some((store) => store.id === storeId)) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTING_STORE_COOKIE, String(storeId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  // Every store-manager screen is scoped by the acting store, so they all need
  // re-rendering rather than just the one the tab was clicked on.
  revalidatePath('/forms', 'layout');
  revalidatePath('/dashboard', 'layout');
}
