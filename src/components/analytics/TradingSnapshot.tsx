import { BanknoteArrowUp, ChartNoAxesCombined, CircleDollarSign, ReceiptText, ShoppingCart } from 'lucide-react';
import type { AnalyticsMeta, TradingOverview } from '@/lib/contracts/analytics';
import { MetricRail, SectionHeading } from './DashboardPrimitives';
import { NamedBarChart, RevenueTrendChart, StoreRankingChart } from './Charts';
import { formatCurrency, formatNumber, formatPercent, percentageChange } from './format';

export function TradingSnapshot({ meta, trading, showStores = true }: { meta: AnalyticsMeta; trading: TradingOverview; showStores?: boolean }) {
  const summary = trading.summary;
  return (
    <div className="flex flex-col gap-5">
      <MetricRail
        items={[
          {
            label: 'Net revenue',
            value: formatCurrency(summary.netRevenue, meta.currency),
            previous: percentageChange(summary.netRevenue, summary.previousNetRevenue),
            detail: `Target ${formatCurrency(summary.targetRevenue, meta.currency)}`,
            icon: CircleDollarSign,
            tone: 'blue',
          },
          {
            label: 'Gross profit',
            value: formatCurrency(summary.grossProfit, meta.currency),
            previous: percentageChange(summary.grossProfit, summary.previousGrossProfit),
            detail: `${formatPercent(summary.grossMargin)} margin`,
            icon: BanknoteArrowUp,
            tone: 'teal',
          },
          {
            label: 'Operating profit',
            value: formatCurrency(summary.operatingProfit, meta.currency),
            previous: percentageChange(summary.operatingProfit, summary.previousOperatingProfit),
            detail: `${formatCurrency(summary.expenses, meta.currency)} expenses`,
            icon: ChartNoAxesCombined,
            tone: 'green',
          },
          {
            label: 'Conversion',
            value: formatPercent(summary.conversionRate),
            previous: summary.conversionRate - summary.previousConversionRate,
            detail: `${formatNumber(summary.footfall)} footfall`,
            icon: ShoppingCart,
            tone: 'amber',
          },
          {
            label: 'Average basket',
            value: formatCurrency(summary.averageTransactionValue, meta.currency),
            previous: percentageChange(summary.averageTransactionValue, summary.previousAverageTransactionValue),
            detail: `${formatNumber(summary.unitsSold)} units`,
            icon: ReceiptText,
            tone: 'coral',
          },
        ]}
        className="2xl:grid-cols-5"
      />
      <div className="grid gap-5 xl:grid-cols-12">
        <section className="chart-canvas min-w-0 p-5 xl:col-span-8">
          <SectionHeading title="Revenue pace" description="Approved net revenue, target, and gross profit" />
          <div className="mt-3"><RevenueTrendChart data={trading.trend} currency={meta.currency} /></div>
        </section>
        <section className="surface min-w-0 p-5 xl:col-span-4">
          <SectionHeading title="Payment mix" description="Collected cash sales by method" />
          <div className="mt-3">
            <NamedBarChart data={trading.payments} valueFormatter={(value) => formatCurrency(value, meta.currency)} />
          </div>
        </section>
      </div>
      {showStores ? (
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Store ranking" description="Revenue across active stores in this period" />
          <div className="mt-3"><StoreRankingChart data={trading.stores} currency={meta.currency} /></div>
        </section>
      ) : null}
    </div>
  );
}
