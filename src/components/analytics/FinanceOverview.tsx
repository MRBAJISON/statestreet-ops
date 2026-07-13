import { CircleDollarSign, Clock3, Landmark, ReceiptText, Scale, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AnalyticsMeta, FinanceDomain, TradingOverview } from '@/lib/contracts/analytics';
import { Attainment, MetricRail, SectionHeading, StatusBadge } from './DashboardPrimitives';
import { CashFlowChart, ComparisonBarChart, HorizontalBarChart, NamedBarChart } from './Charts';
import { formatCurrency, formatNumber, formatPercent } from './format';
import { TradingSnapshot } from './TradingSnapshot';

export function FinanceOverview({ meta, trading, domain }: { meta: AnalyticsMeta; trading: TradingOverview; domain: FinanceDomain }) {
  const ratios = [
    ['Gross margin', domain.profitability.grossMargin],
    ['Operating margin', domain.profitability.operatingMargin],
    ['Net margin', domain.profitability.netMargin],
    ['ROCE', domain.profitability.roce],
    ['ROI', domain.profitability.roi],
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <TradingSnapshot meta={meta} trading={trading} />

      <MetricRail
        items={[
          { label: 'Net profit', value: formatCurrency(domain.profitability.netProfit, meta.currency), detail: `${formatPercent(domain.profitability.netMargin)} margin`, icon: TrendingUp, tone: 'green' },
          { label: 'Cash position', value: formatCurrency(domain.cash.position, meta.currency), detail: `${domain.cash.runwayDays} runway days`, icon: Landmark, tone: 'blue' },
          { label: 'Period budget', value: formatCurrency(domain.budget.budget, meta.currency), detail: 'Prorated annual budget', icon: Scale, tone: 'amber' },
          { label: 'Actual spend', value: formatCurrency(domain.budget.actual, meta.currency), detail: formatPercent(domain.budget.utilization), icon: ReceiptText, tone: 'coral' },
          { label: 'Budget variance', value: formatCurrency(domain.budget.variance, meta.currency), detail: domain.budget.variance >= 0 ? 'Available' : 'Over budget', icon: CircleDollarSign, tone: domain.budget.variance >= 0 ? 'green' : 'coral' },
          { label: 'Open debtors', value: formatCurrency(domain.workingCapital.debtors, meta.currency), detail: `${formatCurrency(domain.workingCapital.overdue, meta.currency)} overdue`, icon: Clock3, tone: 'teal' },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface p-5 xl:col-span-4">
          <SectionHeading title="Profitability" description="MTD margin quality and return ratios" />
          <div className="mt-4 divide-y">
            {ratios.map(([label, value]) => <div key={label} className="flex justify-between py-3 first:pt-0 last:pb-0"><span className="text-sm text-muted-foreground">{label}</span><span className="font-semibold">{formatPercent(value)}</span></div>)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
            <div><p className="data-label">Capital employed</p><p className="mt-1 font-semibold">{formatCurrency(domain.profitability.capitalEmployed, meta.currency)}</p></div>
            <div><p className="data-label">Investment</p><p className="mt-1 font-semibold">{formatCurrency(domain.profitability.investment, meta.currency)}</p></div>
          </div>
        </section>
        <section className="surface min-w-0 p-5 xl:col-span-8">
          <SectionHeading title="Cash Flow" description="Approved sales, typed expenses, and manual cash activity" />
          <div className="mt-3"><CashFlowChart data={domain.cashTrend} currency={meta.currency} /></div>
          <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-center">
            <div><p className="data-label">Inflow</p><p className="mt-1 font-semibold text-primary">{formatCurrency(domain.cash.inflow, meta.currency)}</p></div>
            <div><p className="data-label">Outflow</p><p className="mt-1 font-semibold text-destructive">{formatCurrency(domain.cash.outflow, meta.currency)}</p></div>
            <div><p className="data-label">Net cash flow</p><p className="mt-1 font-semibold">{formatCurrency(domain.cash.net, meta.currency)}</p></div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Expense Control" description="Budget against actual by expense category" />
          <ComparisonBarChart data={domain.expenseCategories.slice(0, 8).map((item) => ({ name: item.name, primary: item.actual, secondary: item.budget }))} primaryLabel="Actual" secondaryLabel="Budget" valueFormatter={(value) => formatCurrency(value, meta.currency)} />
          <Attainment value={domain.budget.utilization} label="Budget used" />
        </section>
        <section className="surface min-w-0 overflow-hidden">
          <div className="p-5 pb-3"><SectionHeading title="Overspend Register" description="Exceptions with a recorded business reason" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>{domain.overspend.slice(0, 8).map((item) => <TableRow key={item.id}><TableCell>{item.date}</TableCell><TableCell className="font-medium">{item.category}</TableCell><TableCell className="max-w-64 truncate text-muted-foreground">{item.reason}</TableCell><TableCell className="text-right">{formatCurrency(item.amount, meta.currency)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 overflow-hidden xl:col-span-7">
          <div className="p-5 pb-3"><SectionHeading title="Store P&L" description="Revenue, operating cost, and contribution by store" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Store</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Expenses</TableHead><TableHead className="text-right">Profit</TableHead></TableRow></TableHeader>
            <TableBody>{domain.storePnl.map((store) => <TableRow key={store.id}><TableCell className="font-medium">{store.name}</TableCell><TableCell className="text-right">{formatCurrency(store.revenue, meta.currency)}</TableCell><TableCell className="text-right">{formatCurrency(store.expenses, meta.currency)}</TableCell><TableCell className={`text-right font-semibold ${store.profit < 0 ? 'text-destructive' : 'text-primary'}`}>{formatCurrency(store.profit, meta.currency)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </section>
        <section className="surface min-w-0 p-5 xl:col-span-5">
          <SectionHeading title="Debtor Aging" description="Outstanding debtor balance by age" />
          <HorizontalBarChart data={domain.debtorAging} valueFormatter={(value) => formatCurrency(value, meta.currency)} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface min-w-0 overflow-hidden">
          <div className="p-5 pb-3"><SectionHeading title="Weekly & Period Forecast" description="Latest revenue, profit, and cash outlook" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Period</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Net profit</TableHead><TableHead className="text-right">Cash</TableHead><TableHead>Confidence</TableHead></TableRow></TableHeader>
            <TableBody>{domain.forecasts.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.periodStart} to {item.periodEnd}</TableCell><TableCell className="text-right">{formatCurrency(item.revenue, meta.currency)}</TableCell><TableCell className="text-right">{formatCurrency(item.netProfit, meta.currency)}</TableCell><TableCell className="text-right">{formatCurrency(item.cashBalance, meta.currency)}</TableCell><TableCell><StatusBadge value={item.confidence} /></TableCell></TableRow>)}</TableBody>
          </Table>
        </section>
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Cash Accounts" description="Current balance by account" />
          <NamedBarChart data={domain.cashAccounts.map((account) => ({ name: account.name, value: account.balance }))} valueFormatter={(value) => formatCurrency(value, meta.currency)} />
        </section>
      </div>

      <section className="surface min-w-0 overflow-hidden">
        <div className="p-5 pb-3"><SectionHeading title="Daily Sales by Store" description="Approved reporting coverage for the selected period" /></div>
        <Table>
          <TableHeader><TableRow><TableHead>Store</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Transactions</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Reports</TableHead></TableRow></TableHeader>
          <TableBody>{domain.dailySalesByStore.map((store) => <TableRow key={store.id}><TableCell className="font-medium">{store.name}</TableCell><TableCell className="text-right">{formatCurrency(store.revenue, meta.currency)}</TableCell><TableCell className="text-right">{formatNumber(store.transactions)}</TableCell><TableCell className="text-right">{formatNumber(store.units)}</TableCell><TableCell className="text-right">{store.reports}</TableCell></TableRow>)}</TableBody>
        </Table>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface min-w-0 overflow-hidden">
          <div className="p-5 pb-3"><SectionHeading title="Store Ledger & Working Capital" description="Open debtors and creditors ordered by due date" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Type</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Open</TableHead></TableRow></TableHeader>
            <TableBody>{domain.workingCapital.items.slice(0, 10).map((item) => <TableRow key={item.id}><TableCell className="max-w-44 truncate font-medium">{item.entity}</TableCell><TableCell><StatusBadge value={item.type} /></TableCell><TableCell className="text-muted-foreground">{item.dueDate ?? 'Not set'}</TableCell><TableCell className="text-right font-medium">{formatCurrency(item.amount, meta.currency)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </section>
        <section className="surface p-5">
          <SectionHeading title="Recent Entries & Approval Queue" description="Submitted daily reports waiting for Finance" />
          {domain.pendingReports.length ? <div className="mt-4 divide-y">{domain.pendingReports.slice(0, 10).map((report) => <div key={report.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"><span className="flex size-8 items-center justify-center rounded-md bg-chart-2/12 text-amber-800"><ReceiptText className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{report.storeName}</span><span className="block text-xs text-muted-foreground">{report.businessDate}</span></span><StatusBadge value="submitted" /></div>)}</div> : <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">No reports are waiting for approval.</div>}
        </section>
      </div>
    </div>
  );
}
