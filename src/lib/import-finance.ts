// Excel parsing, typed-reference resolution, and atomic SQL for Finance imports.
import ExcelJS from 'exceljs';
import { asc, eq, sql, type SQL } from 'drizzle-orm';

type Cell = unknown;

export interface FinanceImportReference {
  id: number;
  code: string;
  name: string;
}

export interface FinanceImportReferences {
  expenseCategories: FinanceImportReference[];
  stores: FinanceImportReference[];
  paymentMethods: FinanceImportReference[];
}

export class FinanceImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinanceImportFileError';
  }
}

export async function loadFinanceImportReferences(): Promise<FinanceImportReferences> {
  const [{ db }, schema] = await Promise.all([import('./db'), import('./db/foundation-schema')]);
  const [categoryRows, storeRows, paymentRows] = await Promise.all([
    db
      .select({ id: schema.expenseCategories.id, code: schema.expenseCategories.code, name: schema.expenseCategories.name })
      .from(schema.expenseCategories)
      .where(eq(schema.expenseCategories.active, true))
      .orderBy(asc(schema.expenseCategories.sortOrder), asc(schema.expenseCategories.name)),
    db
      .select({ id: schema.stores.id, code: schema.stores.code, name: schema.stores.name })
      .from(schema.stores)
      .where(eq(schema.stores.active, true))
      .orderBy(asc(schema.stores.name)),
    db
      .select({ id: schema.paymentMethods.id, code: schema.paymentMethods.code, name: schema.paymentMethods.name })
      .from(schema.paymentMethods)
      .where(eq(schema.paymentMethods.active, true))
      .orderBy(asc(schema.paymentMethods.sortOrder), asc(schema.paymentMethods.name)),
  ]);
  return { expenseCategories: categoryRows, stores: storeRows, paymentMethods: paymentRows };
}

// ExcelJS cell values can be Dates, rich-text/formula objects, numbers, or strings.
function cellStr(value: Cell): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (typeof object.text === 'string') return object.text;
    if (object.result != null) return String(object.result);
    if (Array.isArray(object.richText)) {
      return (object.richText as { text?: string }[]).map((part) => part.text ?? '').join('');
    }
    return '';
  }
  return String(value);
}

function cellNum(value: Cell): number {
  if (typeof value === 'number') return value;
  const normalized = cellStr(value).replace(/ghs/gi, '').replace(/[,\s₵$]/g, '').trim();
  if (!normalized) return Number.NaN;
  const number = Number(normalized);
  return Number.isNaN(number) ? Number.NaN : number;
}

function parseMoney(value: Cell): { amount: number; decimal: string } | null {
  const amount = cellNum(value);
  if (!(amount > 0) || amount > 999_999_999_999.99) return null;
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 0.000_001) return null;
  return { amount, decimal: (cents / 100).toFixed(2) };
}

// Best-effort date to YYYY-MM-DD. Handles Date cells, Excel serial numbers, and strings.
function toISODate(value: Cell): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86_400_000));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }
  if (value && typeof value === 'object') {
    const result = (value as Record<string, unknown>).result;
    if (result != null) return toISODate(result);
  }
  const raw = cellStr(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === raw ? raw : '';
}

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

// Header aliases to canonical field names so column order and common spellings are forgiving.
const EXPENSE_ALIASES: Record<string, string> = {
  date: 'date',
  category: 'category',
  expensecategory: 'category',
  store: 'store',
  storedepartment: 'store',
  department: 'store',
  amount: 'amount',
  vendor: 'vendor',
  vendorpayee: 'vendor',
  payee: 'vendor',
  invoice: 'invoice',
  invoicenumber: 'invoice',
  paymentmethod: 'paymentMethod',
  paymentmode: 'paymentMethod',
  description: 'description',
  overspendreason: 'overspendReason',
  overspendjustification: 'overspendReason',
  budgetexceptionreason: 'overspendReason',
};

const BUDGET_ALIASES: Record<string, string> = {
  year: 'year',
  budgetitem: 'item',
  item: 'item',
  category: 'item',
  amount: 'amount',
  annualbudgetedamount: 'amount',
  budgetamount: 'amount',
  budget: 'amount',
  notes: 'notes',
};

export interface RowError {
  rowNum: number;
  messages: string[];
  values: Record<string, string>;
}

export interface ExpenseData {
  date: string;
  category: string;
  expenseCategoryId: number;
  store: string;
  storeId: number | null;
  amount: number;
  amountDecimal: string;
  vendor: string;
  invoice: string;
  paymentMethod: string;
  paymentMethodId: number | null;
  description: string;
  overspendReason: string;
}

export interface BudgetData {
  year: string;
  yearNumber: number;
  item: string;
  expenseCategoryId: number;
  amount: number;
  amountDecimal: string;
  notes: string;
}

export interface ParsedExpense {
  rowNum: number;
  data: ExpenseData;
}

export interface ParsedBudget {
  rowNum: number;
  data: BudgetData;
}

export interface ParseResult {
  expenses: { valid: ParsedExpense[]; errors: RowError[] };
  budget: { valid: ParsedBudget[]; errors: RowError[] };
}

type ReferenceLookup = Map<string, FinanceImportReference | null>;

function referenceLookup(options: FinanceImportReference[]): ReferenceLookup {
  const result: ReferenceLookup = new Map();
  for (const option of options) {
    for (const label of [option.name, option.code]) {
      const key = label.toLowerCase().trim();
      if (!key) continue;
      const existing = result.get(key);
      if (existing === undefined || existing?.id === option.id) result.set(key, option);
      else result.set(key, null);
    }
  }
  return result;
}

interface SheetRow {
  rowNum: number;
  cells: Record<string, Cell>;
}

function readSheetRows(worksheet: ExcelJS.Worksheet | undefined): SheetRow[] {
  if (!worksheet) return [];
  const headers: { column: number; key: string }[] = [];
  worksheet.getRow(1).eachCell((cell, column) => {
    headers.push({ column, key: normalizeKey(cellStr(cell.value)) });
  });
  const rows: SheetRow[] = [];
  worksheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const cells: Record<string, Cell> = {};
    for (const header of headers) cells[header.key] = row.getCell(header.column).value;
    if (Object.values(cells).every((value) => cellStr(value).trim() === '')) return;
    rows.push({ rowNum, cells });
  });
  return rows;
}

function canonical(cells: Record<string, Cell>, aliases: Record<string, string>): Record<string, Cell> {
  const result: Record<string, Cell> = {};
  for (const [key, value] of Object.entries(cells)) {
    const canonicalKey = aliases[key];
    if (canonicalKey && !(canonicalKey in result)) result[canonicalKey] = value;
  }
  return result;
}

const MAX_ROWS = 1000;

export async function parseFinanceFile(
  buffer: ArrayBuffer | Buffer,
  references: FinanceImportReferences
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);
  const findSheet = (name: string) =>
    workbook.worksheets.find((worksheet) => worksheet.name.toLowerCase().trim() === name);
  const categoryLookup = referenceLookup(references.expenseCategories);
  const storeLookup = referenceLookup(references.stores);
  const paymentLookup = referenceLookup(references.paymentMethods);
  const resolve = (raw: string, lookup: ReferenceLookup) => lookup.get(raw.toLowerCase().trim());

  const expenseRows = readSheetRows(findSheet('expenses'));
  if (expenseRows.length > MAX_ROWS) {
    throw new FinanceImportFileError(`Expenses sheet exceeds the ${MAX_ROWS.toLocaleString()} row limit`);
  }
  const validExpenses: ParsedExpense[] = [];
  const expenseErrors: RowError[] = [];
  for (const { rowNum, cells } of expenseRows) {
    const fields = canonical(cells, EXPENSE_ALIASES);
    const messages: string[] = [];
    const date = toISODate(fields.date);
    if (!date) messages.push('Missing or invalid Date (use YYYY-MM-DD)');

    const categoryRaw = cellStr(fields.category).trim();
    const category = categoryRaw ? resolve(categoryRaw, categoryLookup) : undefined;
    if (!categoryRaw) messages.push('Missing Category');
    else if (category === null) messages.push(`Ambiguous Category "${categoryRaw}"; use a unique code`);
    else if (!category) messages.push(`Unknown Category "${categoryRaw}"`);

    const storeRaw = cellStr(fields.store).trim();
    const store = storeRaw ? resolve(storeRaw, storeLookup) : undefined;
    if (store === null) messages.push(`Ambiguous Store "${storeRaw}"; use a unique code`);
    else if (storeRaw && !store) messages.push(`Unknown Store "${storeRaw}"`);

    const paymentRaw = cellStr(fields.paymentMethod).trim();
    const paymentMethod = paymentRaw ? resolve(paymentRaw, paymentLookup) : undefined;
    if (paymentMethod === null) messages.push(`Ambiguous Payment Method "${paymentRaw}"; use a unique code`);
    else if (paymentRaw && !paymentMethod) messages.push(`Unknown Payment Method "${paymentRaw}"`);

    const money = parseMoney(fields.amount);
    if (!money) messages.push('Amount must be a positive number with at most 2 decimal places');

    const description = cellStr(fields.description).trim();
    if (!description) messages.push('Missing Description');
    const overspendReason = cellStr(fields.overspendReason).trim();
    if (overspendReason.length > 1000) messages.push('Overspend Reason must be 1000 characters or fewer');

    const values = {
      Date: cellStr(fields.date),
      Category: categoryRaw,
      Amount: cellStr(fields.amount),
    };
    if (messages.length || !category || !money) {
      expenseErrors.push({ rowNum, messages, values });
      continue;
    }
    validExpenses.push({
      rowNum,
      data: {
        date,
        category: category.code,
        expenseCategoryId: category.id,
        store: store?.code ?? '',
        storeId: store?.id ?? null,
        amount: money.amount,
        amountDecimal: money.decimal,
        vendor: cellStr(fields.vendor).trim(),
        invoice: cellStr(fields.invoice).trim(),
        paymentMethod: paymentMethod?.code ?? '',
        paymentMethodId: paymentMethod?.id ?? null,
        description,
        overspendReason,
      },
    });
  }

  const budgetRows = readSheetRows(findSheet('budget'));
  if (budgetRows.length > MAX_ROWS) {
    throw new FinanceImportFileError(`Budget sheet exceeds the ${MAX_ROWS.toLocaleString()} row limit`);
  }
  const validBudgets: ParsedBudget[] = [];
  const budgetErrors: RowError[] = [];
  const firstBudgetRowByKey = new Map<string, number>();
  for (const { rowNum, cells } of budgetRows) {
    const fields = canonical(cells, BUDGET_ALIASES);
    const messages: string[] = [];
    const year = cellNum(fields.year);
    const validYear = Number.isInteger(year) && year >= 2024 && year <= 2100;
    if (!validYear) messages.push('Year must be a whole number between 2024 and 2100');

    const itemRaw = cellStr(fields.item).trim();
    const category = itemRaw ? resolve(itemRaw, categoryLookup) : undefined;
    if (!itemRaw) messages.push('Missing Budget Item');
    else if (category === null) messages.push(`Ambiguous Budget Item "${itemRaw}"; use a unique code`);
    else if (!category) messages.push(`Unknown Budget Item "${itemRaw}"`);

    const money = parseMoney(fields.amount);
    if (!money) messages.push('Amount must be a positive number with at most 2 decimal places');

    if (category && money && validYear) {
      const key = `${year}::${category.id}`;
      const firstRow = firstBudgetRowByKey.get(key);
      if (firstRow) messages.push(`Duplicate Budget Item and Year (first entered on row ${firstRow})`);
      else firstBudgetRowByKey.set(key, rowNum);
    }

    const values = { Year: cellStr(fields.year), 'Budget Item': itemRaw, Amount: cellStr(fields.amount) };
    if (messages.length || !category || !money) {
      budgetErrors.push({ rowNum, messages, values });
      continue;
    }
    validBudgets.push({
      rowNum,
      data: {
        year: String(year),
        yearNumber: year,
        item: category.code,
        expenseCategoryId: category.id,
        amount: money.amount,
        amountDecimal: money.decimal,
        notes: cellStr(fields.notes).trim(),
      },
    });
  }

  return {
    expenses: { valid: validExpenses, errors: expenseErrors },
    budget: { valid: validBudgets, errors: budgetErrors },
  };
}

export interface ExistingBudgetForImport {
  id: number;
  year: number;
  expenseCategoryId: number;
  storeId: number | null;
  amount: string;
  notes: string | null;
  importBatchId: number | null;
  importSourceRow: number | null;
  createdByUserId: number;
  updatedByUserId: number;
  updatedAt: Date | string;
}

export interface BudgetConflict {
  rowNum: number;
  data: BudgetData;
  key: string;
  existingAmount: number;
}

export interface FinanceBudgetWrite {
  rowNum: number;
  data: BudgetData;
  operation: 'insert' | 'update';
  existing?: ExistingBudgetForImport;
}

function timestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function budgetConflictKey(row: ParsedBudget, existing: ExistingBudgetForImport): string {
  return [
    row.rowNum,
    row.data.year,
    row.data.item,
    row.data.amountDecimal,
    row.data.notes,
    existing.id,
    timestamp(existing.updatedAt),
    existing.amount,
    existing.notes ?? '',
    existing.updatedByUserId,
    existing.importBatchId ?? '',
    existing.importSourceRow ?? '',
  ]
    .map((part) => encodeURIComponent(String(part)))
    .join('::');
}

export function planBudgetImport(
  rows: ParsedBudget[],
  existingRows: ExistingBudgetForImport[],
  decisions: Record<string, 'allow' | 'deny'> = {}
): {
  newRows: ParsedBudget[];
  conflicts: BudgetConflict[];
  writes: FinanceBudgetWrite[];
  skipped: number;
} {
  const existingByKey = new Map(
    existingRows
      .filter((row) => row.storeId === null)
      .map((row) => [`${row.year}::${row.expenseCategoryId}`, row] as const)
  );
  const newRows: ParsedBudget[] = [];
  const conflicts: BudgetConflict[] = [];
  const writes: FinanceBudgetWrite[] = [];
  let skipped = 0;

  for (const row of rows) {
    const existing = existingByKey.get(`${row.data.yearNumber}::${row.data.expenseCategoryId}`);
    if (!existing) {
      newRows.push(row);
      writes.push({ rowNum: row.rowNum, data: row.data, operation: 'insert' });
      continue;
    }
    const key = budgetConflictKey(row, existing);
    conflicts.push({ rowNum: row.rowNum, data: row.data, key, existingAmount: Number(existing.amount) });
    if (decisions[key] === 'allow') {
      writes.push({ rowNum: row.rowNum, data: row.data, operation: 'update', existing });
    } else {
      skipped += 1;
    }
  }

  return { newRows, conflicts, writes, skipped };
}

export function staleAllowedBudgetDecisions(
  decisions: Record<string, 'allow' | 'deny'>,
  conflicts: BudgetConflict[]
): string[] {
  const currentKeys = new Set(conflicts.map((conflict) => conflict.key));
  return Object.entries(decisions)
    .filter(([key, decision]) => decision === 'allow' && !currentKeys.has(key))
    .map(([key]) => key);
}

export interface FinanceImportCommitInput {
  filename: string;
  actorUserId: number;
  actorName: string;
  parsed: ParseResult;
  budgetWrites: FinanceBudgetWrite[];
  budgetSkipped: number;
}

export function buildCommitFinanceImportQuery(input: FinanceImportCommitInput): SQL {
  const expenses = input.parsed.expenses.valid.map((row) => ({
    source_row: row.rowNum,
    business_date: row.data.date,
    expense_category_id: row.data.expenseCategoryId,
    store_id: row.data.storeId,
    amount: row.data.amountDecimal,
    vendor: row.data.vendor || null,
    invoice_reference: row.data.invoice || null,
    payment_method_id: row.data.paymentMethodId,
    description: row.data.description,
    overspend_reason: row.data.overspendReason || null,
  }));
  const budgets = input.budgetWrites.map((row) => ({
    source_row: row.rowNum,
    year: row.data.yearNumber,
    expense_category_id: row.data.expenseCategoryId,
    amount: row.data.amountDecimal,
    notes: row.data.notes || null,
    operation: row.operation,
    existing_id: row.existing?.id ?? null,
    expected_amount: row.existing?.amount ?? null,
    expected_notes: row.existing?.notes ?? null,
    expected_import_batch_id: row.existing?.importBatchId ?? null,
    expected_import_source_row: row.existing?.importSourceRow ?? null,
    expected_created_by_user_id: row.existing?.createdByUserId ?? null,
    expected_updated_by_user_id: row.existing?.updatedByUserId ?? null,
    expected_updated_at: row.existing ? timestamp(row.existing.updatedAt) : null,
  }));
  const expensesAdded = expenses.length;
  const budgetAdded = input.budgetWrites.filter((row) => row.operation === 'insert').length;
  const budgetUpdated = input.budgetWrites.filter((row) => row.operation === 'update').length;
  const importedRows = expensesAdded + budgetAdded + budgetUpdated;
  const expenseErrors = input.parsed.expenses.errors.length;
  const budgetErrors = input.parsed.budget.errors.length;
  const totalRows =
    input.parsed.expenses.valid.length +
    expenseErrors +
    input.parsed.budget.valid.length +
    budgetErrors;
  const summary = {
    filename: input.filename,
    uploadedBy: input.actorName,
    expensesAdded,
    budgetAdded,
    budgetUpdated,
    budgetSkipped: input.budgetSkipped,
    expenseErrors,
    budgetErrors,
  };

  return sql`
    with expense_input as materialized (
      select *
      from jsonb_to_recordset(${JSON.stringify(expenses)}::jsonb) as row(
        source_row integer,
        business_date date,
        expense_category_id bigint,
        store_id bigint,
        amount numeric(14, 2),
        vendor text,
        invoice_reference text,
        payment_method_id bigint,
        description text,
        overspend_reason text
      )
    ), budget_input as materialized (
      select *
      from jsonb_to_recordset(${JSON.stringify(budgets)}::jsonb) as row(
        source_row integer,
        year integer,
        expense_category_id bigint,
        amount numeric(14, 2),
        notes text,
        operation text,
        existing_id bigint,
        expected_amount numeric(14, 2),
        expected_notes text,
        expected_import_batch_id bigint,
        expected_import_source_row integer,
        expected_created_by_user_id integer,
        expected_updated_by_user_id integer,
        expected_updated_at timestamptz
      )
    ), expense_budget_groups as materialized (
      select
        grouped.budget_year,
        grouped.expense_category_id,
        grouped.store_id,
        position.budget,
        position.actual
      from (
        select
          extract(year from business_date)::integer as budget_year,
          min(business_date) as business_date,
          expense_category_id,
          store_id
        from expense_input
        group by extract(year from business_date)::integer, expense_category_id, store_id
      ) grouped
      cross join lateral public.expense_budget_position(
        grouped.business_date,
        grouped.expense_category_id,
        grouped.store_id
      ) position
    ), expense_budget_rows as materialized (
      select
        input.*,
        position.budget,
        position.actual,
        sum(input.amount) over (
          partition by extract(year from input.business_date)::integer,
                       input.expense_category_id,
                       input.store_id
          order by input.business_date, input.source_row
          rows between unbounded preceding and current row
        ) as imported_actual
      from expense_input input
      join expense_budget_groups position
        on position.budget_year = extract(year from input.business_date)::integer
       and position.expense_category_id = input.expense_category_id
       and position.store_id is not distinct from input.store_id
    ), locked_budgets as materialized (
      select
        budget.id,
        budget.year,
        budget.expense_category_id,
        budget.store_id,
        budget.amount,
        budget.notes,
        budget.import_batch_id,
        budget.import_source_row,
        budget.created_by_user_id,
        budget.updated_by_user_id,
        budget.updated_at,
        to_jsonb(budget) as before_snapshot
      from budgets budget
      join budget_input input on input.operation = 'update' and input.existing_id = budget.id
      for update of budget
    ), validation_issues as materialized (
      select 'expenses'::text as sheet, input.source_row, 'inactive-expense-category'::text as reason
      from expense_budget_rows input
      where not exists (
        select 1 from expense_categories category
        where category.id = input.expense_category_id and category.active
      )
      union all
      select 'expenses', input.source_row, 'inactive-store'
      from expense_budget_rows input
      where input.store_id is not null and not exists (
        select 1 from stores store where store.id = input.store_id and store.active
      )
      union all
      select 'expenses', input.source_row, 'inactive-payment-method'
      from expense_budget_rows input
      where input.payment_method_id is not null and not exists (
        select 1 from payment_methods method where method.id = input.payment_method_id and method.active
      )
      union all
      select 'expenses', input.source_row, 'overspend-reason-required'
      from expense_budget_rows input
      where input.actual + input.imported_actual > input.budget
        and nullif(btrim(input.overspend_reason), '') is null
      union all
      select 'budget', input.source_row, 'inactive-expense-category'
      from budget_input input
      where not exists (
        select 1 from expense_categories category
        where category.id = input.expense_category_id and category.active
      )
      union all
      select 'budget', input.source_row, 'budget-now-exists'
      from budget_input input
      where input.operation = 'insert' and exists (
        select 1 from budgets budget
        where budget.store_id is null
          and budget.year = input.year
          and budget.expense_category_id = input.expense_category_id
      )
      union all
      select 'budget', input.source_row, 'budget-changed-since-preview'
      from budget_input input
      left join locked_budgets budget on budget.id = input.existing_id
      where input.operation = 'update' and (
        budget.id is null
        or budget.store_id is not null
        or budget.year is distinct from input.year
        or budget.expense_category_id is distinct from input.expense_category_id
        or budget.amount is distinct from input.expected_amount
        or budget.notes is distinct from input.expected_notes
        or budget.import_batch_id is distinct from input.expected_import_batch_id
        or budget.import_source_row is distinct from input.expected_import_source_row
        or budget.created_by_user_id is distinct from input.expected_created_by_user_id
        or budget.updated_by_user_id is distinct from input.expected_updated_by_user_id
        or date_trunc('milliseconds', budget.updated_at)
          is distinct from date_trunc('milliseconds', input.expected_updated_at)
      )
    ), validation as (
      select
        count(*)::integer as issue_count,
        coalesce(
          jsonb_agg(
            jsonb_build_object('sheet', sheet, 'rowNum', source_row, 'reason', reason)
            order by sheet, source_row, reason
          ),
          '[]'::jsonb
        ) as issues
      from validation_issues
    ), valid_commit as (
      select 1 as allowed from validation where issue_count = 0
    ), batch as (
      insert into import_batches (
        type, filename, status, total_rows, imported_rows, error_rows, summary,
        created_by_user_id, started_at, completed_at
      )
      select
        'finance', ${input.filename}, 'completed', ${totalRows}, ${importedRows},
        ${expenseErrors + budgetErrors}, ${JSON.stringify(summary)}::jsonb,
        ${input.actorUserId}, statement_timestamp(), statement_timestamp()
      from valid_commit
      returning *
    ), inserted_expenses as (
      insert into expenses (
        business_date, expense_category_id, store_id, amount, vendor, invoice_reference,
        payment_method_id, import_batch_id, import_source_row, description, overspend_reason,
        created_by_user_id, updated_by_user_id
      )
      select
        input.business_date, input.expense_category_id, input.store_id, input.amount,
        input.vendor, input.invoice_reference, input.payment_method_id, batch.id,
        input.source_row, input.description, input.overspend_reason,
        ${input.actorUserId}, ${input.actorUserId}
      from expense_budget_rows input
      cross join batch
      returning
        expenses.id as entity_id,
        expenses.import_source_row as source_row,
        to_jsonb(expenses) as after_snapshot
    ), inserted_budgets as (
      insert into budgets (
        year, expense_category_id, store_id, amount, notes, import_batch_id,
        import_source_row, created_by_user_id, updated_by_user_id
      )
      select
        input.year, input.expense_category_id, null, input.amount, input.notes,
        batch.id, input.source_row, ${input.actorUserId}, ${input.actorUserId}
      from budget_input input
      cross join batch
      where input.operation = 'insert'
      returning
        budgets.id as entity_id,
        budgets.import_source_row as source_row,
        to_jsonb(budgets) as after_snapshot
    ), updated_budgets as (
      update budgets target
      set
        amount = input.amount,
        notes = input.notes,
        import_batch_id = batch.id,
        import_source_row = input.source_row,
        updated_by_user_id = ${input.actorUserId},
        updated_at = statement_timestamp()
      from budget_input input
      cross join batch
      where input.operation = 'update' and target.id = input.existing_id
      returning
        target.id as entity_id,
        target.import_source_row as source_row,
        to_jsonb(target) as after_snapshot
    ), applied as materialized (
      select
        'expenses'::text as sheet,
        expense.source_row,
        'insert'::text as operation,
        'expense'::text as entity_type,
        expense.entity_id,
        null::jsonb as before_snapshot,
        expense.after_snapshot
      from inserted_expenses expense
      union all
      select
        'budget', budget.source_row, 'insert', 'budget', budget.entity_id,
        null::jsonb, budget.after_snapshot
      from inserted_budgets budget
      union all
      select
        'budget', budget.source_row, 'update', 'budget', budget.entity_id,
        locked.before_snapshot, budget.after_snapshot
      from updated_budgets budget
      join locked_budgets locked on locked.id = budget.entity_id
    ), commit_guard as (
      select case
        when not exists (select 1 from batch) then 1
        else 1 / case when (select count(*) from applied) = ${importedRows} then 1 else 0 end
      end as assertion
    ), ledger as (
      insert into import_batch_rows (
        import_batch_id, sheet, source_row, operation, entity_type, entity_id, before, after
      )
      select
        batch.id, applied.sheet, applied.source_row, applied.operation, applied.entity_type,
        applied.entity_id, applied.before_snapshot, applied.after_snapshot
      from applied
      cross join batch
      cross join commit_guard
      where commit_guard.assertion = 1
      returning id
    ), row_audits as (
      insert into audit_events (
        entity_type, entity_id, action, actor_user_id, before, after, metadata
      )
      select
        applied.entity_type, applied.entity_id, 'import', ${input.actorUserId},
        applied.before_snapshot, applied.after_snapshot,
        jsonb_build_object(
          'importBatchId', batch.id,
          'filename', ${input.filename}::text,
          'sheet', applied.sheet,
          'sourceRow', applied.source_row,
          'operation', applied.operation
        )
      from applied
      cross join batch
      cross join (select count(*) as written from ledger) ledger_state
      where ledger_state.written = ${importedRows}
      returning id
    ), batch_audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata)
      select
        'import-batch', batch.id, 'import', ${input.actorUserId}, to_jsonb(batch),
        jsonb_build_object('filename', ${input.filename}::text, 'rows', ${importedRows}::integer)
      from batch
      cross join (select count(*) as written from row_audits) audit_state
      where audit_state.written = ${importedRows}
      returning id
    )
    select
      validation.issue_count,
      validation.issues,
      batch.id::text as batch_id,
      batch.created_at as uploaded_at,
      batch.summary,
      coalesce((select count(*)::integer from ledger), 0) as ledger_rows,
      coalesce((select count(*)::integer from row_audits), 0) as row_audit_rows,
      coalesce((select count(*)::integer from batch_audit), 0) as batch_audit_rows
    from validation
    left join batch on true
  `;
}

export function buildUndoFinanceImportQuery(batchId: number, actorUserId: number): SQL {
  return sql`
    with batch as materialized (
      select *
      from import_batches
      where id = ${batchId} and type = 'finance'
      for update
    ), ledger_rows as materialized (
      select ledger.*
      from import_batch_rows ledger
      join batch on batch.id = ledger.import_batch_id
      for update of ledger
    ), locked_expenses as materialized (
      select
        ledger.id as ledger_id,
        expense.id as entity_id,
        to_jsonb(expense) as current_snapshot
      from ledger_rows ledger
      join expenses expense on ledger.entity_type = 'expense' and expense.id = ledger.entity_id
      for update of expense
    ), locked_budgets as materialized (
      select
        ledger.id as ledger_id,
        budget.id as entity_id,
        to_jsonb(budget) as current_snapshot
      from ledger_rows ledger
      join budgets budget on ledger.entity_type = 'budget' and budget.id = ledger.entity_id
      for update of budget
    ), current_rows as materialized (
      select * from locked_expenses
      union all
      select * from locked_budgets
    ), unsafe_rows as materialized (
      select
        ledger.id as ledger_id,
        ledger.sheet,
        ledger.source_row,
        ledger.entity_type,
        ledger.entity_id,
        case
          when ledger.undone_at is not null then 'already-undone'
          when ledger.entity_type = 'expense' and ledger.operation <> 'insert' then 'unsupported-operation'
          when ledger.entity_type not in ('expense', 'budget') then 'unsupported-entity'
          when current.ledger_id is null then 'row-missing'
          when current.current_snapshot is distinct from ledger.after then 'row-changed-after-import'
          else 'invalid-ledger-row'
        end as reason
      from ledger_rows ledger
      left join current_rows current on current.ledger_id = ledger.id
      where
        ledger.undone_at is not null
        or (ledger.entity_type = 'expense' and ledger.operation <> 'insert')
        or ledger.entity_type not in ('expense', 'budget')
        or current.ledger_id is null
        or current.current_snapshot is distinct from ledger.after
    ), batch_state as (
      select
        exists(select 1 from batch) as batch_found,
        (select status from batch) as status,
        coalesce((select imported_rows from batch), 0)::integer as expected_rows,
        (select count(*)::integer from ledger_rows) as ledger_rows,
        (select count(*)::integer from unsafe_rows) as unsafe_rows,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'sheet', sheet,
                'rowNum', source_row,
                'entityType', entity_type,
                'entityId', entity_id,
                'reason', reason
              ) order by sheet, source_row
            )
            from unsafe_rows
          ),
          '[]'::jsonb
        ) as conflicts
    ), undo_gate as (
      select state.*
      from batch_state state
      where
        state.batch_found
        and state.status = 'completed'
        and state.expected_rows > 0
        and state.expected_rows = state.ledger_rows
        and state.unsafe_rows = 0
    ), deleted_expenses as (
      delete from expenses target
      using ledger_rows ledger, undo_gate
      where
        ledger.entity_type = 'expense'
        and ledger.operation = 'insert'
        and target.id = ledger.entity_id
      returning target.id as entity_id
    ), deleted_budgets as (
      delete from budgets target
      using ledger_rows ledger, undo_gate
      where
        ledger.entity_type = 'budget'
        and ledger.operation = 'insert'
        and target.id = ledger.entity_id
      returning target.id as entity_id
    ), restored_budgets as (
      update budgets target
      set
        year = (ledger.before ->> 'year')::integer,
        expense_category_id = (ledger.before ->> 'expense_category_id')::bigint,
        store_id = nullif(ledger.before ->> 'store_id', '')::bigint,
        amount = (ledger.before ->> 'amount')::numeric(14, 2),
        notes = ledger.before ->> 'notes',
        import_batch_id = nullif(ledger.before ->> 'import_batch_id', '')::bigint,
        import_source_row = nullif(ledger.before ->> 'import_source_row', '')::integer,
        created_by_user_id = (ledger.before ->> 'created_by_user_id')::integer,
        updated_by_user_id = (ledger.before ->> 'updated_by_user_id')::integer,
        created_at = (ledger.before ->> 'created_at')::timestamptz,
        updated_at = (ledger.before ->> 'updated_at')::timestamptz
      from ledger_rows ledger, undo_gate
      where
        ledger.entity_type = 'budget'
        and ledger.operation = 'update'
        and target.id = ledger.entity_id
      returning target.id as entity_id
    ), undo_results as materialized (
      select ledger.id as ledger_id, ledger.operation
      from deleted_expenses changed
      join ledger_rows ledger on ledger.entity_type = 'expense' and ledger.entity_id = changed.entity_id
      union all
      select ledger.id, ledger.operation
      from deleted_budgets changed
      join ledger_rows ledger on ledger.entity_type = 'budget' and ledger.entity_id = changed.entity_id
      union all
      select ledger.id, ledger.operation
      from restored_budgets changed
      join ledger_rows ledger on ledger.entity_type = 'budget' and ledger.entity_id = changed.entity_id
    ), undo_guard as (
      select
        gate.expected_rows,
        1 / case when count(results.ledger_id) = gate.expected_rows then 1 else 0 end as assertion
      from undo_gate gate
      left join undo_results results on true
      group by gate.expected_rows
    ), ledger_undo as (
      update import_batch_rows ledger
      set undone_at = statement_timestamp(), undone_by_user_id = ${actorUserId}
      from undo_results result, undo_guard guard
      where ledger.id = result.ledger_id and guard.assertion = 1
      returning ledger.id
    ), row_audits as (
      insert into audit_events (
        entity_type, entity_id, action, actor_user_id, before, after, metadata
      )
      select
        ledger.entity_type,
        ledger.entity_id,
        'undo',
        ${actorUserId},
        ledger.after,
        case when ledger.operation = 'update' then ledger.before else null end,
        jsonb_build_object(
          'importBatchId', ${batchId}::bigint,
          'sheet', ledger.sheet,
          'sourceRow', ledger.source_row,
          'operation', ledger.operation
        )
      from ledger_rows ledger
      join undo_results result on result.ledger_id = ledger.id
      cross join (select count(*) as changed from ledger_undo) ledger_state
      where ledger_state.changed = (select expected_rows from undo_guard)
      returning id
    ), batch_update as (
      update import_batches target
      set
        status = 'undone',
        undone_at = statement_timestamp(),
        undone_by_user_id = ${actorUserId}
      from undo_guard guard
      where
        target.id = ${batchId}
        and guard.assertion = 1
        and (select count(*) from row_audits) = guard.expected_rows
      returning target.*
    ), batch_audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select
        'import-batch',
        updated.id,
        'undo',
        ${actorUserId},
        to_jsonb(batch),
        to_jsonb(updated),
        jsonb_build_object('affectedRows', (select expected_rows from undo_guard))
      from batch_update updated
      join batch on batch.id = updated.id
      returning id
    )
    select
      state.batch_found,
      state.status,
      state.expected_rows,
      state.ledger_rows,
      state.unsafe_rows,
      state.conflicts,
      coalesce((select count(*)::integer from deleted_expenses), 0)
        + coalesce((select count(*)::integer from deleted_budgets), 0) as deleted_rows,
      coalesce((select count(*)::integer from restored_budgets), 0) as restored_rows,
      coalesce((select count(*)::integer from batch_update), 0) as updated_batches,
      coalesce((select count(*)::integer from batch_audit), 0) as batch_audit_rows
    from batch_state state
  `;
}

// Downloadable template: Expenses + Budget sheets with typed reference names.
export async function buildFinanceTemplate(references: FinanceImportReferences): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'StateStreet Ops';

  const expenses = workbook.addWorksheet('Expenses');
  expenses.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Category', key: 'category', width: 28 },
    { header: 'Store', key: 'store', width: 24 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Vendor', key: 'vendor', width: 20 },
    { header: 'Invoice', key: 'invoice', width: 16 },
    { header: 'Payment Method', key: 'paymentMethod', width: 20 },
    { header: 'Description', key: 'description', width: 32 },
    { header: 'Overspend Reason', key: 'overspendReason', width: 34 },
  ];
  expenses.addRow({
    date: '2026-01-15',
    category: references.expenseCategories[0]?.name ?? 'Rent',
    store: references.stores[0]?.name ?? '',
    amount: 1500,
    vendor: 'Example Vendor Ltd',
    invoice: 'INV-0001',
    paymentMethod: references.paymentMethods[0]?.name ?? '',
    description: 'Example - delete this row',
    overspendReason: '',
  });

  const budget = workbook.addWorksheet('Budget');
  budget.columns = [
    { header: 'Year', key: 'year', width: 10 },
    { header: 'Budget Item', key: 'item', width: 28 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Notes', key: 'notes', width: 32 },
  ];
  budget.addRow({
    year: new Date().getFullYear(),
    item: references.expenseCategories[0]?.name ?? 'Rent',
    amount: 120000,
    notes: 'Example - delete this row',
  });

  for (const worksheet of [expenses, budget]) {
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F2EA' } };
  }

  const reference = workbook.addWorksheet('Reference');
  reference.getColumn(1).width = 38;
  reference.addRow(['HOW TO USE']).font = { bold: true };
  reference.addRow(['Fill the Expenses and Budget sheets, then delete the example rows.']);
  reference.addRow(['Dates must be YYYY-MM-DD. Amounts may have at most two decimal places.']);
  reference.addRow(['Category, Store, and Payment Method must match a name below.']);
  reference.addRow(['Expense Description is required.']);
  reference.addRow(['Add an Overspend Reason when an expense exceeds its annual category/store budget.']);
  reference.addRow([]);
  reference.addRow(['VALID CATEGORIES / BUDGET ITEMS']).font = { bold: true };
  for (const category of references.expenseCategories) reference.addRow([category.name]);
  reference.addRow([]);
  reference.addRow(['VALID STORES']).font = { bold: true };
  for (const store of references.stores) reference.addRow([store.name]);
  reference.addRow([]);
  reference.addRow(['VALID PAYMENT METHODS']).font = { bold: true };
  for (const method of references.paymentMethods) reference.addRow([method.name]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
