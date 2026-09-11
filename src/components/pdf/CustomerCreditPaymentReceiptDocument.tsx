import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CreditSalePaymentReceipt } from '@/lib/customer-transactions';

const COLORS = {
  ink: '#0F172A',
  muted: '#64748B',
  border: '#CBD5E1',
  tint: '#F8FAFC',
  accent: '#0E7A4C',
};

const styles = StyleSheet.create({
  page: { padding: 26, fontFamily: 'Helvetica', fontSize: 9, color: COLORS.ink },
  header: { borderBottomWidth: 2, borderBottomColor: COLORS.ink, paddingBottom: 12, marginBottom: 16 },
  title: { fontSize: 17, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  subtitle: { color: COLORS.muted, marginTop: 4 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  metaBlock: { flex: 1 },
  label: { color: COLORS.muted, fontSize: 8, textTransform: 'uppercase', marginBottom: 3 },
  value: { fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 14 },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 6 },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 5, padding: 9 },
  tableHead: { flexDirection: 'row', backgroundColor: COLORS.ink, color: '#FFFFFF', padding: 6 },
  tableHeadText: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableRowLast: { flexDirection: 'row', paddingVertical: 6 },
  category: { width: '28%', color: COLORS.muted },
  product: { width: '42%' },
  qty: { width: '12%', textAlign: 'right' },
  amount: { width: '18%', textAlign: 'right' },
  totalBox: { backgroundColor: COLORS.tint, borderWidth: 1, borderColor: COLORS.border, borderRadius: 5, padding: 11, marginTop: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  totalValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: COLORS.accent },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: COLORS.border },
  footer: { position: 'absolute', bottom: 18, left: 26, right: 26, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 7, color: COLORS.muted, fontSize: 8, textAlign: 'center' },
});

function formatMoney(value: number, currency: string) {
  const amount = new Intl.NumberFormat('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  return `${currency} ${amount}`;
}

export function CustomerCreditPaymentReceiptDocument({ receipt, currency }: { receipt: CreditSalePaymentReceipt; currency: string }) {
  return (
    <Document title={`${receipt.receiptNumber} payment receipt`}>
      <Page size="A6" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>PAYMENT RECEIPT</Text>
          <Text style={styles.subtitle}>{receipt.storeName} · {receipt.storeCode}</Text>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaBlock}><Text style={styles.label}>Receipt</Text><Text style={styles.value}>{receipt.receiptNumber}</Text></View>
          <View style={styles.metaBlock}><Text style={styles.label}>Payment date</Text><Text style={styles.value}>{receipt.paymentDate}</Text></View>
        </View>
        <View style={styles.meta}>
          <View style={styles.metaBlock}><Text style={styles.label}>Customer</Text><Text style={styles.value}>{receipt.customerName}</Text>{receipt.customerPhone ? <Text style={styles.subtitle}>{receipt.customerPhone}</Text> : null}</View>
          <View style={styles.metaBlock}><Text style={styles.label}>Credit sale</Text><Text style={styles.value}>{receipt.creditNumber}</Text>{receipt.originalReceiptNumber ? <Text style={styles.subtitle}>Sale ref: {receipt.originalReceiptNumber}</Text> : null}</View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Original credit sale</Text>
          <View style={styles.card}>
            <View style={styles.tableHead}>
              <Text style={{ ...styles.category, ...styles.tableHeadText }}>Category</Text>
              <Text style={{ ...styles.product, ...styles.tableHeadText }}>Product</Text>
              <Text style={{ ...styles.qty, ...styles.tableHeadText }}>Qty</Text>
              <Text style={{ ...styles.amount, ...styles.tableHeadText }}>Value</Text>
            </View>
            {receipt.items.map((item, index) => (
              <View key={`${item.categoryName}-${item.productName}-${index}`} style={index === receipt.items.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={styles.category}>{item.categoryName}</Text>
                <Text style={styles.product}>{item.productName}</Text>
                <Text style={styles.qty}>{item.quantity}</Text>
                <Text style={styles.amount}>{formatMoney(item.lineValue, currency)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.totalBox}>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Amount received</Text><Text style={styles.totalValue}>{formatMoney(receipt.amount, currency)}</Text></View>
          <View style={styles.balanceRow}><Text>Payment method</Text><Text style={styles.value}>{receipt.paymentMethodName}</Text></View>
          <View style={styles.balanceRow}><Text>Previous balance</Text><Text style={styles.value}>{formatMoney(receipt.previousBalance, currency)}</Text></View>
          <View style={styles.balanceRow}><Text>Remaining balance</Text><Text style={styles.value}>{formatMoney(receipt.remainingBalance, currency)}</Text></View>
        </View>
        {receipt.reference ? <Text style={{ ...styles.subtitle, marginTop: 12 }}>Reference: {receipt.reference}</Text> : null}
        <Text style={styles.footer}>Thank you. Keep this receipt for your records.</Text>
      </Page>
    </Document>
  );
}
