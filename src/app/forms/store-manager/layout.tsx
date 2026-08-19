import { getSession } from '@/lib/auth';
import { accessibleStores, resolveActingStore } from '@/lib/store-access';
import { StoreTabs } from './StoreTabs';

/**
 * The store tab strip sits above every store-manager screen rather than on each
 * form, so the manager chooses once and the choice is visible wherever they are.
 * A single-store manager sees nothing here at all.
 */
export default async function StoreManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const stores = session ? await accessibleStores(session.user) : [];
  const acting = stores.length > 1 && session ? await resolveActingStore(session.user) : stores[0];

  return (
    <>
      {stores.length > 1 && acting ? <StoreTabs stores={stores} activeStoreId={acting.id} /> : null}
      {children}
    </>
  );
}
