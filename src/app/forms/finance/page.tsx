'use client';

import { useState } from 'react';
import FormField from '@/components/forms/FormField';
import FormSection from '@/components/forms/FormSection';

export default function FinanceFormsPage() {
  const [activeForm, setActiveForm] = useState<string>('revenue');
  const [submitted, setSubmitted] = useState(false);

  const forms = [
    { id: 'revenue', label: 'Daily Revenue Entry' },
    { id: 'expenses', label: 'Expense Recording' },
    { id: 'cashflow', label: 'Cash Flow Entry' },
    { id: 'debtors', label: 'Debtors / Creditors' },
    { id: 'forecast', label: 'Forecast Update' },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
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
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${activeForm === f.id ? 'bg-[#c8a951] text-black font-semibold' : 'bg-[#111] border border-[#2a2a2a] text-gray-400 hover:text-white'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {submitted && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg mb-4 text-sm">
          Data submitted successfully! Dashboard will update shortly.
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
                { label: 'Labore Men', value: 'labore-men' },
                { label: 'Boulevard Women Labore', value: 'bw-labore' },
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
              ]} />
              <FormField label="Store / Department" name="store" type="select" options={[
                { label: 'Head Office', value: 'hq' },
                { label: 'Dzorwulu Men', value: 'dzorwulu-men' },
                { label: 'East Legon Men', value: 'east-legon-men' },
                { label: 'Labore Men', value: 'labore-men' },
                { label: 'Boulevard Women Labore', value: 'bw-labore' },
                { label: 'Boulevard Women Dzorwulu', value: 'bw-dzorwulu' },
                { label: "D'Angelo Palace", value: 'dangelo' },
                { label: 'Woodpeckers', value: 'woodpeckers' },
              ]} />
              <FormField label="Amount" name="amount" type="number" prefix="GHS" required step={0.01} />
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
          <button type="reset" className="bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white px-6 py-2.5 rounded-lg transition-colors text-sm">
            Clear Form
          </button>
        </div>
      </form>
    </div>
  );
}
