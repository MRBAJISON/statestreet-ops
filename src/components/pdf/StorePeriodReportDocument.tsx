import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { StorePeriodReport } from '@/lib/reporting/store-period-report';

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
  pillBg: '#D1FAE5',
  pillText: '#065F46',
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
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4,
    paddingHorizontal: 12, marginHorizontal: -12, backgroundColor: COLORS.subtotal,
    borderTopWidth: 1, borderTopColor: COLORS.border, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowLabel: { color: COLORS.muted },
  rowLabelBold: { color: COLORS.text, fontFamily: 'Helvetica-Bold' },
  rowValue: { fontFamily: 'Helvetica-Bold' },
  rowValueDiscount: { color: COLORS.discount },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.text, paddingBottom: 4, marginBottom: 2 },
  tableHeadCell: { fontSize: 8, color: COLORS.muted, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  colDay: { flex: 2 },
  colNum: { flex: 1.6, textAlign: 'right' },
  colWide: { flex: 3 },
  twoCol: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  commentaryBox: { backgroundColor: COLORS.commentaryBg, borderLeftWidth: 3, borderLeftColor: COLORS.commentaryBorder, borderRadius: 4, padding: 12 },
  commentaryHeading: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.commentaryHeading, marginBottom: 6, textTransform: 'uppercase' },
  commentaryText: { color: COLORS.commentaryText, lineHeight: 1.4 },
  noteDate: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  noteBody: { fontSize: 9, color: COLORS.muted, lineHeight: 1.4, marginBottom: 6 },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
  pill: { backgroundColor: COLORS.pillBg, color: COLORS.pillText, fontSize: 9, fontFamily: 'Helvetica-Bold', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, alignSelf: 'flex-start' },
  dashedBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 4, padding: 10, marginTop: 6 },
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

export function StorePeriodReportDocument({
  report,
  currency,
  paymentMethodNames,
  categoryNames,
}: {
  report: StorePeriodReport;
  currency: string;
  paymentMethodNames: Map<number, string>;
  categoryNames: Map<number, string>;
}) {
  const { totals } = report;
  const heading = report.periodType === 'week' ? 'WEEKLY STORE REPORT' : 'MONTHLY STORE REPORT';
  const onTarget = report.achievementPercent >= 100;
  const traded = report.days.filter((day) => day.transactions > 0 || day.netRevenue > 0);
  const best = traded.reduce<typeof traded[number] | null>(
    (top, day) => (!top || day.netRevenue > top.netRevenue ? day : top),
    null
  );
  const worst = traded.reduce<typeof traded[number] | null>(
    (low, day) => (!low || day.netRevenue < low.netRevenue ? day : low),
    null
  );
  const zeroDays = report.days.filter((day) => day.netRevenue <= 0);
  const revenueChange =
    report.previous.netRevenue > 0
      ? ((totals.netRevenue - report.previous.netRevenue) / report.previous.netRevenue) * 100
      : null;

  return (
    <Document title={`${report.store.name} ${report.periodType} report ${report.range.label}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{heading}</Text>
            <Text style={styles.headerSubtitle}>{report.store.name}</Text>
          </View>
          <View>
            <Text style={styles.headerMetaLabel}>Period</Text>
            <Text style={styles.headerMetaValue}>{report.range.label}</Text>
            <Text style={styles.headerMetaLabel}>Store Manager</Text>
            <Text style={styles.headerMetaValue}>{report.managerName ?? 'Not recorded'}</Text>
            <Text style={styles.headerMetaLabel}>Status</Text>
            <Text style={{ ...styles.headerMetaValue, color: onTarget ? '#86EFAC' : '#FCA5A5' }}>
              {report.statusText}
            </Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Period Target</Text>
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
            <Text style={styles.kpiDetail}>Above / below period goal</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. DAY BY DAY</Text>
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
              {best ? `Strongest day ${dayLabel(best.date)} at ${formatMoney(best.netRevenue, currency)}. ` : ''}
              {worst && best && worst.date !== best.date
                ? `Weakest trading day ${dayLabel(worst.date)} at ${formatMoney(worst.netRevenue, currency)}. `
                : ''}
              {zeroDays.length
                ? `${zeroDays.length} day${zeroDays.length === 1 ? '' : 's'} with no sales. `
                : 'Every trading day recorded sales. '}
              {`Footfall ${totals.footfall}, ${totals.transactions} transactions, average ticket ${formatMoney(report.avgTicketValue, currency)}.`}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. SALES BREAKDOWN</Text>
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
            <Text style={styles.sectionTitle}>3. SALES BY CATEGORY</Text>
            <View style={styles.card}>
              <View style={styles.tableHead}>
                <Text style={{ ...styles.tableHeadCell, ...styles.colWide }}>Category</Text>
                <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Units</Text>
                <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Net Sales</Text>
                <Text style={{ ...styles.tableHeadCell, ...styles.colNum }}>Share</Text>
              </View>
              {report.categories.map((row) => (
                <View key={row.categoryId} style={styles.tableRow}>
                  <Text style={styles.colWide}>{categoryNames.get(row.categoryId) ?? `Category ${row.categoryId}`}</Text>
                  <Text style={styles.colNum}>{row.unitsSold}</Text>
                  <Text style={styles.colNum}>{formatMoney(row.netRevenue, currency)}</Text>
                  <Text style={{ ...styles.colNum, color: COLORS.muted }}>
                    {totals.netRevenue > 0 ? `${((row.netRevenue / totals.netRevenue) * 100).toFixed(1)}%` : '-'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {report.productsSold.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. KEY MERCHANDISE SOLD</Text>
            <View style={styles.card}>
              {report.productsSold.map((item, index) => (
                <View key={index} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    {item.name}
                    {item.occurrences > 1 ? ` (${item.occurrences} days)` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. CUSTOMER REQUESTS &amp; LEADS</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={{ ...styles.rowValue, marginBottom: 6 }}>Requests &amp; Stock Gaps</Text>
                {report.customerRequests.length ? (
                  report.customerRequests.map((request) => (
                    <View key={request.id} style={styles.row}>
                      <Text style={styles.rowLabel}>{request.interest}</Text>
                      <Text style={{ ...styles.fulfillmentBadge, color: request.fulfillmentStatus === 'stock_gap' ? COLORS.stockGap : COLORS.inStock }}>
                        {request.fulfillmentStatus === 'stock_gap' ? 'Stock gap' : request.fulfillmentStatus === 'in_stock' ? 'In stock' : 'Not recorded'}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.commentaryText}>No specific product requests logged.</Text>
                )}
              </View>
            </View>
            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={{ ...styles.rowValue, marginBottom: 6 }}>Lead Generation</Text>
                <Text style={styles.pill}>{report.leadsCount} new lead{report.leadsCount === 1 ? '' : 's'}</Text>
                <Text style={{ ...styles.commentaryText, marginTop: 6 }}>
                  {report.leadsCount > 0
                    ? 'Personal outreach and post-purchase follow-up recommended.'
                    : 'No new leads captured in this period.'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {report.notes.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. DAILY OBSERVATIONS</Text>
            <View style={styles.dashedBox}>
              {report.notes.map((note) => (
                <View key={note.date} style={{ marginBottom: 6 }}>
                  <Text style={styles.noteDate}>{dayLabel(note.date)}</Text>
                  {note.notes ? <Text style={styles.noteBody}>{note.notes}</Text> : null}
                  {note.staffPerformanceNote ? (
                    <Text style={styles.noteBody}>Staff: {note.staffPerformanceNote}</Text>
                  ) : null}
                  {note.closingFacilityStatus ? (
                    <Text style={styles.noteBody}>Closing: {note.closingFacilityStatus}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{report.store.name} | {report.periodType === 'week' ? 'Weekly' : 'Monthly'} Store Report</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
