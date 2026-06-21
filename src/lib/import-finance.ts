// Excel/CSV parsing + validation for the Finance bulk importer (Expenses + Budget).
// Server-side (Node) — uses ExcelJS, the same library the export route uses.
import ExcelJS from 'exceljs';
import type { OrgSettings } from './org';

type Cell = unknown;

// ExcelJS cell values can be Dates, rich-text/formula objects, numbers or strings.
function cellStr(v: Cell): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text;
    if (o.result != null) return String(o.result);
    if (Array.isArray(o.richText)) return (o.richText as { text?: string }[]).map((r) => r.text ?? '').join('');
    return '';
  }
  return String(v);
}

function cellNum(v: Cell): number {
  if (typeof v === 'number') return v;
  const s = cellStr(v).replace(/ghs/gi, '').replace(/[,\s₵$]/g, '').trim();
  if (!s) return NaN;
  const n = Number(s);
  return isNaN(n) ? NaN : n;
}

// Best-effort date → YYYY-MM-DD. Handles Date cells, Excel serial numbers and strings.
function toISODate(v: Cell): string {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'number' && isFinite(v)) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const s = cellStr(v).trim();
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

const normKey = (s: string) => s.toLowerCase().replace(/[\s_]/g, '');

// Header aliases → canonical field name (so column order/spelling is forgiving).
const EXP_ALIASES: Record<string, string> = {
  date: 'date', category: 'category', expensecategory: 'category',
  store: 'store', storedepartment: 'store', department: 'store',
  amount: 'amount', vendor: 'vendor', vendorpayee: 'vendor', payee: 'vendor',
  invoice: 'invoice', invoicenumber: 'invoice',
  paymentmethod: 'paymentMethod', paymentmode: 'paymentMethod',
  description: 'description',
};
const BUD_ALIASES: Record<string, string> = {
  year: 'year', budgetitem: 'item', item: 'item', category: 'item',
  amount: 'amount', annualbudgetedamount: 'amount', budgetamount: 'amount', budget: 'amount',
  notes: 'notes',
};

export interface RowError { rowNum: number; messages: string[]; values: Record<string, string> }
export interface ExpenseData {
  date: string; category: string; store: string; amount: number;
  vendor: string; invoice: string; paymentMethod: string; description: string;
}
export interface BudgetData { year: string; item: string; amount: number; notes: string }
export interface ParsedExpense { rowNum: number; data: ExpenseData }
export interface ParsedBudget { rowNum: number; data: BudgetData }
export interface ParseResult {
  expenses: { valid: ParsedExpense[]; errors: RowError[] };
  budget: { valid: ParsedBudget[]; errors: RowError[] };
}

// Build a lowercase label/value → value lookup so a sheet may use either the
// friendly label ("Office Rent") or the stored value ("office-rent").
function lookup(opts: { label: string; value: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const o of opts) {
    if (o.label?.trim()) m.set(o.label.toLowerCase().trim(), o.value);
    if (o.value?.trim()) m.set(o.value.toLowerCase().trim(), o.value);
  }
  return m;
}

interface SheetRow { rowNum: number; cells: Record<string, Cell> }

function readSheetRows(ws: ExcelJS.Worksheet | undefined): SheetRow[] {
  if (!ws) return [];
  const headers: { col: number; key: string }[] = [];
  ws.getRow(1).eachCell((cell, col) => headers.push({ col, key: normKey(cellStr(cell.value)) }));
  const out: SheetRow[] = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const cells: Record<string, Cell> = {};
    for (const h of headers) cells[h.key] = row.getCell(h.col).value;
    if (Object.values(cells).every((v) => cellStr(v).trim() === '')) return; // skip blank rows
    out.push({ rowNum, cells });
  });
  return out;
}

function canonical(cells: Record<string, Cell>, aliases: Record<string, string>): Record<string, Cell> {
  const out: Record<string, Cell> = {};
  for (const [k, v] of Object.entries(cells)) {
    const canon = aliases[k];
    if (canon && !(canon in out)) out[canon] = v;
  }
  return out;
}

const MAX_ROWS = 1000;

export async function parseFinanceFile(buf: ArrayBuffer | Buffer, org: OrgSettings): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);

  const findSheet = (name: string) =>
    wb.worksheets.find((w) => w.name.toLowerCase().trim() === name);

  const catMap = lookup(org.expenseItems);
  const storeMap = lookup(org.stores);
  const mapVal = (raw: string, m: Map<string, string>) => m.get(raw.toLowerCase().trim()) ?? '';

  // ---- Expenses ----
  const expRows = readSheetRows(findSheet('expenses')).slice(0, MAX_ROWS);
  const expValid: ParsedExpense[] = [];
  const expErrors: RowError[] = [];
  for (const { rowNum, cells } of expRows) {
    const c = canonical(cells, EXP_ALIASES);
    const messages: string[] = [];
    const date = toISODate(c.date);
    if (!date) messages.push('Missing or invalid Date (use YYYY-MM-DD)');
    const catRaw = cellStr(c.category).trim();
    const category = mapVal(catRaw, catMap);
    if (!catRaw) messages.push('Missing Category');
    else if (!category) messages.push(`Unknown Category "${catRaw}"`);
    const storeRaw = cellStr(c.store).trim();
    let store = '';
    if (storeRaw) {
      store = mapVal(storeRaw, storeMap);
      if (!store) messages.push(`Unknown Store "${storeRaw}"`);
    }
    const amount = cellNum(c.amount);
    if (!(amount > 0)) messages.push('Amount must be a positive number');
    const values = { Date: cellStr(c.date), Category: catRaw, Amount: cellStr(c.amount) };
    if (messages.length) { expErrors.push({ rowNum, messages, values }); continue; }
    expValid.push({
      rowNum,
      data: {
        date, category, store, amount,
        vendor: cellStr(c.vendor).trim(),
        invoice: cellStr(c.invoice).trim(),
        paymentMethod: cellStr(c.paymentMethod).trim(),
        description: cellStr(c.description).trim(),
      },
    });
  }

  // ---- Budget ----
  const budRows = readSheetRows(findSheet('budget')).slice(0, MAX_ROWS);
  const budValid: ParsedBudget[] = [];
  const budErrors: RowError[] = [];
  for (const { rowNum, cells } of budRows) {
    const c = canonical(cells, BUD_ALIASES);
    const messages: string[] = [];
    const year = Math.trunc(cellNum(c.year));
    if (!(year >= 2024 && year <= 2100)) messages.push('Year must be between 2024 and 2100');
    const itemRaw = cellStr(c.item).trim();
    const item = mapVal(itemRaw, catMap);
    if (!itemRaw) messages.push('Missing Budget Item');
    else if (!item) messages.push(`Unknown Budget Item "${itemRaw}"`);
    const amount = cellNum(c.amount);
    if (!(amount > 0)) messages.push('Amount must be a positive number');
    const values = { Year: cellStr(c.year), 'Budget Item': itemRaw, Amount: cellStr(c.amount) };
    if (messages.length) { budErrors.push({ rowNum, messages, values }); continue; }
    budValid.push({ rowNum, data: { year: String(year), item, amount, notes: cellStr(c.notes).trim() } });
  }

  return { expenses: { valid: expValid, errors: expErrors }, budget: { valid: budValid, errors: budErrors } };
}

// Downloadable template: Expenses + Budget sheets with headers + a Reference sheet
// listing the exact valid category/store names.
export async function buildFinanceTemplate(org: OrgSettings): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'StateStreet Ops';

  const exp = wb.addWorksheet('Expenses');
  exp.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Store', key: 'store', width: 18 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Vendor', key: 'vendor', width: 18 },
    { header: 'Invoice', key: 'invoice', width: 14 },
    { header: 'Payment Method', key: 'paymentMethod', width: 16 },
    { header: 'Description', key: 'description', width: 28 },
  ];
  exp.addRow({
    date: '2026-01-15', category: org.expenseItems[0]?.label ?? 'Rent',
    store: org.stores[0]?.label ?? '', amount: 1500, vendor: 'Example Vendor Ltd',
    invoice: 'INV-0001', paymentMethod: 'Bank Transfer', description: 'Example — delete this row',
  });

  const bud = wb.addWorksheet('Budget');
  bud.columns = [
    { header: 'Year', key: 'year', width: 10 },
    { header: 'Budget Item', key: 'item', width: 24 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];
  bud.addRow({ year: new Date().getFullYear(), item: org.expenseItems[0]?.label ?? 'Rent', amount: 120000, notes: 'Example — delete this row' });

  for (const ws of [exp, bud]) {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE3BF' } };
  }

  const ref = wb.addWorksheet('Reference');
  ref.getColumn(1).width = 30;
  ref.addRow(['HOW TO USE']).font = { bold: true };
  ref.addRow(['• Fill the Expenses and Budget sheets. Delete the example rows.']);
  ref.addRow(['• Dates must be YYYY-MM-DD. Amounts must be numbers.']);
  ref.addRow(['• Category / Budget Item must match a name below exactly.']);
  ref.addRow([]);
  ref.addRow(['VALID CATEGORIES / BUDGET ITEMS']).font = { bold: true };
  for (const i of org.expenseItems) if (i.label?.trim()) ref.addRow([i.label]);
  ref.addRow([]);
  ref.addRow(['VALID STORES']).font = { bold: true };
  for (const s of org.stores) if (s.label?.trim()) ref.addRow([s.label]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
