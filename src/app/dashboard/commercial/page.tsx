import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export default function CommercialDashboardPage() {
  return (
    <AnalyticsDashboard
      view="commercial"
      title="Commercial Command Center"
      description="Sales pace, store execution, product velocity, and customer conversion."
    />
  );
}
