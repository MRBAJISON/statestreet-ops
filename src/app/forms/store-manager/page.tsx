'use client';

import WeeklyReview from './WeeklyReview';
import RecentEntries from '@/components/ui/RecentEntries';

export default function StoreManagerFormsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Store Manager Weekly Review</h1>
        <p className="text-sm text-gray-500 mt-1">Complete your weekly merchandise-to-money review. Results feed the Commercial and Executive dashboards.</p>
      </div>

      <WeeklyReview />

      <div className="mt-8 max-w-4xl">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Your Submissions</h2>
        <RecentEntries department="commercial" />
      </div>
    </div>
  );
}
