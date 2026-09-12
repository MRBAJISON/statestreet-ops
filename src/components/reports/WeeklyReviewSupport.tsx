'use client';
import { useEffect, useState } from 'react';
import type { StorePeriodReport } from '@/lib/reporting/store-period-report';
import type { ProductPerformance } from '@/lib/reporting/product-performance';
import { ProductPerformanceTable } from '@/components/analytics/ProductPerformancePanel';
export function WeeklyReviewSupport({ weekEnd }: { weekEnd: string }) {
  const [data, setData] = useState<{
      report: StorePeriodReport | null;
      performance: ProductPerformance;
      categories: { id: number; name: string }[];
      currency: string;
    } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/weekly-reviews/support?weekEnd=${weekEnd}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setData(body);
        setError('');
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [weekEnd]);
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm">Loading weekly evidence…</p>;
  return (
    <details className="surface p-5">
      <summary className="cursor-pointer font-semibold">
        System-calculated weekly figures and supporting evidence
      </summary>
      <div className="mt-4 space-y-4">
        {data.report ? (
          <>
            <p className="text-sm">
              {data.report.range.label}: {data.currency}{' '}
              {data.report.totals.netRevenue.toFixed(2)} sales / {data.currency}{' '}
              {data.report.target.toFixed(2)} target ·{' '}
              {data.report.totals.unitsSold} units ·{' '}
              {data.report.totals.transactions} transactions.
            </p>
            {data.report.categories.map((c) => (
              <p key={c.categoryId} className="text-sm">
                {data.categories.find(
                  (category) => category.id === c.categoryId
                )?.name ?? `Category ${c.categoryId}`}
                : {c.unitsSold} units · {data.currency}{' '}
                {c.netRevenue.toFixed(2)} net sales
              </p>
            ))}
            <details className="text-sm">
              <summary>Customer requests and daily observations</summary>
              {data.report.customerRequests.map((c) => (
                <p key={c.id}>
                  {c.interest} · {c.fulfillmentStatus ?? 'Not recorded'}
                  {c.stockGapQuantity
                    ? ` · ${c.stockGapQuantity} requested`
                    : ''}
                </p>
              ))}
              {data.report.notes.map((n) => (
                <div className="mt-2" key={n.date}>
                  <strong>{n.date}</strong>
                  <p>{n.notes}</p>
                  <p>{n.staffPerformanceNote}</p>
                  <p>{n.closingFacilityStatus}</p>
                </div>
              ))}
            </details>
          </>
        ) : (
          <p>No daily reports recorded for this week yet.</p>
        )}
        <ProductPerformanceTable
          data={data.performance}
          currency={data.currency}
        />
      </div>
    </details>
  );
}
