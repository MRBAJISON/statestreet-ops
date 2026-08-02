import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { DailyReportRecord } from '@/lib/contracts/daily-report';
import type { DailyStoreReportSupplement } from '@/lib/reporting/daily-store-report';

const COLORS = {
  header: '#0F172A',
  headerSubtle: '#94A3B8',
  page: '#F7F9FB',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  discount: '#DC2626',
  achievementBg: '#0E7A4C',
  achievementText: '#FFFFFF',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginHorizontal: -12,
    backgroundColor: '#F1F5F9',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLabel: { color: COLORS.muted },
  rowLabelBold: { color: COLORS.text, fontFamily: 'Helvetica-Bold' },
  rowValue: { fontFamily: 'Helvetica-Bold' },
  rowValueDiscount: { color: COLORS.discount },
  twoCol: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  commentaryBox: { backgroundColor: COLORS.commentaryBg, borderLeftWidth: 3, borderLeftColor: COLORS.commentaryBorder, borderRadius: 4, padding: 12 },
  commentaryHeading: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.commentaryHeading, marginBottom: 6, textTransform: 'uppercase' },
  commentaryText: { color: COLORS.commentaryText, lineHeight: 1.4 },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
  pill: { backgroundColor: COLORS.pillBg, color: COLORS.pillText, fontSize: 9, fontFamily: 'Helvetica-Bold', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, alignSelf: 'flex-start' },
  dashedBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 4, padding: 10, marginTop: 6 },
  footer: { position: 'absolute', bottom: 20, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: COLORS.muted, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  fulfillmentBadge: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
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

export function DailyStoreReportDocument({
  report,
  supplement,
  currency,
  paymentMethodNames,
  categoryNames,
}: {
  report: DailyReportRecord;
  supplement: DailyStoreReportSupplement;
  currency: string;
  paymentMethodNames: Map<number, string>;
  categoryNames: Map<number, string>;
}) {
  const gross = report.sales.reduce((sum, line) => sum + Number(line.grossRevenue), 0);
  const discounts = report.sales.reduce((sum, line) => sum + Number(line.discounts), 0);
  const returns = report.sales.reduce((sum, line) => sum + Number(line.returns), 0);
  const net = gross - discounts - returns;
  const statusColor = supplement.achievementPercent >= 100 ? COLORS.achievementBg : COLORS.discount;
  const keyMerchandise = report.sales.flatMap((line) =>
    line.products.map((product) => ({
      categoryName: categoryNames.get(line.categoryId) ?? `Category ${line.categoryId}`,
      productName: product.productName,
      sku: product.sku,
    }))
  );

  return (
    <Document title={`${report.storeName} daily report ${report.businessDate}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>DAILY STORE REPORT</Text>
            <Text style={styles.headerSubtitle}>{report.storeName}</Text>
          </View>
          <View>
            <Text style={styles.headerMetaLabel}>Date</Text>
            <Text style={styles.headerMetaValue}>{report.businessDate}</Text>
            <Text style={styles.headerMetaLabel}>Store Manager</Text>
            <Text style={styles.headerMetaValue}>{report.managerName ?? 'Not recorded'}</Text>
            <Text style={styles.headerMetaLabel}>Status</Text>
            <Text style={{ ...styles.headerMetaValue, color: statusColor === COLORS.achievementBg ? '#86EFAC' : '#FCA5A5' }}>
              {supplement.statusText} · {report.status}
            </Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Daily Target</Text>
            <Text style={styles.kpiValue}>{formatMoney(supplement.dailyTarget, currency)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Actual Net Sales</Text>
            <Text style={styles.kpiValue}>{formatMoney(net, currency)}</Text>
          </View>
          <View style={styles.kpiCardHighlight}>
            <Text style={styles.kpiLabelHighlight}>Achievement</Text>
            <Text style={styles.kpiValueHighlight}>{supplement.achievementPercent.toFixed(1)}%</Text>
            <Text style={styles.kpiDetailHighlight}>{signedPercent(supplement.achievementPercent - 100)} vs target</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Surplus Revenue</Text>
            <Text style={{ ...styles.kpiValue, color: supplement.surplus >= 0 ? COLORS.achievementBg : COLORS.discount }}>
              {signedMoney(supplement.surplus, currency)}
            </Text>
            <Text style={styles.kpiDetail}>Above / below daily goal</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. SALES BREAKDOWN</Text>
          <View style={styles.card}>
            <View style={styles.row}><Text style={styles.rowLabel}>Gross Sales</Text><Text style={styles.rowValue}>{formatMoney(gross, currency)}</Text></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Discount Given</Text><Text style={{ ...styles.rowValue, ...styles.rowValueDiscount }}>- {formatMoney(discounts, currency)}</Text></View>
            {returns > 0 ? (
              <View style={styles.row}><Text style={styles.rowLabel}>Returns</Text><Text style={{ ...styles.rowValue, ...styles.rowValueDiscount }}>- {formatMoney(returns, currency)}</Text></View>
            ) : null}
            <View style={styles.rowSubtotal}><Text style={styles.rowLabelBold}>Net Sales</Text><Text style={styles.rowValue}>{formatMoney(net, currency)}</Text></View>
            {report.payments.map((line, index) => (
              <View key={line.paymentMethodId} style={index === report.payments.length - 1 ? styles.rowLast : styles.row}>
                <Text style={styles.rowLabel}>{paymentMethodNames.get(line.paymentMethodId) ?? `Method ${line.paymentMethodId}`}</Text>
                <Text style={styles.rowValue}>{formatMoney(Number(line.amount), currency)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. TRANSACTIONS</Text>
          <View style={styles.card}>
            <View style={styles.row}><Text style={styles.rowLabel}>Transactions</Text><Text style={styles.rowValue}>{report.transactions}</Text></View>
            <View style={styles.rowLast}><Text style={styles.rowLabel}>Avg Ticket Value</Text><Text style={styles.rowValue}>{formatMoney(supplement.avgTicketValue, currency)}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.commentaryBox}>
            <Text style={styles.commentaryHeading}>Sales Commentary &amp; Footfall Insights</Text>
            <Text style={styles.commentaryText}>{report.notes || 'No commentary recorded.'} Footfall: {report.footfall}.</Text>
          </View>
        </View>

        {keyMerchandise.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. KEY MERCHANDISE SOLD</Text>
            <View style={styles.card}>
              {keyMerchandise.map((item, index) => (
                <View key={index} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>
                    {item.categoryName}: {item.productName}{item.sku ? ` (${item.sku})` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. STAFF PERFORMANCE, CRM &amp; OPERATIONAL AUDIT</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={{ ...styles.rowValue, marginBottom: 6 }}>Staff Performance</Text>
                <Text style={styles.commentaryText}>{report.staffPerformanceNote || 'No staff observations recorded.'}</Text>
              </View>
            </View>
            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={{ ...styles.rowValue, marginBottom: 6 }}>Lead Generation &amp; CRM</Text>
                <Text style={styles.pill}>{supplement.leadsCount} new lead{supplement.leadsCount === 1 ? '' : 's'}</Text>
                <Text style={{ ...styles.commentaryText, marginTop: 6 }}>{supplement.followUpText}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Requests &amp; Inventory</Text>
          <View style={styles.card}>
            {supplement.customerRequests.length ? (
              supplement.customerRequests.map((request) => (
                <View key={request.id} style={styles.row}>
                  <Text style={styles.rowLabel}>{request.interest}</Text>
                  <Text style={{ ...styles.fulfillmentBadge, color: request.fulfillmentStatus === 'stock_gap' ? COLORS.stockGap : COLORS.inStock }}>
                    {request.fulfillmentStatus === 'stock_gap' ? 'Stock gap' : request.fulfillmentStatus === 'in_stock' ? 'In stock' : 'Not recorded'}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.commentaryText}>No specific product requests logged today.</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Closing Facility &amp; Security Audit</Text>
          <View style={styles.dashedBox}>
            <Text style={styles.commentaryText}>{report.closingFacilityStatus || 'No closing audit recorded.'}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{report.storeName} | Daily Store Report</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
