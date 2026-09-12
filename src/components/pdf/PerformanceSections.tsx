import { StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { WeeklyReviewContext } from '@/lib/reporting/weekly-review-context';
import type { ProductPerformance } from '@/lib/reporting/product-performance';
export const performanceStyles = StyleSheet.create({
  section: { marginBottom: 14 },
  title: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#C65D17',
    marginBottom: 7,
  },
  paragraph: {
    fontSize: 9,
    lineHeight: 1.45,
    marginBottom: 5,
    color: '#243447',
  },
  head: { flexDirection: 'row', backgroundColor: '#14283F', padding: 7 },
  headCell: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    paddingRight: 6,
  },
  row: {
    flexDirection: 'row',
    padding: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D7DEE6',
    backgroundColor: '#FFFFFF',
  },
  cell: { flex: 1, fontSize: 8, lineHeight: 1.35, paddingRight: 5 },
  note: { fontSize: 8, color: '#64748B', marginTop: 4, lineHeight: 1.4 },
});
export const pdfText = (value: unknown) =>
  String(value ?? '')
    .replace(/[–—‑]/g, '-')
    .replace(/₵/g, 'GHS')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
export function PerformanceSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={performanceStyles.section}>
      <Text style={performanceStyles.title} minPresenceAhead={90}>
        {pdfText(title)}
      </Text>
      {children}
    </View>
  );
}
export function PerformanceTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number | null)[][];
}) {
  // Bounded blocks repeat table headings and keep ordinary rows together.
  // Exceptionally long narrative cells may wrap rather than exceed an A4 page.
  const blocks = rows.length
    ? Array.from({ length: Math.ceil(rows.length / 6) }, (_, index) =>
        rows.slice(index * 6, index * 6 + 6)
      )
    : [[]];
  return (
    <View>
      {blocks.map((block, blockIndex) => (
        <View
          key={blockIndex}
          wrap={block.some((row) =>
            row.some((value) => String(value ?? '').length > 400)
          )}
        >
          <View style={performanceStyles.head}>
            {headers.map((header, i) => (
              <Text style={performanceStyles.headCell} key={i}>
                {pdfText(header)}
              </Text>
            ))}
          </View>
          {block.length ? (
            block.map((row, i) => (
              <View
                key={i}
                style={performanceStyles.row}
                wrap={row.some((value) => String(value ?? '').length > 900)}
              >
                {row.map((value, j) => (
                  <Text key={j} style={performanceStyles.cell}>
                    {pdfText(value ?? 'Not available')}
                  </Text>
                ))}
              </View>
            ))
          ) : (
            <Text style={performanceStyles.note}>No qualifying records.</Text>
          )}
        </View>
      ))}
    </View>
  );
}
export function ProductPerformancePdf({
  data,
  currency,
}: {
  data: ProductPerformance;
  currency: string;
}) {
  const best = data.rows.filter((r) => r.unitsSold > 0).slice(0, 10),
    low = data.rows
      .filter((r) => r.unitsSold > 0)
      .toSorted((a, b) => a.unitsSold - b.unitsSold)
      .slice(0, 10),
    idle = data.rows.filter((r) => r.nonMoving).slice(0, 10);
  return (
    <>
      <PerformanceSection title="Product performance — system calculated">
        <Text style={performanceStyles.note}>
          Rankings use recorded product units and values. Category discounts are
          not assigned to individual products. Returned units are shown
          separately. Up to ten products per ranking are shown here; the full
          list is available on the dashboard and in the monthly appendix.
        </Text>
        {data.incompleteReportCount ? (
          <Text style={performanceStyles.note}>
            {data.incompleteReportCount} report(s) have incomplete product
            detail; rankings represent recorded product coverage only.
          </Text>
        ) : null}
        {(
          [
            ['Best sellers', best],
            ['Low positive sellers', low],
            ['Non-moving stock', idle],
          ] as const
        ).map(([title, rows]) => (
          <View key={title} style={{ marginTop: 8 }}>
            <Text style={performanceStyles.paragraph}>{title}</Text>
            <PerformanceTable
              headers={[
                'Store / category',
                'Product / SKU',
                'Sold / returned',
                `Recorded value (${currency})`,
              ]}
              rows={rows.map((r) => [
                `${r.storeName} / ${r.categoryName}`,
                `${r.name} / ${r.sku}${r.observationDays < 30 ? ' - under 30 observed days' : ''}${!r.historyComplete ? ' - limited history' : ''}`,
                `${r.unitsSold} / ${r.returnedUnits}`,
                Number(r.salesValue).toFixed(2),
              ])}
            />
          </View>
        ))}
        {data.unmatched.length ? (
          <Text style={performanceStyles.note}>
            Unmatched products:{' '}
            {data.unmatched
              .map((r) => `${r.name} (${r.units} units)`)
              .join('; ')}
            . Included in financial figures but not SKU stock aging.
          </Text>
        ) : null}
      </PerformanceSection>
      <PerformanceSection title="Stock aging and stock at risk">
        <Text style={performanceStyles.note}>
          At {data.asOf}. FIFO allocation; imported opening stock uses the
          assigned 1 July 2026 receipt date, not a verified delivery date. Risk:
          30-day sales inactivity OR age over 90 days, counted once. Valuation
          uses current catalog selling price, not cost or actual loss.
        </Text>
        <PerformanceTable
          headers={[
            'Store',
            'Stock / reserved',
            'Age bands: 0–30 / 31–60 / 61–90 / 90+ / unknown',
            `At-risk units / ${currency}`,
          ]}
          rows={[...new Set(data.rows.map((r) => r.storeId))].map((storeId) => {
            const rows = data.rows.filter((r) => r.storeId === storeId);
            const total = (fn: (r: (typeof rows)[number]) => number) =>
              rows.reduce((sum, r) => sum + fn(r), 0);
            return [
              rows[0].storeName,
              rows.some((r) =>
                r.warnings.some((w) => w.startsWith('Historical'))
              )
                ? 'Historical stock incomplete'
                : `${total((r) => r.quantity)} / ${total((r) => r.reserved)}`,
              `${total((r) => r.bands.days0to30)} / ${total((r) => r.bands.days31to60)} / ${total((r) => r.bands.days61to90)} / ${total((r) => r.bands.over90)} / ${total((r) => r.bands.unknown)}`,
              `${total((r) => r.riskQuantity)} / ${rows.some((r) => r.riskValue === null || !r.historyComplete) ? 'incomplete assessment' : total((r) => Number(r.riskValue)).toFixed(2)}`,
            ];
          })}
        />
        {data.rows.some((r) => r.warnings.length) ? (
          <Text style={performanceStyles.note}>
            Data limitations:{' '}
            {[...new Set(data.rows.flatMap((r) => r.warnings))].join(' ')}
          </Text>
        ) : null}
      </PerformanceSection>
    </>
  );
}
export function ProductStockAppendix({
  data,
  currency,
}: {
  data: ProductPerformance;
  currency: string;
}) {
  return (
    <PerformanceSection title="Appendix: complete product sales and stock analysis">
      <Text style={performanceStyles.note}>
        Recorded units, product-line value and FIFO quantities. Missing
        history/price means incomplete assessment, not zero exposure. Current
        catalog selling-price valuation; assigned opening receipt dates are
        estimates.
      </Text>
      <PerformanceTable
        headers={[
          'Store / product',
          'Sold / value',
          'Stock / reserved',
          'Age: 0–30 / 31–60 / 61–90 / 90+ / unknown',
          'Risk units / value',
        ]}
        rows={data.rows.map((r) => [
          `${r.storeName}: ${r.name} (${r.sku})${r.observationDays < 30 ? ' - under 30 observed days' : ''}${!r.historyComplete ? ' - limited history' : ''}`,
          `${r.unitsSold} / ${currency} ${Number(r.salesValue).toFixed(2)}`,
          r.warnings.some((w) => w.startsWith('Historical'))
            ? 'Unavailable'
            : `${r.quantity} / ${r.reserved}`,
          `${r.bands.days0to30} / ${r.bands.days31to60} / ${r.bands.days61to90} / ${r.bands.over90} / ${r.bands.unknown}`,
          `${r.riskQuantity} / ${r.riskValue ?? 'incomplete'}${r.nonMoving ? ' (30-day inactivity)' : ''}`,
        ])}
      />
    </PerformanceSection>
  );
}
export function WeeklyReviewAppendix({
  reviews,
  expectedStoreNames,
  categoryNames,
}: {
  reviews: WeeklyReviewContext[];
  expectedStoreNames: string[];
  categoryNames: Map<number, string>;
}) {
  const included = reviews.filter((r) => r.status !== 'draft');
  return (
    <PerformanceSection title="Weekly review findings and actions">
      {expectedStoreNames
        .filter((name) => !included.some((r) => r.storeName === name))
        .map((name) => (
          <Text key={name} style={performanceStyles.note}>
            {pdfText(name)}: Weekly review pending.
          </Text>
        ))}
      {included.map((review) => (
        <View key={review.id} style={{ marginTop: 9 }}>
          <Text
            style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}
            minPresenceAhead={40}
          >
            {pdfText(
              `${review.storeName} | ${review.weekFrom} - ${review.weekTo}`
            )}
          </Text>
          {[
            ['Summary', review.summary],
            ['Risks', review.risks],
            ['Opportunities', review.opportunities],
            ['Different next week', review.differentThisWeek],
            ['First three actions', review.firstThreeActions],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <Text key={label} style={performanceStyles.paragraph}>
                {pdfText(`${label}: ${value}`)}
              </Text>
            ))}
          {review.categoryNotes.map((note) => (
            <View key={note.id} style={{ marginTop: 5 }}>
              <Text
                style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}
                minPresenceAhead={30}
              >
                {pdfText(
                  categoryNames.get(note.categoryId) ??
                    `Category ${note.categoryId}`
                )}
              </Text>
              {[
                note.performanceComment,
                note.correctiveAction
                  ? `Corrective action: ${note.correctiveAction}`
                  : null,
                note.managerComment
                  ? `Manager comment: ${note.managerComment}`
                  : null,
              ]
                .filter(Boolean)
                .map((text, index) => (
                  <Text key={index} style={performanceStyles.paragraph}>
                    {pdfText(text)}
                  </Text>
                ))}
            </View>
          ))}
          <PerformanceTable
            headers={[
              'Action',
              'Responsible / due',
              'Goal',
              'Status / progress',
            ]}
            rows={review.actions.map((a) => [
              a.action,
              `${a.ownerName ?? 'Assigned user'} / ${a.dueDate ?? 'not set'}`,
              `${a.targetUnits ?? '-'} units / ${a.targetRevenue ?? '-'} revenue`,
              `${a.status} / ${a.managerComment ?? ''}`,
            ])}
          />
        </View>
      ))}
    </PerformanceSection>
  );
}
