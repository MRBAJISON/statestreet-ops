import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export default function StoreManagerDashboardPage() {
  return (
    <AnalyticsDashboard
      view="store"
      title="Store Manager Command Center"
      description="Today’s trading picture, recent submissions, stock risks, and weekly commitments."
    />
  );
}
