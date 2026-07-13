import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export default function FinanceDashboardPage() {
  return (
    <AnalyticsDashboard
      view="finance"
      title="Finance Command Center"
      description="Revenue, margin, cash position, expenses, and working capital in one reconciled view."
    />
  );
}
