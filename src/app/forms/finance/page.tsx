'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';
import RecentEntries from '@/components/ui/RecentEntries';
import { submitEntry, postEntries } from '@/lib/api';

// Normalize a free-text brand (from Excel or a select) to the canonical form value.
function normalizeBrand(raw: string): string {
  const b = (raw || '').toString().trim().toLowerCase();
  if (!b) return '';
  if (b.includes('boulevard') && b.includes('women')) return 'boulevard-women';
  if (b.includes('boulevard')) return 'boulevard-men';
  if (b.includes('angelo')) return 'dangelo';
  if (b.includes('woodpecker')) return 'woodpeckers';
  if (b.includes('carbon')) return 'carbon-shoes';
  return b;
}

const num = (v: FormDataEntryValue | null | undefined | string | number) =>
  Number(String(v ?? '').replace(/[, ]/g, '')) || 0;

export default function FinanceFormsPage() {
  const [activeForm, setActiveForm] = useState<string>('revenue');
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadStatus, setUploadStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const forms = [
    { id: 'revenue', label: 'Daily Revenue Entry' },
    { id: 'expenses', label: 'Expense Recording' },
    { id: 'cashflow', label: 'Cash Flow Entry' },
    { id: 'debtors', label: 'Debtors / Creditors' },
    { id: 'forecast', label: 'Forecast Update' },
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await submitEntry('finance', activeForm, form);
      setMessage('Saved to the live database. The Finance & Executive dashboards reflect it now.');
      form.reset();
    } catch (err) {
      setMessage('Could not save: ' + (err as Error).message);
    }
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus({ ok: true, text: `Reading ${file.name}…` });
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      // Case-insensitive column lookup helper.
      const pick = (row: Record<string, unknown>, ...keys: string[]) => {
        const map: Record<string, unknown> = {};
        for (const k of Object.keys(row)) map[k.toLowerCase().replace(/[\s_]/g, '')] = row[k];
        for (const k of keys) {
          const v = map[k.toLowerCase().replace(/[\s_]/g, '')];
          if (v !== undefined && v !== '') return v;
        }
        return '';
      };

      const payloads = rows
        .map((r) => ({
          date: String(pick(r, 'date') || ''),
          store: String(pick(r, 'store') || ''),
          brand: normalizeBrand(String(pick(r, 'brand') || '')),
          grossRevenue: num(pick(r, 'grossrevenue', 'gross', 'revenue') as string),
          cogs: num(pick(r, 'cogs', 'costofgoods', 'cost') as string),
          discounts: num(pick(r, 'discounts', 'discount') as string),
          netRevenue: num(pick(r, 'netrevenue', 'net') as string),
          transactions: num(pick(r, 'transactions', 'txns') as string),
          footfall: num(pick(r, 'footfall', 'traffic') as string),
          itemsSold: num(pick(r, 'itemssold', 'items', 'units') as string),
        }))
        .filter((p) => p.grossRevenue > 0);

      if (!payloads.length) {
        setUploadStatus({
          ok: false,
          text: 'No valid rows found. Need at least a "Gross Revenue" column with values.',
        });
      } else {
        await postEntries('finance', 'revenue', payloads);
        const total = payloads.reduce((s, x) => s + x.grossRevenue, 0);
        setUploadStatus({
          ok: true,
          text: `Imported ${payloads.length} row(s) — GHS ${total.toLocaleString()} saved live to the database.`,
        });
      }
    } catch (err) {
      setUploadStatus({ ok: false, text: `Could not read file: ${(err as Error).message}` });
    } finally {
      e.target.value = '';
    }
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet([
      {
        Date: '2026-06-05',
        Store: 'Labone Men',
        Brand: 'Boulevard Men',
        GrossRevenue: 18500,
        COGS: 9800,
        Discounts: 500,
        NetRevenue: 18000,
        Transactions: 42,
        Footfall: 130,
        ItemsSold: 88,
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Revenue');
    XLSX.writeFile(wb, 'revenue-template.xlsx');
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Finance Data Entry</h1>
        <p className="text-sm text-gray-500 mt-1">Enter financial data to update the Finance Command Center dashboard</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {forms.map(f => (
          <button key={f.id} onClick={() => setActiveForm(f.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${activeForm === f.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[var(--c-card)] border border-[var(--c-border)] text-gray-400 hover:text-[var(--c-fg)]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {submitted && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg mb-4 text-sm">
          {message}
        </div>
      )}

      {activeForm === 'revenue' && (
        <div className="bg-[var(--c-card2)] border border-[var(--c-border)] rounded-lg p-4 mb-4 max-w-4xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--c-fg)]">Bulk import from Excel</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Upload an .xlsx/.csv with columns: Date, Store, Brand, Gross Revenue, Discounts, Net
                Revenue, Transactions, Footfall, Items Sold.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-xs text-[#c8a951] hover:underline whitespace-nowrap"
              >
                Download template
              </button>
              <label className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap">
                Upload Excel
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          {uploadStatus && (
            <div
              className={`mt-3 text-xs p-2 rounded-lg border ${
                uploadStatus.ok
                  ? 'border-green-500/30 bg-green-500/10 text-green-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-400'
              }`}
            >
              {uploadStatus.text}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl">
        {activeForm === 'revenue' && (
          <FormSection title="Daily Revenue Entry" description="Record daily revenue figures by store and brand">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Store" name="store" type="select" required options={[
                { label: 'Dzorwulu Men', value: 'dzorwulu-men' },
                { label: 'East Legon Men', value: 'east-legon-men' },
                { label: 'Labone Men', value: 'labone-men' },
                { label: 'Boulevard Women Labone', value: 'bw-labone' },
                { label: 'Boulevard Women Dzorwulu', value: 'bw-dzorwulu' },
                { label: "D'Angelo Palace", value: 'dangelo' },
                { label: 'Woodpeckers', value: 'woodpeckers' },
              ]} />
              <FormField label="Brand" name="brand" type="select" required options={[
                { label: 'Boulevard Men', value: 'boulevard-men' },
                { label: 'Boulevard Women', value: 'boulevard-women' },
                { label: "D'Angelo", value: 'dangelo' },
                { label: 'Woodpeckers', value: 'woodpeckers' },
                { label: 'Carbon Shoes', value: 'carbon-shoes' },
              ]} />
              <FormField label="Gross Revenue" name="grossRevenue" type="number" prefix="GHS" required step={0.01} />
              <FormField label="Cost of Goods (COGS)" name="cogs" type="number" prefix="GHS" step={0.01} />
              <FormField label="Discounts Given" name="discounts" type="number" prefix="GHS" step={0.01} />
              <FormField label="Net Revenue" name="netRevenue" type="number" prefix="GHS" step={0.01} />
              <FormField label="Number of Transactions" name="transactions" type="number" required />
              <FormField label="Footfall / Traffic" name="footfall" type="number" />
              <FormField label="Items Sold" name="itemsSold" type="number" />
            </div>
          </FormSection>
        )}

        {activeForm === 'expenses' && (
          <FormSection title="Expense Recording" description="Record operational expenses">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Category" name="category" type="select" required options={[
                { label: 'Rent', value: 'rent' },
                { label: 'Salaries', value: 'salaries' },
                { label: 'Marketing', value: 'marketing' },
                { label: 'Utilities', value: 'utilities' },
                { label: 'Logistics', value: 'logistics' },
                { label: 'Admin', value: 'admin' },
                { label: 'Maintenance', value: 'maintenance' },
                { label: 'Other', value: 'other' },
                { label: 'Interest / Finance Cost', value: 'interest' },
                { label: 'Tax', value: 'tax' },
              ]} />
              <FormField label="Store / Department" name="store" type="select" options={[
                { label: 'Head Office', value: 'hq' },
                { label: 'Dzorwulu Men', value: 'dzorwulu-men' },
                { label: 'East Legon Men', value: 'east-legon-men' },
                { label: 'Labone Men', value: 'labone-men' },
                { label: 'Boulevard Women Labone', value: 'bw-labone' },
                { label: 'Boulevard Women Dzorwulu', value: 'bw-dzorwulu' },
                { label: "D'Angelo Palace", value: 'dangelo' },
                { label: 'Woodpeckers', value: 'woodpeckers' },
              ]} />
              <FormField label="Amount" name="amount" type="number" prefix="GHS" required step={0.01} />
              <FormField label="Budget" name="budget" type="number" prefix="GHS" step={0.01} />
              <FormField label="Vendor / Payee" name="vendor" placeholder="Vendor name" />
              <FormField label="Invoice Number" name="invoice" placeholder="INV-XXXX" />
              <FormField label="Payment Method" name="paymentMethod" type="select" options={[
                { label: 'Bank Transfer', value: 'transfer' },
                { label: 'Cash', value: 'cash' },
                { label: 'Mobile Money', value: 'momo' },
                { label: 'Cheque', value: 'cheque' },
              ]} />
              <FormField label="Description" name="description" type="textarea" placeholder="Brief description of expense" />
            </div>
          </FormSection>
        )}

        {activeForm === 'cashflow' && (
          <FormSection title="Cash Flow Entry" description="Record cash inflows and outflows">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Date" name="date" type="date" required />
              <FormField label="Type" name="type" type="select" required options={[
                { label: 'Inflow', value: 'inflow' },
                { label: 'Outflow', value: 'outflow' },
              ]} />
              <FormField label="Category" name="category" type="select" required options={[
                { label: 'Sales Revenue', value: 'sales' },
                { label: 'Supplier Payment', value: 'supplier' },
                { label: 'Salary Payment', value: 'salary' },
                { label: 'Rent Payment', value: 'rent' },
                { label: 'Loan Repayment', value: 'loan' },
                { label: 'Tax Payment', value: 'tax' },
                { label: 'Customer Payment', value: 'customer-payment' },
                { label: 'Other', value: 'other' },
              ]} />
              <FormField label="Amount" name="amount" type="number" prefix="GHS" required step={0.01} />
              <FormField label="Bank Account" name="account" type="select" options={[
                { label: 'Main Operating Account', value: 'main' },
                { label: 'Payroll Account', value: 'payroll' },
                { label: 'Petty Cash', value: 'petty' },
              ]} />
              <FormField label="Reference" name="reference" placeholder="Transaction reference" />
            </div>
          </FormSection>
        )}

        {activeForm === 'debtors' && (
          <FormSection title="Debtors / Creditors Update" description="Update outstanding amounts">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Type" name="type" type="select" required options={[
                { label: 'Debtor (They owe us)', value: 'debtor' },
                { label: 'Creditor (We owe them)', value: 'creditor' },
              ]} />
              <FormField label="Company / Individual" name="entity" required placeholder="Name" />
              <FormField label="Outstanding Amount" name="amount" type="number" prefix="GHS" required step={0.01} />
              <FormField label="Due Date" name="dueDate" type="date" />
              <FormField label="Age (Days)" name="ageDays" type="number" />
              <FormField label="Status" name="status" type="select" options={[
                { label: 'Current', value: 'current' },
                { label: '30 Days Overdue', value: '30-days' },
                { label: '60 Days Overdue', value: '60-days' },
                { label: '90+ Days Overdue', value: '90-days' },
              ]} />
              <FormField label="Notes" name="notes" type="textarea" placeholder="Additional notes" />
            </div>
          </FormSection>
        )}

        {activeForm === 'forecast' && (
          <FormSection title="Forecast Update" description="Update end-of-month financial forecasts">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <FormField label="Forecast Period" name="period" type="select" required options={[
                { label: 'This Week', value: 'weekly' },
                { label: 'Current Month EOM', value: 'current' },
                { label: 'Next Month', value: 'next' },
                { label: 'Quarter End', value: 'quarter' },
              ]} />
              <FormField label="Revenue Forecast" name="revenueForecast" type="number" prefix="GHS" required step={0.01} />
              <FormField label="Gross Profit Forecast" name="gpForecast" type="number" prefix="GHS" step={0.01} />
              <FormField label="Net Profit Forecast" name="npForecast" type="number" prefix="GHS" step={0.01} />
              <FormField label="Cash Balance Forecast" name="cashForecast" type="number" prefix="GHS" step={0.01} />
              <FormField label="Confidence Level" name="confidence" type="select" options={[
                { label: 'High', value: 'high' },
                { label: 'Medium', value: 'medium' },
                { label: 'Low', value: 'low' },
              ]} />
              <FormField label="Key Assumptions" name="assumptions" type="textarea" placeholder="Key assumptions behind the forecast" />
            </div>
          </FormSection>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" className="bg-[#c8a951] hover:bg-[#d4bf7a] text-black font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm">
            Submit Entry
          </button>
          <button type="reset" className="bg-[var(--c-hover)] border border-[var(--c-border2)] text-gray-400 hover:text-[var(--c-fg)] px-6 py-2.5 rounded-lg transition-colors text-sm">
            Clear Form
          </button>
        </div>
      </form>

      <div className="mt-8 max-w-4xl">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3">Your Submissions</h2>
        <RecentEntries department="finance" />
      </div>
    </div>
  );
}
