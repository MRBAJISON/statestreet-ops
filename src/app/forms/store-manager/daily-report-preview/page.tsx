import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import TypedDailyReport from '../TypedDailyReport';

export default async function DailyReportPreviewPage() {
  if (process.env.ENABLE_TYPED_DAILY_REPORT_PREVIEW !== 'true') notFound();

  const session = await getSession();
  const assignedStore = session?.user.store ?? '';

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Daily Report Preview</h1>
        <p className="mt-1 text-sm text-amber-300">Data foundation preview. Live dashboards remain on the current form.</p>
      </div>
      <TypedDailyReport assignedStore={assignedStore} />
    </div>
  );
}
