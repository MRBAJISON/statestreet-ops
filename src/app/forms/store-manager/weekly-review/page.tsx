import WeeklyReview from '../WeeklyReview';
import { getSession } from '@/lib/auth';
import { resolveActingStore } from '@/lib/store-access';

export default async function WeeklyReviewPage() {
  const session = await getSession();
  if (!session || session.user.role !== 'store-manager') return null;
  const store = await resolveActingStore(session.user);
  // A store switch must discard the previous store's local draft and reload its evidence.
  return <WeeklyReview key={store.id} storeName={store.name} />;
}
