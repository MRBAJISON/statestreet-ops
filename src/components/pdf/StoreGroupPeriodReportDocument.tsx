import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { StoreGroupPeriodReport } from '@/lib/reporting/store-group-period-report';

// The cluster report: one document for stores that trade as one unit, with a
// per-store split so the combined figure can be read rather than taken on trust.
// Deliberately the same visual language as the single-store report — the same
// reader gets both, and two house styles would be a needless tax on them.

const COLORS = {
  header: '#0F172A',
  headerSubtle: '#94A3B8',
  page: '#F7F9FB',
  card: '#FFFFFF',
  border: '#E2E8F0',
  subtotal: '#F1F5F9',
  text: '#0F172A',
  muted: '#64748B',
  discount: '#DC2626',
  achievementBg: '#0E7A4C',
  achievementDetail: '#BBF7D0',
  commentaryBg: '#EFF6FF',
  commentaryBorder: '#3B82F6',
  commentaryHeading: '#1D4ED8',
  commentaryText: '#1E3A8A',
  stockGap: '#DC2626',
  inStock: '#0E7A4C',
};

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.page, padding: 28, fontSize: 10, color: COLORS.text, fontFamily: 'Helvetica' },
  header: { backgroundColor: COLORS.header, borderRadius: 8, padding: 18, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Helvetica-Bold' },
  headerSubtitle: { color: COLORS.headerSubtle, fontSize: 10, marginTop: 4 },
  headerMetaLabel: { color: COLORS.headerSubtle, fontSize: 9 },
  headerMetaValue: { color: '#FFFFFF', fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10 },
  kpiCardHighlight: { flex: 1, backgroundColor: COLORS.achievementBg, borderRadius: 8, padding: 10 },
  kpiLabel: { fontSize: 8, color: COLORS.muted, marginBottom: 4, textTransform: 'uppercase' },
  kpiLabelHighlight: { fontSize: 8, color: COLORS.achievementDetail, marginBottom: 4, textTransform: 'uppercase' },
  kpiValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  kpiValueHighlight: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2, color: '#FFFFFF' },
  kpiDetail: { fontSize: 8, color: COLORS.muted },
  kpiDetailHighlight: { fontSize: 8, color: COLORS.achievementDetail },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLast: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowSubtotal: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 6,
    backgroundColor: COLORS.subtotal, borderRadius: 4, marginVertical: 2,
  },
  rowLabel: { color: COLORS.muted },
  rowLabelBold: { color: COLORS.text, fontFamily: 'Helvetica-Bold' },
  rowValue: { fontFamily: 'Helvetica-Bold' },
  rowValueDiscount: { color: COLORS.discount },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 4, marginBottom: 4 },
  tableHeadCell: { fontSize: 8, color: COLORS.muted, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 3 },
  colDay: { flex: 2 },
  colNum: { flex: 1.6, textAlign: 'right' },
  colWide: { flex: 3 },
  commentaryBox: { backgroundColor: COLORS.commentaryBg, borderLeftWidth: 3, borderLeftColor: COLORS.commentaryBorder, borderRadius: 4, padding: 12 },
  commentaryHeading: { color: COLORS.commentaryHeading, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  commentaryText: { color: COLORS.commentaryText, lineHeight: 1.5 },
  bullet: { flexDirection: 'row', paddingVertical: 2 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
  noteBlock: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  noteMeta: { fontSize: 8, color: COLORS.muted, marginBottom: 2 },
  footer: { position: 'absolute', bottom: 20, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: COLORS.muted, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  fulfillmentBadge: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  best: { color: COLORS.achievementBg, fontFamily: 'Helvetica-Bold' },
  worst: { color: COLORS.discount, fontFamily: 'Helvetica-Bold' },
});

function formatMoney(value: number, currency: string) {
  const amount = new Intl.NumberFormat('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  return `${currency} ${amount}`;
}

function signedMoney(value: number, currency: string) {
  const formatted = formatMoney(Math.abs(value), currency);
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

function signedPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function dayLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
  return `${weekday} ${date.getUTCDate()}`;
}

export function StoreGroupPeriodReportDocument({
  report,
  currency,
  paymentMethodNames,
  categoryNames,
}: {
  report: StoreGroupPeriodReport;
  currency: string;
  paymentMethodNames: Map<number, string>;
  categoryNames: Map<number, string>;
}) {
  const { totals } = report;
  const heading = report.periodType === 'week' ? 'WEEKLY CLUSTER REPORT' : 'MONTHLY CLUSTER REPORT';
  const onTarget = report.achievementPercent >= 100;
  const traded = report.days.filter((day) => day.transactions > 0 || day.netRevenue > 0);
  const best = traded.reduce<typeof traded[number] | null>(
    (top, day) => (!top || day.netRevenue > top.netRevenue ? day : top),
    null
  );
  const zeroDays = report.days.filter((day) => day.netRevenue <= 0);
  const revenueChange =
    report.previous.netRevenue > 0
      ? ((totals.netRevenue - report.previous.netRevenue) / report.previous.netRevenue) * 100
      : null;
  const leadStore = report.stores.reduce<typeof report.stores[number] | null>(
    (top, store) => (!top || store.netRevenue > top.netRevenue ? store : top),
    null
  );

  return (
    <Document title={`${report.group.name} ${report.periodType} report ${report.range.label}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{heading}</Text>
            <Text style={styles.headerSubtitle}>
              {report.group.name} — {report.stores.map((store) => store.storeName).join(' + ')}
            </Text>
          </View>
          <View>
            <Text style={styles.headerMetaLabel}>Period</Text>
            <Text style={styles.headerMetaValue}>{report.range.label}</Text>
            <Text style={styles.headerMetaLabel}>Manager</Text>
            <Text style={styles.headerMetaValue}>{report.managerName ?? 'Not recorded'}</Text>
            <Text style={styles.headerMetaLabel}>Status</Text>
            <Text style={{ ...styles.headerMetaValue, color: onTarget ? '#86EFAC' : '#FCA5A5' }}>
              {report.statusText}
            </Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Combined Target</Text>
            <Text style={styles.kpiValue}>{formatMoney(report.target, currency)}</Text>
            <Text style={styles.kpiDetail}>{report.tradingDays} trading days</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Actual Net Sales</Text>
            <Text style={styles.kpiValue}>{formatMoney(totals.netRevenue, currency)}</Text>
            {revenueChange !== null ? (
              <Text style={styles.kpiDetail}>{signedPercent(revenueChange)} vs previous</Text>
            ) : null}
          </View>
          <View style={styles.kpiCardHighlight}>
            <Text style={styles.kpiLabelHighlight}>Achievement</Text>
            <Text style={styles.kpiValueHighlight}>{report.achievementPercent.toFixed(1)}%</Text>
            <Text style={styles.kpiDetailHighlight}>{signedPercent(report.achievementPercent - 100)} vs target</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Surplus Revenue</Text>
            <Text style={{ ...styles.kpiValue, color: report.surplus >= 0 ? COLORS.achievementBg : COLORS.discount }}>
              {signedMoney(report.surplus, currency)}
            </Text>
            <Text style={styles.kpiDetail}>Above / below combined goal</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. BY STORE</Text>
          <View style={styles.card}>
            <View style={styles.tableHead}>
              <Text style={{ ...styles.tableHeadCell, ...styles.colWide }}>Store</Text>
              <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Net Sales</Text>
              <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Target</Text>
              <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Achieved</Text>
              <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Transactions</Text>
              <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Share</Text>
            </View>
            {report.stores.map((store) => {
              const share = totals.netRevenue > 0 ? (store.netRevenue / totals.netRevenue) * 100 : 0;
              const tone = store.achievementPercent >= 100 ? styles.best : {};
              return (
                <View key={store.storeId} style={styles.tableRow}>
                  <Text style={styles.colWide}>{store.storeName}</Text>
                  <Text style={{ ...styles.colNum, ...tone }}>{formatMoney(store.netRevenue, currency)}</Text>
                  <Text style={{ ...styles.colNum, color: COLORS.muted }}>{formatMoney(store.target, currency)}</Text>
                  <Text style={{ ...styles.colNum, ...tone }}>{store.achievementPercent.toFixed(0)}%</Text>
                  <Text style={styles.colNum}>{store.transactions}</Text>
                  <Text style={styles.colNum}>{share.toFixed(0)}%</Text>
                </View>
              );
            })}
            <View style={styles.rowSubtotal}>
              <Text style={styles.rowLabelBold}>Combined</Text>
              <Text style={styles.rowValue}>{formatMoney(totals.netRevenue, currency)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. DAY BY DAY (COMBINED)</Text>
          <View style={styles.card}>
            <View style={styles.tableHead}>
              <Text style={{ ...styles.tableHeadCell, ...styles.colDay }}>Day</Text>
              <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Net Sales</Text>
              <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Target</Text>
              <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Achieved</Text>
              <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Transactions</Text>
            </View>
            {report.days.map((day) => {
              const achieved = day.target > 0 ? (day.netRevenue / day.target) * 100 : 0;
              const tone = day.netRevenue <= 0 ? styles.worst : achieved >= 100 ? styles.best : {};
              return (
                <View key={day.date} style={styles.tableRow}>
                  <Text style={styles.colDay}>{dayLabel(day.date)}</Text>
                  <Text style={{ ...styles.colNum, ...tone }}>{formatMoney(day.netRevenue, currency)}</Text>
                  <Text style={{ ...styles.colNum, color: COLORS.muted }}>{formatMoney(day.target, currency)}</Text>
                  <Text style={{ ...styles.colNum, ...tone }}>{achieved.toFixed(0)}%</Text>
                  <Text style={styles.colNum}>{day.transactions}</Text>
                </View>
              );
            })}
            <View style={styles.rowSubtotal}>
              <Text style={styles.rowLabelBold}>Period total</Text>
              <Text style={styles.rowValue}>{formatMoney(totals.netRevenue, currency)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.commentaryBox}>
            <Text style={styles.commentaryHeading}>Period Highlights</Text>
            <Text style={styles.commentaryText}>
              {leadStore
                ? `${leadStore.storeName} led the cluster with ${formatMoney(leadStore.netRevenue, currency)}. `
                : ''}
              {best ? `Strongest day ${dayLabel(best.date)} at ${formatMoney(best.netRevenue, currency)}. ` : ''}
              {zeroDays.length
                ? `${zeroDays.length} day${zeroDays.length === 1 ? '' : 's'} with no sales across the cluster. `
                : 'Every trading day recorded sales. '}
              {`Combined footfall ${totals.footfall}, ${totals.transactions} transactions, average ticket ${formatMoney(report.avgTicketValue, currency)}.`}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. SALES BREAKDOWN (COMBINED)</Text>
          <View style={styles.card}>
            <View style={styles.row}><Text style={styles.rowLabel}>Gross Sales</Text><Text style={styles.rowValue}>{formatMoney(totals.grossRevenue, currency)}</Text></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Discount Given</Text><Text style={{ ...styles.rowValue, ...styles.rowValueDiscount }}>- {formatMoney(totals.discounts, currency)}</Text></View>
            {totals.returns > 0 ? (
              <View style={styles.row}><Text style={styles.rowLabel}>Returns</Text><Text style={{ ...styles.rowValue, ...styles.rowValueDiscount }}>- {formatMoney(totals.returns, currency)}</Text></View>
            ) : null}
            <View style={styles.rowSubtotal}><Text style={styles.rowLabelBold}>Net Sales</Text><Text style={styles.rowValue}>{formatMoney(totals.netRevenue, currency)}</Text></View>
            {report.payments.map((line, index) => (
              <View key={line.paymentMethodId} style={index === report.payments.length - 1 ? styles.rowLast : styles.row}>
                <Text style={styles.rowLabel}>{paymentMethodNames.get(line.paymentMethodId) ?? `Method ${line.paymentMethodId}`}</Text>
                <Text style={styles.rowValue}>{formatMoney(line.amount, currency)}</Text>
              </View>
            ))}
          </View>
        </View>

        {report.categories.length ? (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>4. SALES BY CATEGORY (COMBINED)</Text>
            <View style={styles.card}>
              <View style={styles.tableHead}>
                <Text style={{ ...styles.tableHeadCell, ...styles.colWide }}>Category</Text>
                <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Units</Text>
                <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Net Sales</Text>
                <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Share</Text>
              </View>
              {report.categories.map((category) => {
                const share = totals.netRevenue > 0 ? (category.netRevenue / totals.netRevenue) * 100 : 0;
                return (
                  <View key={category.categoryId} style={styles.tableRow}>
                    <Text style={styles.colWide}>{categoryNames.get(category.categoryId) ?? `Category ${category.categoryId}`}</Text>
                    <Text style={styles.colNum}>{category.unitsSold}</Text>
                    <Text style={styles.colNum}>{formatMoney(category.netRevenue, currency)}</Text>
                    <Text style={styles.colNum}>{share.toFixed(0)}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {report.productsSold.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. KEY MERCHANDISE SOLD</Text>
            <View style={styles.card}>
              {report.productsSold.slice(0, 20).map((product) => (
                <View key={product.name} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{product.name}</Text>
                  <Text style={{ color: COLORS.muted }}>
                    {product.occurrences} day{product.occurrences === 1 ? '' : 's'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. CUSTOMER REQUESTS &amp; LEADS</Text>
          <View style={styles.card}>
            {report.customerRequests.length ? (
              report.customerRequests.slice(0, 25).map((request, index) => (
                <View key={`${request.storeName}-${index}`} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    {request.interest}
                    <Text style={{ color: COLORS.muted }}> — {request.storeName}</Text>
                  </Text>
                  {request.fulfillmentStatus ? (
                    <Text
                      style={{
                        ...styles.fulfillmentBadge,
                        color: request.fulfillmentStatus === 'stock_gap' ? COLORS.stockGap : COLORS.inStock,
                      }}
                    >
                      {request.fulfillmentStatus === 'stock_gap' ? 'Stock gap' : 'In stock'}
                    </Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.rowLabel}>No customer requests recorded in this period.</Text>
            )}
            <View style={styles.rowSubtotal}>
              <Text style={styles.rowLabelBold}>Leads captured</Text>
              <Text style={styles.rowValue}>{report.leadsCount}</Text>
            </View>
          </View>
        </View>

        {report.notes.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. DAILY OBSERVATIONS</Text>
            <View style={styles.card}>
              {report.notes.map((note, index) => (
                <View key={`${note.storeName}-${note.date}-${index}`} style={styles.noteBlock}>
                  <Text style={styles.noteMeta}>{dayLabel(note.date)} — {note.storeName}</Text>
                  {note.notes ? <Text>{note.notes}</Text> : null}
                  {note.staffPerformanceNote ? <Text style={styles.rowLabel}>Staff: {note.staffPerformanceNote}</Text> : null}
                  {note.closingFacilityStatus ? <Text style={styles.rowLabel}>Closing: {note.closingFacilityStatus}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{report.group.name} — {report.range.label}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
