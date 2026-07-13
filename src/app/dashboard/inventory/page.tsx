import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export default function InventoryDashboardPage() {
  return (
    <AnalyticsDashboard
      view="inventory"
      title="Inventory Command Center"
      description="Stock position, value at risk, receipts, transfers, and replenishment status."
    />
  );
}
