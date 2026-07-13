import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export default function OperationsDashboardPage() {
  return (
    <AnalyticsDashboard
      view="operations"
      title="Operations Command Center"
      description="Store standards, readiness, incidents, maintenance, and people execution."
    />
  );
}
