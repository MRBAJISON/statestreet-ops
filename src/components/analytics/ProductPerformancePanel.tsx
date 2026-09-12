'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProductPerformance } from '@/lib/reporting/product-performance';
type Mode = 'best' | 'low' | 'zero' | 'non-moving' | 'aging';
export function ProductPerformanceTable({
  data,
  currency = 'GHS',
}: {
  data: ProductPerformance;
  currency?: string;
}) {
  const [mode, setMode] = useState<Mode>('best'),
    [expanded, setExpanded] = useState(false);
  const candidates =
    mode === 'best'
      ? data.rows.filter((r) => r.unitsSold > 0)
      : mode === 'low'
        ? data.rows
            .filter((r) => r.unitsSold > 0)
            .toSorted((a, b) => a.unitsSold - b.unitsSold)
        : mode === 'zero'
          ? data.rows.filter((r) => r.unitsSold === 0)
          : mode === 'non-moving'
            ? data.rows.filter((r) => r.nonMoving)
            : data.rows;
  const rows = expanded ? candidates : candidates.slice(0, 10);
  return (
    <section className="surface min-w-0 p-5">
      <h2 className="text-base font-semibold">
        Product performance and stock aging
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        System-calculated through {data.asOf}. Risk: 30-day inactivity or age
        over 90 days. Valuation uses the current catalog selling price; exposure
        is not an actual loss.
      </p>
      {data.incompleteReportCount > 0 ? (
        <p className="mt-3 text-sm text-amber-700">
          {data.incompleteReportCount} daily report(s) have incomplete product
          detail. Rankings show recorded product sales only.
        </p>
      ) : null}
      <div className="my-4 flex flex-wrap gap-2">
        {(['best', 'low', 'zero', 'non-moving', 'aging'] as Mode[]).map(
          (value) => (
            <Button
              key={value}
              variant={mode === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setMode(value);
                setExpanded(false);
              }}
            >
              {
                {
                  best: 'Best sellers',
                  low: 'Low sellers',
                  zero: 'No recorded sales',
                  'non-moving': 'Non-moving',
                  aging: 'Stock aging / risk',
                }[value]
              }
            </Button>
          )
        )}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store / product</TableHead>
              <TableHead>Sold / returned</TableHead>
              <TableHead>Recorded value</TableHead>
              <TableHead>Stock / reserved</TableHead>
              <TableHead>Oldest age</TableHead>
              <TableHead>At risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.storeId}:${row.productId}`}>
                <TableCell className="min-w-48 whitespace-normal">
                  <strong>{row.name}</strong>
                  <div className="text-xs text-muted-foreground">
                    {row.storeName} · {row.categoryName} · {row.sku}
                  </div>
                  {!row.historyComplete ? (
                    <div className="text-xs text-amber-700">
                      Limited history
                    </div>
                  ) : null}
                  {row.observationDays < 30 ? (
                    <div className="text-xs text-muted-foreground">
                      Under 30 observed days
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  {row.unitsSold} / {row.returnedUnits}
                </TableCell>
                <TableCell>
                  {currency}{' '}
                  {Number(row.salesValue).toLocaleString('en-GB', {
                    minimumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell>
                  {row.warnings.some((w) => w.startsWith('Historical'))
                    ? 'Unavailable'
                    : `${row.quantity} / ${row.reserved}`}
                </TableCell>
                <TableCell>
                  {row.oldestAge === null ? 'Unknown' : `${row.oldestAge} days`}
                  <div className="text-xs text-muted-foreground">
                    0–30: {row.bands.days0to30} · 31–60: {row.bands.days31to60}
                    <br />
                    61–90: {row.bands.days61to90} · 90+: {row.bands.over90} ·
                    unknown: {row.bands.unknown}
                  </div>
                </TableCell>
                <TableCell>
                  {row.riskQuantity} units
                  <br />
                  {row.riskValue === null
                    ? 'Valuation incomplete'
                    : `${currency} ${Number(row.riskValue).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
                  {row.warnings.length ? (
                    <details className="max-w-60 text-xs text-amber-700">
                      <summary>Data notes</summary>
                      {row.warnings.map((w) => (
                        <p key={w}>{w}</p>
                      ))}
                    </details>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length ? (
              <TableRow>
                <TableCell colSpan={6}>
                  No qualifying recorded products for this view.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      {candidates.length > 10 ? (
        <Button
          variant="ghost"
          className="mt-3"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : `Show more (${candidates.length - 10})`}
        </Button>
      ) : null}
      {data.unmatched.length ? (
        <details className="mt-4 text-sm">
          <summary>
            Unmatched free-text products ({data.unmatched.length})
          </summary>
          {data.unmatched.map((row, index) => (
            <p key={index}>
              {row.name}: {row.units} units, {currency} {row.value} — financial
              totals retain these sales; stock aging cannot link them to a SKU.
            </p>
          ))}
        </details>
      ) : null}
    </section>
  );
}
export function ProductPerformancePanel({
  from,
  to,
  storeId,
  currency = 'GHS',
  approvedOnly = false,
}: {
  from: string;
  to: string;
  storeId?: number;
  currency?: string;
  approvedOnly?: boolean;
}) {
  const [data, setData] = useState<ProductPerformance | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      from,
      to,
      approvedOnly: String(approvedOnly),
    });
    if (storeId) query.set('storeId', String(storeId));
    void fetch(`/api/product-performance?${query}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setData(body);
        setError('');
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [from, to, storeId, approvedOnly]);
  if (error)
    return (
      <section className="surface p-5 text-sm text-destructive">
        {error}
      </section>
    );
  return data ? (
    <ProductPerformanceTable data={data} currency={currency} />
  ) : (
    <section className="surface p-5 text-sm">
      Loading product performance…
    </section>
  );
}
