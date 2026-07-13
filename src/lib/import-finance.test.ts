import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  FinanceImportFileError,
  parseFinanceFile,
  planBudgetImport,
  staleAllowedBudgetDecisions,
  type ExistingBudgetForImport,
  type FinanceImportReferences,
} from './import-finance';

const references: FinanceImportReferences = {
  expenseCategories: [
    { id: 11, code: 'rent', name: 'Rent' },
    { id: 12, code: 'marketing-spend', name: 'Marketing Spend' },
  ],
  stores: [{ id: 21, code: 'labone', name: 'Labone' }],
  paymentMethods: [{ id: 31, code: 'bank-transfer', name: 'Bank Transfer' }],
};

async function workbookBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const expenses = workbook.addWorksheet('Expenses');
  expenses.addRow([
    'Date',
    'Expense Category',
    'Store / Department',
    'Amount',
    'Vendor / Payee',
    'Invoice Number',
    'Payment Mode',
    'Description',
    'Overspend Justification',
  ]);
  expenses.addRow([
    '2026-07-10',
    'Rent',
    'labone',
    '1,250.50',
    'Property Co',
    'INV-1',
    'bank-transfer',
    'July rent',
    'Board-approved lease renewal',
  ]);
  expenses.addRow(['2026-07-10', 'Rent', '', 20, '', '', 'Unknown Method', '', '']);

  const budget = workbook.addWorksheet('Budget');
  budget.addRow(['Year', 'Budget Item', 'Annual Budgeted Amount', 'Notes']);
  budget.addRow([2026, 'rent', 120000, 'Annual rent']);
  budget.addRow([2026, 'Rent', 130000, 'Duplicate']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('Finance import parsing', () => {
  it('resolves typed references and reports invalid and duplicate rows', async () => {
    const parsed = await parseFinanceFile(await workbookBuffer(), references);

    expect(parsed.expenses.valid).toEqual([
      {
        rowNum: 2,
        data: {
          date: '2026-07-10',
          category: 'rent',
          expenseCategoryId: 11,
          store: 'labone',
          storeId: 21,
          amount: 1250.5,
          amountDecimal: '1250.50',
          vendor: 'Property Co',
          invoice: 'INV-1',
          paymentMethod: 'bank-transfer',
          paymentMethodId: 31,
          description: 'July rent',
          overspendReason: 'Board-approved lease renewal',
        },
      },
    ]);
    expect(parsed.expenses.errors).toHaveLength(1);
    expect(parsed.expenses.errors[0].messages).toEqual([
      'Unknown Payment Method "Unknown Method"',
      'Missing Description',
    ]);
    expect(parsed.budget.valid).toHaveLength(1);
    expect(parsed.budget.valid[0].data).toMatchObject({
      year: '2026',
      yearNumber: 2026,
      item: 'rent',
      expenseCategoryId: 11,
      amountDecimal: '120000.00',
    });
    expect(parsed.budget.errors[0].messages).toEqual([
      'Duplicate Budget Item and Year (first entered on row 2)',
    ]);
  });

  it('does not let an invalid row block a later valid budget row', async () => {
    const workbook = new ExcelJS.Workbook();
    const budget = workbook.addWorksheet('Budget');
    budget.addRow(['Year', 'Budget Item', 'Amount']);
    budget.addRow([2026, 'Rent', 'not-a-number']);
    budget.addRow([2026, 'Rent', 120000]);

    const parsed = await parseFinanceFile(Buffer.from(await workbook.xlsx.writeBuffer()), references);
    expect(parsed.budget.errors).toHaveLength(1);
    expect(parsed.budget.valid).toHaveLength(1);
    expect(parsed.budget.valid[0]).toMatchObject({ rowNum: 3, data: { item: 'rent' } });
  });

  it('rejects ambiguous typed reference labels instead of choosing a matching record', async () => {
    const workbook = new ExcelJS.Workbook();
    const expenses = workbook.addWorksheet('Expenses');
    expenses.addRow(['Date', 'Category', 'Store', 'Amount', 'Payment Method', 'Description']);
    expenses.addRow(['2026-07-10', 'Rent', 'Central', 100, 'Cash', 'Ambiguous references']);
    const ambiguousReferences: FinanceImportReferences = {
      expenseCategories: [
        { id: 11, code: 'rent-a', name: 'Rent' },
        { id: 12, code: 'rent-b', name: 'RENT' },
      ],
      stores: [
        { id: 21, code: 'central-a', name: 'Central' },
        { id: 22, code: 'central-b', name: 'CENTRAL' },
      ],
      paymentMethods: [
        { id: 31, code: 'cash-a', name: 'Cash' },
        { id: 32, code: 'cash-b', name: 'CASH' },
      ],
    };

    const parsed = await parseFinanceFile(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      ambiguousReferences
    );

    expect(parsed.expenses.valid).toHaveLength(0);
    expect(parsed.expenses.errors[0].messages).toEqual([
      'Ambiguous Category "Rent"; use a unique code',
      'Ambiguous Store "Central"; use a unique code',
      'Ambiguous Payment Method "Cash"; use a unique code',
    ]);
  });

  it('rejects fractional budget years instead of truncating them', async () => {
    const workbook = new ExcelJS.Workbook();
    const budget = workbook.addWorksheet('Budget');
    budget.addRow(['Year', 'Budget Item', 'Amount']);
    budget.addRow([2026.9, 'Rent', 120000]);

    const parsed = await parseFinanceFile(Buffer.from(await workbook.xlsx.writeBuffer()), references);

    expect(parsed.budget.valid).toHaveLength(0);
    expect(parsed.budget.errors[0].messages).toContain(
      'Year must be a whole number between 2024 and 2100'
    );
  });

  it('rejects invalid calendar dates instead of normalizing them', async () => {
    const workbook = new ExcelJS.Workbook();
    const expenses = workbook.addWorksheet('Expenses');
    expenses.addRow(['Date', 'Category', 'Amount', 'Description']);
    expenses.addRow(['2026-02-30', 'Rent', 100, 'Impossible date']);

    const parsed = await parseFinanceFile(Buffer.from(await workbook.xlsx.writeBuffer()), references);
    expect(parsed.expenses.valid).toHaveLength(0);
    expect(parsed.expenses.errors[0].messages).toContain('Missing or invalid Date (use YYYY-MM-DD)');
  });

  it('rejects an oversized sheet instead of importing a truncated subset', async () => {
    const workbook = new ExcelJS.Workbook();
    const expenses = workbook.addWorksheet('Expenses');
    expenses.addRow(['Date', 'Category', 'Amount', 'Description']);
    for (let index = 0; index < 1001; index += 1) {
      expenses.addRow(['2026-07-10', 'Rent', 1, `Expense ${index + 1}`]);
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(parseFinanceFile(buffer, references)).rejects.toBeInstanceOf(FinanceImportFileError);
    await expect(parseFinanceFile(buffer, references)).rejects.toThrow('Expenses sheet exceeds');
  });
});

describe('Finance budget conflict decisions', () => {
  const row = {
    rowNum: 2,
    data: {
      year: '2026',
      yearNumber: 2026,
      item: 'rent',
      expenseCategoryId: 11,
      amount: 150000,
      amountDecimal: '150000.00',
      notes: 'Revised',
    },
  };
  const existing: ExistingBudgetForImport = {
    id: 41,
    year: 2026,
    expenseCategoryId: 11,
    storeId: null,
    amount: '120000.00',
    notes: 'Original',
    importBatchId: null,
    importSourceRow: null,
    createdByUserId: 1,
    updatedByUserId: 1,
    updatedAt: '2026-07-10T10:00:00.000Z',
  };

  it('requires the exact preview version before allowing an overwrite', () => {
    const preview = planBudgetImport([row], [existing]);
    expect(preview.conflicts).toHaveLength(1);
    expect(preview.writes).toHaveLength(0);

    const key = preview.conflicts[0].key;
    const confirmed = planBudgetImport([row], [existing], { [key]: 'allow' });
    expect(confirmed.writes).toMatchObject([{ operation: 'update', existing: { id: 41 } }]);

    const changedProposal = planBudgetImport(
      [{ ...row, data: { ...row.data, amount: 175000, amountDecimal: '175000.00', notes: 'Different' } }],
      [existing],
      { [key]: 'allow' }
    );
    expect(changedProposal.writes).toHaveLength(0);
    expect(staleAllowedBudgetDecisions({ [key]: 'allow' }, changedProposal.conflicts)).toEqual([key]);

    const changed = planBudgetImport(
      [row],
      [{ ...existing, amount: '125000.00', updatedAt: '2026-07-10T10:01:00.000Z' }],
      { [key]: 'allow' }
    );
    expect(changed.writes).toHaveLength(0);
    expect(changed.skipped).toBe(1);
    expect(changed.conflicts[0].key).not.toBe(key);
    expect(staleAllowedBudgetDecisions({ [key]: 'allow' }, changed.conflicts)).toEqual([key]);
  });
});
