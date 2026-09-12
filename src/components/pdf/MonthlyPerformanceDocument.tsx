import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { MonthlyReviewContext } from '@/lib/monthly-reviews';
import {
  PerformanceSection,
  PerformanceTable,
  ProductPerformancePdf,
  ProductStockAppendix,
  WeeklyReviewAppendix,
  pdfText,
  performanceStyles,
} from './PerformanceSections';
const style = StyleSheet.create({
  page: {
    padding: 28,
    paddingBottom: 45,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#14283F',
    backgroundColor: '#F5F7FA',
  },
  header: {
    padding: 17,
    backgroundColor: '#14283F',
    borderLeftWidth: 5,
    borderLeftColor: '#D86E27',
    marginBottom: 17,
  },
  title: { color: '#FFFFFF', fontSize: 20, fontFamily: 'Helvetica-Bold' },
  subtitle: { color: '#CDD7E3', fontSize: 9, marginTop: 6 },
  cards: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  card: {
    flex: 1,
    padding: 11,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 3,
    borderTopColor: '#D86E27',
  },
  label: { fontSize: 8, color: '#64748B' },
  value: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 5 },
  footer: {
    position: 'absolute',
    bottom: 17,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#64748B',
  },
  conclusion: {
    padding: 14,
    backgroundColor: '#14283F',
    color: '#FFFFFF',
    lineHeight: 1.5,
  },
});
export function MonthlyPerformanceDocument({
  context,
  currency = 'GHS',
}: {
  context: MonthlyReviewContext;
  currency?: string;
}) {
  const review = context.review;
  const money = (value: number) =>
    `${currency} ${(Math.abs(value) < 0.005 ? 0 : value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const percent = (a: number, b: number) =>
    b > 0 ? `${((100 * a) / b).toFixed(1)}%` : 'Not available';
  const totals = context.stores.reduce(
    (v, { report }) => ({
      units: v.units + (report?.totals.unitsSold ?? 0),
      transactions: v.transactions + (report?.totals.transactions ?? 0),
      footfall: v.footfall + (report?.totals.footfall ?? 0),
    }),
    { units: 0, transactions: 0, footfall: 0 }
  );
  const categoryNames = new Map(context.categories.map((c) => [c.id, c.name]));
  const weeklyRows = context.weeks.map((week) => {
    const values = context.stores.map(
      ({ report }) =>
        report?.days
          .filter((day) => day.date >= week.from && day.date <= week.to)
          .reduce((sum, day) => sum + day.netRevenue, 0) ?? 0
    );
    return [
      `${week.from} - ${week.to}`,
      ...values.map(money),
      money(values.reduce((a, b) => a + b, 0)),
    ];
  });
  const nonTrading = context.stores.map(
    ({ report }) =>
      (report?.totals.netRevenue ?? 0) -
      (report?.days.reduce((sum, day) => sum + day.netRevenue, 0) ?? 0)
  );
  if (nonTrading.some((value) => Math.abs(value) > 0.005))
    weeklyRows.push([
      'Other dated ledger / non-trading-day entries',
      ...nonTrading.map(money),
      money(nonTrading.reduce((a, b) => a + b, 0)),
    ]);
  return (
    <Document title={`${context.name} - ${context.range.label} performance`}>
      <Page size="A4" style={style.page}>
        <View style={style.header}>
          <Text style={style.title}>MONTHLY PERFORMANCE REPORT</Text>
          <Text style={style.subtitle}>
            {pdfText(context.name)} | {context.range.label}
          </Text>
          <Text style={style.subtitle}>
            {pdfText(
              [
                ...new Set(
                  context.stores
                    .map((s) => s.report?.managerName)
                    .filter(Boolean)
                ),
              ].join(' / ')
            )}
          </Text>
          <Text style={style.subtitle}>
            Reporting period: {context.range.from} - {context.range.to} |
            Submitted management review
          </Text>
        </View>
        <View style={style.cards}>
          {[
            ['Net sales', money(context.totalSales)],
            ['Target', money(context.totalTarget)],
            ['Achievement', percent(context.totalSales, context.totalTarget)],
          ].map(([label, value]) => (
            <View key={label} style={style.card}>
              <Text style={style.label}>{label}</Text>
              <Text style={style.value}>{value}</Text>
            </View>
          ))}
        </View>
        <PerformanceSection title="1. Executive summary">
          {context.summary.facts.map((f) => (
            <Text key={f} style={performanceStyles.paragraph}>
              {pdfText(f)}
            </Text>
          ))}
          <Text style={performanceStyles.note}>
            Manager-checked explanation, informed by the weekly records listed
            in the appendix:
          </Text>
          <Text style={performanceStyles.paragraph}>
            {pdfText(review?.executiveSummary)}
          </Text>
        </PerformanceSection>
        <PerformanceSection title="2. Sales performance by store">
          <PerformanceTable
            headers={['Store', 'Net sales', 'Target', 'Achievement']}
            rows={context.stores.map(({ store, report }) => [
              store.name,
              money(report?.totals.netRevenue ?? 0),
              money(report?.target ?? 0),
              percent(report?.totals.netRevenue ?? 0, report?.target ?? 0),
            ])}
          />
          {context.stores.map(({ store }) =>
            review?.storeComments[String(store.id)] ? (
              <Text key={store.id} style={performanceStyles.paragraph}>
                {pdfText(
                  `${store.name}: ${review.storeComments[String(store.id)]}`
                )}
              </Text>
            ) : null
          )}
        </PerformanceSection>
        <PerformanceSection title="3. Weekly sales breakdown">
          <Text style={performanceStyles.note}>
            Weeks are Monday–Saturday. Only dates within this month contribute
            to financial totals.
          </Text>
          <PerformanceTable
            headers={[
              'Trading week',
              ...context.stores.map((s) => s.store.name),
              'Combined net sales',
            ]}
            rows={weeklyRows}
          />
        </PerformanceSection>
        <PerformanceSection title="4. Basket, transaction and traffic performance">
          <PerformanceTable
            headers={[
              'Store',
              'Units / transactions',
              'Footfall / conversion',
              'ATV / UPT / sales per walk-in',
            ]}
            rows={[
              ...context.stores.map(({ store, report }) => {
                const t = report?.totals;
                return [
                  store.name,
                  `${t?.unitsSold ?? 0} / ${t?.transactions ?? 0}`,
                  `${t?.footfall ?? 0} / ${percent(t?.transactions ?? 0, t?.footfall ?? 0)}`,
                  `${t?.transactions ? money(t.netRevenue / t.transactions) : 'N/A'} / ${t?.transactions ? (t.unitsSold / t.transactions).toFixed(2) : 'N/A'} / ${t?.footfall ? money(t.netRevenue / t.footfall) : 'N/A'}`,
                ];
              }),
              [
                'Combined',
                `${totals.units} / ${totals.transactions}`,
                `${totals.footfall} / ${percent(totals.transactions, totals.footfall)}`,
                `${totals.transactions ? money(context.totalSales / totals.transactions) : 'N/A'} / ${totals.transactions ? (totals.units / totals.transactions).toFixed(2) : 'N/A'} / ${totals.footfall ? money(context.totalSales / totals.footfall) : 'N/A'}`,
              ],
            ]}
          />
        </PerformanceSection>
        <PerformanceSection title="5. Style-advisor performance">
          <Text style={performanceStyles.note}>
            Manual sales attribution. Advisor figures do not change financial
            totals.
          </Text>
          <PerformanceTable
            headers={[
              'Advisor / store',
              'Actual sales',
              'Target',
              'Achievement',
            ]}
            rows={(review?.advisors ?? []).map((a) => [
              `${a.name} / ${context.stores.find((s) => s.store.id === a.storeId)?.store.name ?? ''}`,
              money(Number(a.actualSales)),
              money(Number(a.target)),
              percent(Number(a.actualSales), Number(a.target)),
            ])}
          />
          {context.stores.map((s) => {
            const diff =
              (s.report?.totals.netRevenue ?? 0) -
              (review?.advisors ?? [])
                .filter((a) => a.storeId === s.store.id)
                .reduce((sum, a) => sum + Number(a.actualSales), 0);
            return diff ? (
              <Text key={s.store.id} style={performanceStyles.note}>
                {pdfText(s.store.name)}: advisor allocation differs from net
                sales by {money(diff)}.
              </Text>
            ) : null;
          })}
        </PerformanceSection>
        <PerformanceSection title="6. Category performance">
          <PerformanceTable
            headers={[
              'Store / category',
              'Units',
              'Gross sales',
              'Net category sales',
            ]}
            rows={context.stores.flatMap(({ store, report }) =>
              (report?.categories ?? []).map((c) => [
                `${store.name} / ${categoryNames.get(c.categoryId) ?? c.categoryId}`,
                c.unitsSold,
                money(c.grossRevenue),
                money(c.netRevenue),
              ])
            )}
          />
          <PerformanceTable
            headers={['Reconciliation', 'Amount']}
            rows={context.stores.flatMap(({ store, report }) => {
              const t = report?.transactionSummary;
              return [
                [
                  `${store.name}: net category sales`,
                  money(
                    report?.categories.reduce((s, c) => s + c.netRevenue, 0) ??
                      0
                  ),
                ],
                ['Credit sales', money(t?.creditSales ?? 0)],
                [
                  'Deposits and balance payments',
                  money(t?.depositReceived ?? 0),
                ],
                ['Replacement top-ups', money(t?.additionalPayments ?? 0)],
                [
                  'Approved credits / deposit refunds',
                  money(-(t?.approvedCredits ?? 0) - (t?.depositRefunds ?? 0)),
                ],
                [
                  `${store.name}: reconciled net sales`,
                  money(report?.totals.netRevenue ?? 0),
                ],
                [
                  'Debt collections (cash only; excluded from sales)',
                  money(t?.creditCollections ?? 0),
                ],
              ];
            })}
          />
          <Text style={performanceStyles.note}>
            Category sales plus dated customer-ledger adjustments reconcile to
            net sales. Debt collections and credit redemptions are not counted
            again as new revenue.
          </Text>
        </PerformanceSection>
        <Text style={performanceStyles.title} minPresenceAhead={50}>
          7–8. Product performance and stock exposure
        </Text>
        <ProductPerformancePdf data={context.performance} currency={currency} />
        <PerformanceSection title="9. Customer requests and weekly findings">
          <PerformanceTable
            headers={['Store', 'Request', 'Outcome / requested units']}
            rows={context.stores.flatMap(({ store, report }) =>
              (report?.customerRequests ?? []).map((r) => [
                store.name,
                r.interest,
                `${r.fulfillmentStatus ?? 'Not recorded'} / ${r.stockGapQuantity ?? '-'}`,
              ])
            )}
          />
          <Text style={performanceStyles.note}>
            Full submitted weekly findings, category comments and actions follow
            in the appendix. Cross-month review dates are shown explicitly.
          </Text>
        </PerformanceSection>
        <PerformanceSection title="10. Management actions and operational audit">
          <Text style={performanceStyles.paragraph}>
            {pdfText(review?.managementOutcomes)}
          </Text>
          <Text style={performanceStyles.paragraph}>
            {pdfText(review?.operationalAssessment)}
          </Text>
          {context.carriedActions.length ? (
            <PerformanceTable
              headers={[
                'Previous commitment',
                'Owner / due',
                'Status / progress',
              ]}
              rows={context.carriedActions.map((a) => [
                a.action,
                `${a.ownerName} / ${a.dueDate}`,
                `${a.status} / ${a.progress}`,
              ])}
            />
          ) : null}
        </PerformanceSection>
        <PerformanceSection
          title={`11. ${context.nextRange.label}: targets and priorities`}
        >
          <PerformanceTable
            headers={['Store', 'Commercial target']}
            rows={context.nextTargets.map((t) => [
              context.stores.find((s) => s.store.id === t.storeId)?.store
                .name ?? '',
              money(t.target),
            ])}
          />
          <PerformanceTable
            headers={[
              'Priority / intended outcome',
              'Responsible / due',
              'Measurable goal',
              'Status / progress',
            ]}
            rows={(review?.actions ?? []).map((a) => [
              `${a.action} / ${a.outcome}`,
              `${a.ownerName} / ${a.dueDate}`,
              a.goal,
              `${a.status} / ${a.progress}`,
            ])}
          />
        </PerformanceSection>
        <PerformanceSection title="12. Manager’s conclusion">
          <View style={style.conclusion}>
            <Text>{pdfText(review?.conclusion)}</Text>
          </View>
        </PerformanceSection>
        <View break>
          <PerformanceSection title="Appendix: supporting daily observations">
            {context.stores.flatMap(({ store, report }) =>
              (report?.notes ?? [])
                .filter(
                  (n) =>
                    n.notes || n.staffPerformanceNote || n.closingFacilityStatus
                )
                .map((n) => (
                  <View key={`${store.id}:${n.date}`}>
                    <Text style={performanceStyles.title} minPresenceAhead={30}>
                      {pdfText(store.name)} | {n.date}
                    </Text>
                    {[n.notes, n.staffPerformanceNote, n.closingFacilityStatus]
                      .filter(Boolean)
                      .map((note, i) => (
                        <Text key={i} style={performanceStyles.paragraph}>
                          {pdfText(note)}
                        </Text>
                      ))}
                  </View>
                ))
            )}
          </PerformanceSection>
          <WeeklyReviewAppendix
            reviews={context.weeklyReviews}
            expectedStoreNames={context.stores.map((s) => s.store.name)}
            categoryNames={categoryNames}
          />
        </View>
        <View break>
          <ProductStockAppendix
            data={context.performance}
            currency={currency}
          />
        </View>
        <View style={style.footer} fixed>
          <Text>
            {pdfText(context.name)} | {context.range.label}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
