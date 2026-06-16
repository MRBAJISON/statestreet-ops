// Builds a formatted Excel workbook (ExcelJS) from captured entries.
// One sheet per department (+ a Stores sheet). Each sheet shows, per form type,
// a monthly-summary block followed by detailed day-by-day rows (grouped by month).
import ExcelJS from 'exceljs';
import type { Entry } from './db/schema';
import { STORE_LABELS, BRAND_LABELS, CATEGORY_LABELS, EXPENSE_LABELS, labelFor, PAYMENT_MODES, payKey } from './config';

type P = Record<string, unknown>;
export type ExportScope = 'all' | 'finance' | 'commercial' | 'marketing' | 'inventory' | 'brand' | 'store';

const SCOPE_LABEL: Record<ExportScope, string> = {
  all: 'All departments', finance: 'Finance & Stores', commercial: 'Commercial',
  marketing: 'Marketing', inventory: 'Inventory', brand: 'Brand', store: 'My Store',
};

// Target types are configuration, not captured operational data — leave them out.
const EXCLUDED_TYPES = new Set(['weekly-target', 'exec-target', 'exec-target-annual']);

const DEPT_SHEETS: { name: string; dept: string }[] = [
  { name: 'Finance', dept: 'finance' },
  { name: 'Commercial', dept: 'commercial' },
  { name: 'Marketing', dept: 'marketing' },
  { name: 'Operations', dept: 'operations' },
  { name: 'Inventory', dept: 'inventory' },
  { name: 'Brand', dept: 'brand' },
];

// The Stores sheet = everything store managers submit.
const isStoreEntry = (e: Entry) =>
  (e.department === 'finance' && e.formType === 'revenue') ||
  (e.department === 'inventory' && e.formType === 'store-transfer') ||
  (e.department === 'commercial' && e.formType === 'weekly-review');

const FORM_TYPE_LABELS: Record<string, string> = {
  revenue: 'Daily Revenue', expenses: 'Expenses', cashflow: 'Cash Flow', debtors: 'Debtors & Creditors',
  budget: 'Budget', capital: 'Capital & Investment', forecast: 'Forecast',
  'store-sales': 'Store Sales', 'category-perf': 'Category Performance', 'sku-entry': 'SKU Performance',
  'new-arrivals': 'New Arrivals', accountability: 'Accountability', 'weekly-review': 'Weekly Reviews',
  'store-audit': 'Store Standards', 'vm-check': 'VM Compliance', maintenance: 'Maintenance',
  incident: 'Incidents', 'sop-check': 'SOP Compliance', 'cx-feedback': 'Customer Experience', hr: 'Human Resources',
  'stock-count': 'Stock Counts', 'goods-receipt': 'Goods Receipts', 'dead-stock': 'Dead Stock',
  replenishment: 'Replenishment', 'stock-transfer': 'Stock Transfers (Inventory)', 'store-transfer': 'Store Transfers',
  'brand-score': 'Brand Scores', sentiment: 'Sentiment', competitor: 'Competitor Watch', digital: 'Digital Reputation',
  voice: 'Customer Voice', attention: 'CEO Attention', leads: 'Leads', campaign: 'Campaigns', social: 'Social Media',
  clienteling: 'Clienteling', 'customer-experience': 'Customer Experience', 'customer-intel': 'Customer Intel',
  priorities: 'Action Tracker',
};

const FIELD_LABELS: Record<string, string> = {
  store: 'Store', fromStore: 'From Store', toStore: 'To Store', category: 'Category', brand: 'Brand', supplier: 'Supplier',
  grossRevenue: 'Gross Revenue', cogs: 'COGS', discounts: 'Discounts', netRevenue: 'Net Revenue',
  transactions: 'Transactions', footfall: 'Footfall', itemsSold: 'Items Sold', amount: 'Amount', budget: 'Budget',
  type: 'Type', status: 'Status', reason: 'Reason', priority: 'Priority', severity: 'Severity', weekEnd: 'Week Ending',
  manager: 'Manager', achievement: 'Achievement %', actualSales: 'Actual Sales', weeklySalesTarget: 'Weekly Target',
  staffTotal: 'Staff (Total)', staffPresent: 'Staff Present', absences: 'Absences', attendance: 'Attendance %',
  punctuality: 'Punctuality %', training: 'Training %', qty: 'Quantity', units: 'Units', unitValue: 'Unit Value',
  totalValue: 'Total Value', systemQty: 'System Qty', physicalQty: 'Physical Qty', variance: 'Variance',
  openingStock: 'Opening Stock', customers: 'Customers', newCustomers: 'New Customers',
  returningCustomers: 'Returning Customers', discoverySource: 'Discovered Via', paymentsTotal: 'Payments Total',
  // Closing-report payment modes (pay_*):
  ...Object.fromEntries(PAYMENT_MODES.map((m) => [payKey(m.value), `Pay: ${m.label}`])),
};

// Numeric fields that must NOT be summed in the monthly block (years, %, rates, scores,
// per-unit values). They still appear in the detailed rows.
const NON_ADDITIVE = new Set([
  'year', 'achievement', 'attendance', 'punctuality', 'training', 'gm', 'grossMargin', 'sellThrough',
  'convRate', 'rating', 'nps', 'compliance', 'opsScore', 'vmScore', 'readinessScore', 'cxScore',
  'cleanScore', 'safetyScore', 'overallVM', 'windowDisplay', 'mannequin', 'productPresentation', 'signage',
  'unitValue', 'googleRating', 'trustpilot', 'responseRate', 'instaSentiment', 'momentum', 'sov', 'roas',
  'daysInStock', 'currentStock', 'reorderQty', 'staffTotal', 'staffPresent', 'openingStock',
]);

const prettify = (k: string) =>
  k.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const fieldLabel = (k: string) => FIELD_LABELS[k] ?? prettify(k);
const formLabel = (t: string) => FORM_TYPE_LABELS[t] ?? prettify(t);

const num = (v: unknown) => Number(String(v ?? '').replace(/[, ]/g, ''));
const isNumeric = (v: unknown) => v !== '' && v !== null && v !== undefined && Number.isFinite(num(v));

function entryDate(e: Entry): Date {
  const p = e.payload as P;
  const cand = p.date ?? p.datetime ?? p.weekEnd ?? e.createdAt;
  const d = new Date(String(cand));
  return isNaN(d.getTime()) ? new Date(e.createdAt as unknown as string) : d;
}
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d: Date) => d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

// Resolve coded values (store / brand / category) to friendly labels.
function display(key: string, v: unknown): string | number {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return ''; // skip nested grids (categories/ceo/declaration)
  if (/store$/i.test(key) || key === 'store') return labelFor(STORE_LABELS, v);
  if (key === 'brand') return labelFor(BRAND_LABELS, v);
  if (key === 'category') return CATEGORY_LABELS[String(v)] ?? EXPENSE_LABELS[String(v)] ?? String(v);
  if (key === 'item') return labelFor(EXPENSE_LABELS, v);
  return isNumeric(v) ? num(v) : String(v);
}

const GOLD = 'FFC8A951';
const DARK = 'FF1F2937';
const LIGHT = 'FFF3ECD8';

function buildSheet(wb: ExcelJS.Workbook, name: string, entries: Entry[], scope: ExportScope) {
  const ws = wb.addWorksheet(name, { properties: { defaultColWidth: 16 } });
  const widths: number[] = [];
  const track = (vals: (string | number)[]) =>
    vals.forEach((v, i) => { widths[i] = Math.max(widths[i] ?? 10, String(v ?? '').length + 2); });

  // Title
  const title = ws.addRow([`${name.toUpperCase()} — DATA EXPORT`]);
  title.font = { bold: true, size: 14 };
  ws.addRow([`Generated ${isoDate(new Date())} · Scope: ${SCOPE_LABEL[scope]}`]).font = { italic: true, color: { argb: 'FF6B7280' } };
  ws.addRow([]);

  if (entries.length === 0) {
    ws.addRow(['No data captured yet.']).font = { italic: true, color: { argb: 'FF6B7280' } };
    ws.columns.forEach((c) => (c.width = 24));
    return;
  }

  // Group by form type.
  const byType = new Map<string, Entry[]>();
  for (const e of entries) {
    if (EXCLUDED_TYPES.has(e.formType)) continue;
    if (!byType.has(e.formType)) byType.set(e.formType, []);
    byType.get(e.formType)!.push(e);
  }

  const sectionHeader = (text: string) => {
    const r = ws.addRow([text]);
    r.font = { bold: true, color: { argb: 'FF000000' }, size: 12 };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } };
    return r;
  };
  const styleHeaderRow = (r: ExcelJS.Row, span: number) => {
    for (let i = 1; i <= span; i++) {
      const c = r.getCell(i);
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
    }
  };

  for (const [type, rows] of [...byType.entries()].sort((a, b) => formLabel(a[0]).localeCompare(formLabel(b[0])))) {
    const sorted = [...rows].sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime());

    // Determine scalar columns (union of keys, skipping nested/date fields).
    const keys: string[] = [];
    for (const e of sorted) {
      for (const [k, v] of Object.entries(e.payload as P)) {
        if (k === 'date' || k === 'datetime') continue;
        if (typeof v === 'object' && v !== null) continue;
        if (!keys.includes(k)) keys.push(k);
      }
    }
    const numericKeys = keys.filter((k) => sorted.some((e) => isNumeric((e.payload as P)[k])) && sorted.every((e) => { const v = (e.payload as P)[k]; return v === '' || v === undefined || v === null || isNumeric(v); }));

    // ---- Monthly summary (only additive figures get summed) ----
    const summaryKeys = numericKeys.filter((k) => !NON_ADDITIVE.has(k));
    sectionHeader(`${formLabel(type)} — Monthly Summary`);
    const sumHeader = ['Month', 'Records', ...summaryKeys.map(fieldLabel)];
    track(sumHeader);
    styleHeaderRow(ws.addRow(sumHeader), sumHeader.length);
    const months = new Map<string, { label: string; count: number; sums: Record<string, number> }>();
    for (const e of sorted) {
      const mk = monthKey(entryDate(e));
      if (!months.has(mk)) months.set(mk, { label: monthLabel(entryDate(e)), count: 0, sums: {} });
      const m = months.get(mk)!;
      m.count += 1;
      for (const k of summaryKeys) if (isNumeric((e.payload as P)[k])) m.sums[k] = (m.sums[k] ?? 0) + num((e.payload as P)[k]);
    }
    const totals: Record<string, number> = {};
    let totalCount = 0;
    for (const [, m] of [...months.entries()].sort()) {
      const row = [m.label, m.count, ...summaryKeys.map((k) => Math.round((m.sums[k] ?? 0) * 100) / 100)];
      track(row);
      ws.addRow(row);
      totalCount += m.count;
      for (const k of summaryKeys) totals[k] = (totals[k] ?? 0) + (m.sums[k] ?? 0);
    }
    const totalRow = ws.addRow(['TOTAL', totalCount, ...summaryKeys.map((k) => Math.round((totals[k] ?? 0) * 100) / 100)]);
    totalRow.font = { bold: true };
    for (let i = 1; i <= sumHeader.length; i++) totalRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
    ws.addRow([]);

    // ---- Detailed rows (grouped by month) ----
    sectionHeader(`${formLabel(type)} — Detailed`);
    const detHeader = ['Date', ...keys.map(fieldLabel)];
    track(detHeader);
    styleHeaderRow(ws.addRow(detHeader), detHeader.length);
    let curMonth = '';
    for (const e of sorted) {
      const d = entryDate(e);
      const mk = monthKey(d);
      if (mk !== curMonth) {
        curMonth = mk;
        const sep = ws.addRow([`── ${monthLabel(d)} ──`]);
        sep.font = { bold: true, italic: true, color: { argb: 'FF6B7280' } };
      }
      const row = [isoDate(d), ...keys.map((k) => display(k, (e.payload as P)[k]))];
      track(row);
      ws.addRow(row);
    }
    ws.addRow([]);
    ws.addRow([]);
  }

  // Apply tracked column widths + a numeric format on number cells.
  ws.columns.forEach((col, i) => { col.width = Math.min(42, Math.max(12, widths[i] ?? 14)); });
}

// A store's own submissions span store (sales), fromStore (transfers) and reviews.
const storeMatches = (e: Entry, store: string) => {
  const p = e.payload as P;
  return String(p.store ?? '') === store || String(p.fromStore ?? '') === store;
};

export async function buildWorkbook(scope: ExportScope, entries: Entry[], opts?: { store?: string }): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'StateStreet Ops';
  wb.created = new Date();

  if (scope === 'store') {
    const store = opts?.store ?? '';
    buildSheet(wb, 'My Store', entries.filter((e) => isStoreEntry(e) && storeMatches(e, store)), scope);
  } else {
    const sheets = scope === 'all' ? DEPT_SHEETS : DEPT_SHEETS.filter((s) => s.dept === scope);
    for (const s of sheets) {
      buildSheet(wb, s.name, entries.filter((e) => e.department === s.dept), scope);
    }
    // Stores roll-up alongside the full export and the finance scope (as before).
    if (scope === 'all' || scope === 'finance') {
      buildSheet(wb, 'Stores', entries.filter(isStoreEntry), scope);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
