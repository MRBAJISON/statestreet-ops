import { Boxes, CircleAlert, PackageCheck, SendToBack, ShieldCheck, Truck } from 'lucide-react';
import { ShowMoreButton } from '@/components/ui/show-more-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useExpandable } from '@/hooks/use-expandable';
import type { AnalyticsMeta, InventoryDomain } from '@/lib/contracts/analytics';
import { EmptyPanel, EmptyTableRow, MetricRail, SectionHeading, StatusBadge } from './DashboardPrimitives';
import { HorizontalBarChart, NamedBarChart, ValueTrendChart } from './Charts';
import { formatCurrency, formatNumber, formatPercent } from './format';

export function InventoryOverview({ meta, domain }: { meta: AnalyticsMeta; domain: InventoryDomain }) {
  const stock = useExpandable(domain.stock);
  const replenishmentLines = useExpandable(domain.replenishmentLines);
  const dispositions = useExpandable(domain.dispositions);
  const receiptIssues = useExpandable(domain.receiptIssues);
  const receipts = useExpandable(domain.receipts);
  const transfers = useExpandable(domain.transfers);
  const replenishments = useExpandable(domain.replenishments);

  return (
    <div className="flex flex-col gap-5">
      <MetricRail items={[
        { label: 'Inventory value', value: formatCurrency(domain.summary.inventoryValue, meta.currency), detail: `${formatNumber(domain.summary.unitsOnHand, true)} units`, icon: Boxes, tone: 'blue' },
        { label: 'Stock accuracy', value: formatPercent(domain.summary.stockAccuracy), detail: 'Latest stock counts', icon: ShieldCheck, tone: 'green' },
        { label: 'Dead stock', value: formatPercent(domain.summary.deadStockPercent), detail: `${formatCurrency(domain.movement.deadStockValue, meta.currency)} at risk`, icon: CircleAlert, tone: 'coral' },
        { label: 'Low-stock lines', value: String(domain.summary.lowStockProducts), detail: 'At or below threshold', icon: CircleAlert, tone: 'amber' },
        { label: 'Open replenishments', value: String(domain.summary.openReplenishments), detail: 'Requested, approved, or ordered', icon: SendToBack, tone: 'teal' },
        { label: 'In transit', value: String(domain.summary.inTransitTransfers), detail: 'Stock transfers', icon: Truck, tone: 'blue' },
      ]} />

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-5">
          <SectionHeading title="Inventory Value" description="Current stock value by brand" />
          <HorizontalBarChart data={domain.valueByBrand} valueFormatter={(value) => formatCurrency(value, meta.currency)} />
        </section>
        <section className="surface min-w-0 p-5 xl:col-span-7">
          <SectionHeading title="Goods Receipt Value" description="Received stock value recorded over the selected period" />
          <ValueTrendChart data={domain.receiptValueTrend} valueFormatter={(value) => formatCurrency(value, meta.currency)} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Stock Accuracy" description="Distribution of latest count variances" />
          <NamedBarChart data={domain.accuracyDistribution} />
        </section>
        <section className="surface p-5">
          <SectionHeading title="Stock Movement" description="Received, transferred, counted, and dead-stock value" />
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6">
            <div><p className="data-label">Units received</p><p className="mt-1 text-xl font-semibold">{formatNumber(domain.movement.receivedUnits)}</p><p className="text-xs text-muted-foreground">{formatCurrency(domain.movement.receivedValue, meta.currency)}</p></div>
            <div><p className="data-label">Units transferred</p><p className="mt-1 text-xl font-semibold">{formatNumber(domain.movement.transferredUnits)}</p><p className="text-xs text-muted-foreground">{formatCurrency(domain.movement.transferredValue, meta.currency)}</p></div>
            <div><p className="data-label">Counted value</p><p className="mt-1 text-xl font-semibold">{formatCurrency(domain.movement.countedValue, meta.currency)}</p></div>
            <div><p className="data-label">Dead-stock value</p><p className="mt-1 text-xl font-semibold text-destructive">{formatCurrency(domain.movement.deadStockValue, meta.currency)}</p></div>
          </div>
        </section>
      </div>

      <section className="surface min-w-0 overflow-hidden">
        <div className="p-5 pb-3"><SectionHeading title="Inventory Position" description="Current ledger balance, value, and movement risk" /></div>
        <Table>
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Last movement</TableHead><TableHead>Risk</TableHead></TableRow></TableHeader>
          <TableBody>{domain.stock.length ? stock.visible.map((item) => <TableRow key={`${item.productId}-${item.storeName}`}><TableCell><span className="block max-w-56 truncate font-medium">{item.productName}</span><span className="text-xs text-muted-foreground">{item.sku}</span></TableCell><TableCell className="text-muted-foreground">{item.storeName}</TableCell><TableCell className="text-right font-medium">{item.units}</TableCell><TableCell className="text-right">{formatCurrency(item.value, meta.currency)}</TableCell><TableCell className="text-muted-foreground">{item.lastMovement ?? 'No movement'}</TableCell><TableCell><StatusBadge value={item.risk} /></TableCell></TableRow>) : <EmptyTableRow colSpan={6} message="No inventory position is available for this period" />}</TableBody>
        </Table>
        <ShowMoreButton expanded={stock.expanded} hiddenCount={stock.hiddenCount} canExpand={stock.canExpand} onClick={stock.toggle} />
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-4">
          <SectionHeading title="Supplier Performance" description="Received units by supplier" />
          <HorizontalBarChart data={domain.supplierPerformance} />
        </section>
        <section className="surface min-w-0 overflow-hidden xl:col-span-8">
          <div className="p-5 pb-3"><SectionHeading title="Suppliers & Replenishment" description="Open replenishment lines with stock position and urgency" /></div>
          <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Store</TableHead><TableHead className="text-right">Current</TableHead><TableHead className="text-right">Reorder</TableHead><TableHead>Urgency</TableHead></TableRow></TableHeader><TableBody>{domain.replenishmentLines.length ? replenishmentLines.visible.map((item) => <TableRow key={item.id}><TableCell><span className="block max-w-56 truncate font-medium">{item.productName}</span><span className="text-xs text-muted-foreground">{item.sku}</span></TableCell><TableCell>{item.storeName}</TableCell><TableCell className="text-right">{item.currentStock}</TableCell><TableCell className="text-right font-medium">{item.reorderQuantity}</TableCell><TableCell><StatusBadge value={item.urgency} /></TableCell></TableRow>) : <EmptyTableRow colSpan={5} message="No replenishment lines require attention" />}</TableBody></Table>
          <ShowMoreButton expanded={replenishmentLines.expanded} hiddenCount={replenishmentLines.hiddenCount} canExpand={replenishmentLines.canExpand} onClick={replenishmentLines.toggle} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 overflow-hidden xl:col-span-8">
          <div className="p-5 pb-3"><SectionHeading title="Dead-Stock Actions" description="Disposition decisions, justification, value, and workflow status" /></div>
          <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Store</TableHead><TableHead>Action</TableHead><TableHead>Justification</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{domain.dispositions.length ? dispositions.visible.map((item) => <TableRow key={item.id}><TableCell><span className="block max-w-48 truncate font-medium">{item.productName}</span><span className="text-xs text-muted-foreground">{item.categoryName}</span></TableCell><TableCell>{item.storeName}</TableCell><TableCell className="capitalize">{item.action}</TableCell><TableCell className="max-w-56 truncate text-muted-foreground">{item.justification}</TableCell><TableCell className="text-right">{formatCurrency(item.value, meta.currency)}</TableCell><TableCell><StatusBadge value={item.status} /></TableCell></TableRow>) : <EmptyTableRow colSpan={6} message="No dead-stock actions recorded" />}</TableBody></Table>
          <ShowMoreButton expanded={dispositions.expanded} hiddenCount={dispositions.hiddenCount} canExpand={dispositions.canExpand} onClick={dispositions.toggle} />
        </section>
        <section className="surface min-w-0 p-5 xl:col-span-4">
          <SectionHeading title="Disposition Mix" description="Dead-stock actions by decision type" />
          <NamedBarChart data={domain.dispositionActions} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-4">
          <SectionHeading title="Goods-Receipt Quality" description="Condition recorded at receiving" />
          <NamedBarChart data={domain.receiptQuality} />
        </section>
        <section className="surface p-5 xl:col-span-8">
          <SectionHeading title="Goods-Receipt Issues" description="Supplier discrepancies and condition exceptions" />
          {domain.receiptIssues.length ? <><div className="mt-4 divide-y">{receiptIssues.visible.map((item) => <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-3/10 text-destructive"><PackageCheck className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.supplierName} / {item.storeName}</span><span className="block truncate text-xs text-muted-foreground">{item.date} / {item.discrepancy}</span></span><StatusBadge value={item.condition} /></div>)}</div><ShowMoreButton expanded={receiptIssues.expanded} hiddenCount={receiptIssues.hiddenCount} canExpand={receiptIssues.canExpand} onClick={receiptIssues.toggle} /></> : <EmptyPanel message="No goods-receipt issues recorded" />}
        </section>
      </div>

      <section className="surface p-5">
        <Tabs defaultValue="receipts">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><SectionHeading title="Stock Transfers & Recent Entries" description="Recent receipts, transfers, and replenishment requests" /><TabsList><TabsTrigger value="receipts">Receipts</TabsTrigger><TabsTrigger value="transfers">Transfers</TabsTrigger><TabsTrigger value="replenishments">Replenishment</TabsTrigger></TabsList></div>
          <TabsContent value="receipts" className="mt-4">{domain.receipts.length ? <><div className="divide-y">{receipts.visible.map((item) => <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary"><PackageCheck className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.supplierName} / {item.storeName}</span><span className="text-xs text-muted-foreground">{item.date} / {item.units} units / {item.poNumber ?? 'No PO'}</span></span><span className="text-sm font-semibold">{formatCurrency(item.value, meta.currency)}</span></div>)}</div><ShowMoreButton expanded={receipts.expanded} hiddenCount={receipts.hiddenCount} canExpand={receipts.canExpand} onClick={receipts.toggle} /></> : <EmptyPanel message="No goods receipts recorded for this period" />}</TabsContent>
          <TabsContent value="transfers" className="mt-4">{domain.transfers.length ? <><div className="divide-y">{transfers.visible.map((item) => <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 items-center justify-center rounded-md bg-chart-4/10 text-chart-4"><Truck className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.fromStore} to {item.toStore}</span><span className="text-xs text-muted-foreground">{item.date} / {item.units} units</span></span><StatusBadge value={item.status} /></div>)}</div><ShowMoreButton expanded={transfers.expanded} hiddenCount={transfers.hiddenCount} canExpand={transfers.canExpand} onClick={transfers.toggle} /></> : <EmptyPanel message="No stock transfers recorded for this period" />}</TabsContent>
          <TabsContent value="replenishments" className="mt-4">{domain.replenishments.length ? <><div className="divide-y">{replenishments.visible.map((item) => <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 items-center justify-center rounded-md bg-chart-2/12 text-amber-800"><SendToBack className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.storeName}</span><span className="text-xs text-muted-foreground">{item.date} / {item.lines} lines / {item.units} units</span></span><StatusBadge value={item.status} /></div>)}</div><ShowMoreButton expanded={replenishments.expanded} hiddenCount={replenishments.hiddenCount} canExpand={replenishments.canExpand} onClick={replenishments.toggle} /></> : <EmptyPanel message="No replenishment requests recorded for this period" />}</TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
