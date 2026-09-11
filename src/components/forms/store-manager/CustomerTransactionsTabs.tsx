'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, LoaderCircle, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ProductCombobox, type ProductOption } from '@/components/forms/ProductCombobox';
import { downloadFile } from '@/lib/download-file';
import type { CreditNoteView, CreditSaleView, CustomerTransactionList, DepositView } from '@/lib/customer-transactions';

type TransactionSection = 'credits' | 'credit-sales' | 'deposits' | 'all';
type CategoryOption = { id: number; name: string };

type CreditSaleItemDraft = {
  key: string;
  categoryId: string;
  productId: number | null;
  productName: string;
  quantity: string;
  unitPrice: string;
};

type CreditItemDraft = {
  key: string;
  productId: number | null;
  productName: string;
  quantity: string;
  originalValue: string;
  unitPrice: string | null;
  valueOverridden: boolean;
  unwornUnused: boolean;
  originalTagsAttached: boolean;
  originalPackaging: boolean;
  inspectedApproved: boolean;
};

type DepositItemDraft = {
  key: string;
  productId: number | null;
  productName: string;
  sku: string | null;
  quantity: string;
  unitPrice: string | null;
};

let draftKeySeed = 0;
function nextDraftKey() {
  draftKeySeed += 1;
  return `transaction-item-${draftKeySeed}`;
}

function emptyCreditItem(): CreditItemDraft {
  return {
    key: nextDraftKey(), productId: null, productName: '', quantity: '1', originalValue: '', unitPrice: null,
    valueOverridden: false, unwornUnused: false, originalTagsAttached: false, originalPackaging: false, inspectedApproved: false,
  };
}

function emptyDepositItem(): DepositItemDraft {
  return { key: nextDraftKey(), productId: null, productName: '', sku: null, quantity: '1', unitPrice: null };
}

function emptyCreditSaleItem(): CreditSaleItemDraft {
  return { key: nextDraftKey(), categoryId: '', productId: null, productName: '', quantity: '1', unitPrice: '' };
}

function lineValue(quantity: string, unitPrice: string | null) {
  if (!unitPrice || !quantity) return '';
  return (Math.round((Number(quantity) || 0) * (Number(unitPrice) || 0) * 100) / 100).toFixed(2);
}

function totalValue(values: string[]) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0).toFixed(2);
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

async function responseError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error ?? 'The transaction could not be saved';
}

function Status({ value }: { value: string }) {
  return <span className="rounded-full border px-2 py-0.5 text-xs capitalize">{value.replaceAll('-', ' ')}</span>;
}

function CreditSaleCard({
  sale,
  businessDate,
  currency,
  paymentMethods,
  canRecordPayment,
  onRefresh,
}: {
  sale: CreditSaleView;
  businessDate: string;
  currency: string;
  paymentMethods: Array<{ id: number; name: string }>;
  canRecordPayment: boolean;
  onRefresh: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  async function recordPayment() {
    setBusy(true);
    try {
      const response = await fetch(`/api/customer-transactions/${sale.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'credit-sale',
          action: 'payment',
          businessDate,
          amount,
          paymentMethodId: paymentMethodId ? Number(paymentMethodId) : undefined,
          reference,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json() as { paymentId?: number };
      toast.success('Credit payment recorded');
      setAmount('');
      setPaymentMethodId('');
      setReference('');
      if (payload.paymentId) {
        try {
          await downloadFile(
            `/api/customer-credit-sales/${sale.id}/payments/${payload.paymentId}/receipt`,
            `RCP-${sale.storeCode}-${payload.paymentId}.pdf`
          );
        } catch (downloadError) {
          toast.warning(`Payment recorded, but the receipt could not be downloaded: ${(downloadError as Error).message}`);
        }
      }
      onRefresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadReceipt(paymentId: number, receiptNumber: string) {
    try {
      await downloadFile(
        `/api/customer-credit-sales/${sale.id}/payments/${paymentId}/receipt`,
        `${receiptNumber}.pdf`
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{sale.creditNumber} · {sale.customerName}</p>
          <p className="text-sm text-muted-foreground">
            {sale.storeName} · {sale.businessDate}{sale.dueDate ? ` · Due ${sale.dueDate}` : ''}
            {sale.receiptNumber ? ` · Original receipt ${sale.receiptNumber}` : ''}
          </p>
        </div>
        <Status value={sale.status} />
      </div>
      <div className="mt-3 space-y-2 text-sm">
        {sale.items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
            <span><span className="font-medium">{item.categoryName}</span> · {item.productName}</span>
            <span>{item.quantity} × {money(item.unitPrice, currency)} = <b>{money(item.lineValue, currency)}</b></span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <span>Total <b>{money(sale.totalValue, currency)}</b></span>
        <span>Paid <b>{money(sale.paidValue, currency)}</b></span>
        <span>Balance <b>{money(sale.balanceValue, currency)}</b></span>
      </div>
      {sale.payments.length ? (
        <div className="mt-3 space-y-2 border-t pt-3 text-sm">
          <p className="font-medium">Payment history</p>
          {sale.payments.map((payment) => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2">
              <span>{payment.businessDate} · {payment.receiptNumber} · {money(payment.amount, currency)}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => void downloadReceipt(payment.id, payment.receiptNumber)}>
                Download receipt
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {canRecordPayment && sale.status !== 'settled' && sale.balanceValue > 0 ? (
        <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-[9rem_12rem_1fr_auto]">
          <Input type="number" min={0.01} max={sale.balanceValue} step={0.01} placeholder="Amount received" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} />
          <Select value={paymentMethodId} onValueChange={setPaymentMethodId} disabled={busy}>
            <SelectTrigger><SelectValue placeholder="Payment method" /></SelectTrigger>
            <SelectContent><SelectGroup>{paymentMethods.map((method) => <SelectItem key={method.id} value={String(method.id)}>{method.name}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <Input placeholder="Reference (optional)" value={reference} onChange={(event) => setReference(event.target.value)} disabled={busy} />
          <Button type="button" onClick={() => void recordPayment()} disabled={busy || !amount || !paymentMethodId || Number(amount) <= 0 || Number(amount) > sale.balanceValue}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Check />}
            Record payment &amp; issue receipt
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CreditNoteCard({ note, currency, onRefresh }: { note: CreditNoteView; currency: string; onRefresh: () => void }) {
  const [replacementValue, setReplacementValue] = useState('');
  const [replacementDescription, setReplacementDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function redeem() {
    setBusy(true);
    try {
      const response = await fetch(`/api/customer-transactions/${note.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'credit-note', action: 'redeem', businessDate: note.businessDate, replacementValue, replacementDescription }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      toast.success('Credit note redemption recorded'); setReplacementValue(''); setReplacementDescription(''); onRefresh();
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{note.noteNumber}</p><p className="text-sm text-muted-foreground">{note.customerName} · {note.businessDate}</p></div><Status value={note.status} /></div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4"><span>Requested <b>{money(note.requestedValue, currency)}</b></span><span>Approved <b>{note.approvedValue == null ? 'Pending' : money(note.approvedValue, currency)}</b></span><span>Used <b>{money(note.redeemedValue, currency)}</b></span><span>Remaining <b>{money(note.remainingValue, currency)}</b></span></div>
      <p className="mt-2 text-sm text-muted-foreground">{note.reason}</p>
      <div className="mt-3 space-y-2 text-sm">{note.items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-3 py-2"><span className="font-medium">{item.productName}</span><span>{item.quantity} unit{item.quantity === 1 ? '' : 's'}</span><span>{money(item.originalValue, currency)}</span><Status value={item.inventoryStatus} /></div>)}</div>
      {note.status === 'approved' || note.status === 'partially-redeemed' ? <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-[10rem_1fr_auto]"><Input type="number" min={0.01} step={0.01} placeholder="Replacement value" value={replacementValue} onChange={(event) => setReplacementValue(event.target.value)} disabled={busy || note.remainingValue <= 0} /><Input placeholder="Replacement item / description" value={replacementDescription} onChange={(event) => setReplacementDescription(event.target.value)} disabled={busy || note.remainingValue <= 0} /><Button type="button" onClick={() => void redeem()} disabled={busy || !replacementValue || !replacementDescription.trim() || note.remainingValue <= 0}>{busy ? <LoaderCircle className="animate-spin" /> : <Check />}Redeem</Button></div> : null}
    </div>
  );
}

function DepositCard({ deposit, businessDate, currency, paymentMethods, onRefresh }: { deposit: DepositView; businessDate: string; currency: string; paymentMethods: Array<{ id: number; name: string }>; onRefresh: () => void }) {
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [busy, setBusy] = useState(false);

  async function action(body: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/customer-transactions/${deposit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await responseError(response));
      toast.success(message); setAmount(''); setPaymentMethodId(''); onRefresh();
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{deposit.depositNumber}</p><p className="text-sm text-muted-foreground">{deposit.customerName} · {deposit.businessDate}</p></div><Status value={deposit.status} /></div>
      <div className="mt-3 space-y-2 text-sm">{deposit.items.length ? deposit.items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"><span className="font-medium">{item.productName}{item.sku ? ` · ${item.sku}` : ''}</span><span>{item.quantity} × {money(item.unitPrice, currency)} = <b>{money(item.lineValue, currency)}</b></span></div>) : <div className="rounded-md bg-muted/40 px-3 py-2">{deposit.productName} · {deposit.quantity} unit{deposit.quantity === 1 ? '' : 's'}</div>}</div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><span>Total <b>{money(deposit.totalValue, currency)}</b></span><span>Received <b>{money(deposit.paidValue, currency)}</b></span><span>Balance <b>{money(deposit.balanceValue, currency)}</b></span></div>
      {deposit.status === 'active' || deposit.status === 'ready' ? <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-[9rem_12rem_1fr_auto]"><Input type="number" min={0.01} step={0.01} placeholder="Balance amount" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy || deposit.balanceValue <= 0} /><Select value={paymentMethodId} onValueChange={setPaymentMethodId} disabled={busy || deposit.balanceValue <= 0}><SelectTrigger><SelectValue placeholder="Payment method" /></SelectTrigger><SelectContent><SelectGroup>{paymentMethods.map((method) => <SelectItem key={method.id} value={String(method.id)}>{method.name}</SelectItem>)}</SelectGroup></SelectContent></Select><span />{deposit.status === 'ready' && deposit.balanceValue <= 0 ? <Button type="button" variant="secondary" onClick={() => void action({ type: 'deposit', action: 'collect' }, 'Deposit redeemed and items marked as collected')} disabled={busy}><Check />Redeem &amp; mark collected</Button> : <Button type="button" onClick={() => void action({ type: 'deposit', action: 'payment', businessDate, amount, paymentMethodId: paymentMethodId ? Number(paymentMethodId) : undefined }, 'Balance payment recorded')} disabled={busy || !amount || !paymentMethodId || deposit.balanceValue <= 0}><Check />Add payment</Button>}<Button type="button" variant="outline" onClick={() => { const reason = window.prompt('Why is this deposit being cancelled?'); if (reason?.trim()) void action({ type: 'deposit', action: 'request-cancellation', reason }, 'Cancellation sent to Finance'); }} disabled={busy}>Request cancellation</Button></div> : null}
    </div>
  );
}

export function CustomerTransactionsTabs({ storeId, businessDate, disabled, currency, paymentMethods, categories, onCreditSalesChange, section = 'all' }: { storeId: number | null; businessDate: string; disabled: boolean; currency: string; paymentMethods: Array<{ id: number; name: string }>; categories: CategoryOption[]; onCreditSalesChange?: (creditByCategory: Map<number, number>) => void; section?: TransactionSection }) {
  const [data, setData] = useState<CustomerTransactionList>({ creditSales: [], creditNotes: [], deposits: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [credit, setCredit] = useState({ customerName: '', customerPhone: '', receipt: '', reason: '', items: [emptyCreditItem()] });
  const [creditSale, setCreditSale] = useState({ customerName: '', customerPhone: '', receipt: '', dueDate: '', items: [emptyCreditSaleItem()] });
  const [deposit, setDeposit] = useState({ customerName: '', customerPhone: '', items: [emptyDepositItem()], initialPayment: '', paymentMethodId: '', expectedCollectionDate: '' });
  const showCreditNotes = section !== 'deposits' && section !== 'credit-sales';
  const showCreditSales = section !== 'deposits' && section !== 'credits';
  const showDeposits = section !== 'credits' && section !== 'credit-sales';

  const load = useCallback(async () => {
    if (!storeId) {
      onCreditSalesChange?.(new Map());
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/customer-transactions?storeId=${storeId}&businessDate=${businessDate}&openDeposits=true&openCredits=true`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await responseError(response));
      const next = await response.json() as CustomerTransactionList;
      setData(next);
      if (onCreditSalesChange) {
        const creditByCategory = new Map<number, number>();
        for (const sale of next.creditSales) {
          if (sale.businessDate !== businessDate) continue;
          for (const item of sale.items) creditByCategory.set(item.categoryId, (creditByCategory.get(item.categoryId) ?? 0) + item.lineValue);
        }
        onCreditSalesChange(creditByCategory);
      }
    } catch (error) { toast.error((error as Error).message); } finally { setLoading(false); }
  }, [businessDate, onCreditSalesChange, storeId]);
  useEffect(() => { void load(); }, [load]);

  const creditTotal = useMemo(() => totalValue(credit.items.map((item) => item.originalValue)), [credit.items]);
  const creditSaleTotal = useMemo(() => totalValue(creditSale.items.map((item) => lineValue(item.quantity, item.unitPrice))), [creditSale.items]);
  const depositTotal = useMemo(() => totalValue(deposit.items.map((item) => lineValue(item.quantity, item.unitPrice))), [deposit.items]);

  function updateCreditItem(key: string, patch: Partial<CreditItemDraft>) { setCredit((current) => ({ ...current, items: current.items.map((item) => item.key === key ? { ...item, ...patch } : item) })); }
  function selectCreditProduct(key: string, product: ProductOption) { const current = credit.items.find((item) => item.key === key); const quantity = current?.quantity ?? '1'; updateCreditItem(key, { productId: product.id, productName: product.name, unitPrice: product.sellingPrice, originalValue: lineValue(quantity, product.sellingPrice), valueOverridden: false }); }
  function updateCreditQuantity(item: CreditItemDraft, quantity: string) { updateCreditItem(item.key, { quantity, originalValue: item.valueOverridden ? item.originalValue : lineValue(quantity, item.unitPrice) }); }

  async function submitCredit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch('/api/customer-transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'credit-note', storeId, businessDate, customerName: credit.customerName, customerPhone: credit.customerPhone, originalReceiptNumber: credit.receipt, reason: credit.reason, requestedValue: creditTotal, items: credit.items.map((item) => ({ productId: item.productId ?? undefined, productName: item.productName, quantity: Number(item.quantity), originalValue: item.originalValue, unitPrice: item.unitPrice ?? undefined, unwornUnused: item.unwornUnused, originalTagsAttached: item.originalTagsAttached, originalPackaging: item.originalPackaging, inspectedApproved: item.inspectedApproved })) }) });
      if (!response.ok) throw new Error(await responseError(response));
      toast.success('Credit note submitted for approval'); setCredit({ customerName: '', customerPhone: '', receipt: '', reason: '', items: [emptyCreditItem()] }); await load();
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }

  function updateCreditSaleItem(key: string, patch: Partial<CreditSaleItemDraft>) {
    setCreditSale((current) => ({ ...current, items: current.items.map((item) => item.key === key ? { ...item, ...patch } : item) }));
  }

  function selectCreditSaleProduct(key: string, product: ProductOption) {
    updateCreditSaleItem(key, {
      productId: product.id,
      categoryId: String(product.categoryId),
      productName: product.name,
      unitPrice: product.sellingPrice ?? '',
    });
  }

  function clearCreditSaleProduct(key: string) {
    updateCreditSaleItem(key, { productId: null, productName: '', unitPrice: '' });
  }

  async function submitCreditSale(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch('/api/customer-transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'credit-sale', storeId, businessDate,
          customerName: creditSale.customerName, customerPhone: creditSale.customerPhone,
          receiptNumber: creditSale.receipt, dueDate: creditSale.dueDate || undefined,
          items: creditSale.items.map((item) => ({
            categoryId: Number(item.categoryId), productId: item.productId ?? undefined,
            productName: item.productName, quantity: Number(item.quantity),
            unitPrice: item.productId ? undefined : Number(item.unitPrice),
          })),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      toast.success('Credit sale recorded');
      setCreditSale({ customerName: '', customerPhone: '', receipt: '', dueDate: '', items: [emptyCreditSaleItem()] });
      await load();
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }

  function updateDepositItem(key: string, patch: Partial<DepositItemDraft>) { setDeposit((current) => ({ ...current, items: current.items.map((item) => item.key === key ? { ...item, ...patch } : item) })); }
  function selectDepositProduct(key: string, product: ProductOption) { updateDepositItem(key, { productId: product.id, productName: product.name, sku: product.sku, unitPrice: product.sellingPrice }); }

  async function submitDeposit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch('/api/customer-transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'deposit', storeId, businessDate, customerName: deposit.customerName, customerPhone: deposit.customerPhone, items: deposit.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })), initialPayment: deposit.initialPayment, paymentMethodId: deposit.paymentMethodId ? Number(deposit.paymentMethodId) : undefined, expectedCollectionDate: deposit.expectedCollectionDate || undefined }) });
      if (!response.ok) throw new Error(await responseError(response));
      toast.success('Customer deposit recorded as revenue and stock reserved'); setDeposit({ customerName: '', customerPhone: '', items: [emptyDepositItem()], initialPayment: '', paymentMethodId: '', expectedCollectionDate: '' }); await load();
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }

  if (!storeId) return <Alert><AlertTitle>Choose a store first</AlertTitle><AlertDescription>These transactions are recorded against the active store.</AlertDescription></Alert>;

  return <div className="flex flex-col gap-5">
    <div className="grid gap-3 sm:grid-cols-3">{showCreditNotes ? <div className="rounded-lg border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Approved credit value</p><p className="mt-1 text-lg font-semibold">{money(data.creditNotes.reduce((sum, note) => sum + (note.approvedValue ?? 0), 0), currency)}</p></div> : null}{showCreditSales ? <div className="rounded-lg border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Open credit sales</p><p className="mt-1 text-lg font-semibold">{money(data.creditSales.reduce((sum, sale) => sum + sale.balanceValue, 0), currency)}</p></div> : null}{showDeposits ? <div className="rounded-lg border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Deposits received today</p><p className="mt-1 text-lg font-semibold">{money(data.deposits.filter((item) => item.businessDate === businessDate).reduce((sum, item) => sum + item.paidValue, 0), currency)}</p></div> : null}</div>
    {showCreditSales ? <>
      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><div><h3 className="font-semibold">New credit sale</h3><p className="text-sm text-muted-foreground">Record the sale against a category and customer. Select a catalog product to use its selling price, or type a product name and unit price when it is not in the catalog.</p></div></div>
        <form className="space-y-4" onSubmit={(event) => void submitCreditSale(event)}>
          <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field><FieldLabel>Customer name</FieldLabel><Input required value={creditSale.customerName} disabled={disabled || busy} onChange={(event) => setCreditSale((current) => ({ ...current, customerName: event.target.value }))} /></Field>
            <Field><FieldLabel>Phone</FieldLabel><Input value={creditSale.customerPhone} disabled={disabled || busy} onChange={(event) => setCreditSale((current) => ({ ...current, customerPhone: event.target.value }))} /></Field>
            <Field><FieldLabel>Original receipt</FieldLabel><Input value={creditSale.receipt} disabled={disabled || busy} onChange={(event) => setCreditSale((current) => ({ ...current, receipt: event.target.value }))} /></Field>
            <Field><FieldLabel>Due date</FieldLabel><Input type="date" min={businessDate} value={creditSale.dueDate} disabled={disabled || busy} onChange={(event) => setCreditSale((current) => ({ ...current, dueDate: event.target.value }))} /></Field>
          </FieldGroup>
          <div className="space-y-3 rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">Credit-sale items</p><Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => setCreditSale((current) => ({ ...current, items: [...current.items, emptyCreditSaleItem()] }))}><Plus />Add item</Button></div>
            {creditSale.items.map((item, index) => (
              <div key={item.key} className="rounded-md border bg-background p-3">
                <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium">Item {index + 1}</p><Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} disabled={disabled || busy || creditSale.items.length === 1} onClick={() => setCreditSale((current) => ({ ...current, items: current.items.filter((entry) => entry.key !== item.key) }))}><Trash2 /></Button></div>
                <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Field><FieldLabel>Category</FieldLabel><Select value={item.categoryId} onValueChange={(value) => updateCreditSaleItem(item.key, { categoryId: value, productId: null, productName: '', unitPrice: '' })} disabled={disabled || busy}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent><SelectGroup>{categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
                  <Field><FieldLabel>Catalog product (optional)</FieldLabel><ProductCombobox value={item.productId ? String(item.productId) : ''} storeId={storeId} disabled={disabled || busy} onChange={(value) => { if (!value) updateCreditSaleItem(item.key, { productId: null, productName: '', unitPrice: '' }); }} onSelect={(product) => selectCreditSaleProduct(item.key, product)} /></Field>
                  <Field><FieldLabel>Product name</FieldLabel><Input required placeholder="Type product name" value={item.productName} disabled={disabled || busy} onChange={(event) => { clearCreditSaleProduct(item.key); updateCreditSaleItem(item.key, { productName: event.target.value }); }} /></Field>
                  <Field><FieldLabel>Units</FieldLabel><Input required type="number" min={1} step={1} value={item.quantity} disabled={disabled || busy} onChange={(event) => updateCreditSaleItem(item.key, { quantity: event.target.value })} /></Field>
                  <Field><FieldLabel>Unit price</FieldLabel><Input required type="number" min={0.01} step={0.01} placeholder="Selling price" value={item.unitPrice} readOnly={Boolean(item.productId)} disabled={disabled || busy} onChange={(event) => updateCreditSaleItem(item.key, { unitPrice: event.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Line total: {money(Number(lineValue(item.quantity, item.unitPrice) || 0), currency)}</p></Field>
                </FieldGroup>
              </div>
            ))}
          </div>
          <div className="rounded-md border bg-primary/5 px-4 py-3 text-right"><span className="text-sm text-muted-foreground">Credit sale total </span><b className="text-lg">{money(Number(creditSaleTotal), currency)}</b></div>
          <Button type="submit" disabled={disabled || busy || Number(creditSaleTotal) <= 0 || !creditSale.items.every((item) => item.categoryId && item.productName.trim() && Number(item.quantity) > 0 && Number(item.unitPrice) > 0)}><Plus />Record credit sale</Button>
        </form>
      </section>
      <section className="space-y-3"><h3 className="font-semibold">Credit sales and open balances</h3>{loading ? <LoaderCircle className="animate-spin" /> : data.creditSales.length ? data.creditSales.map((sale) => <CreditSaleCard key={sale.id} sale={sale} businessDate={businessDate} currency={currency} paymentMethods={paymentMethods} canRecordPayment onRefresh={() => void load()} />) : <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No credit sales recorded for this date.</p>}</section>
    </> : null}
    {showCreditNotes ? <>
      <section className="rounded-lg border bg-card p-4"><div className="mb-4 flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><div><h3 className="font-semibold">New return &amp; credit note</h3><p className="text-sm text-muted-foreground">Add every returned item. Catalog products fill the selling price automatically; type a name and value only when it is not in the catalog.</p></div></div>
        <form className="space-y-4" onSubmit={(event) => void submitCredit(event)}><FieldGroup className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Customer name</FieldLabel><Input required value={credit.customerName} disabled={disabled || busy} onChange={(event) => setCredit((current) => ({ ...current, customerName: event.target.value }))} /></Field><Field><FieldLabel>Phone</FieldLabel><Input value={credit.customerPhone} disabled={disabled || busy} onChange={(event) => setCredit((current) => ({ ...current, customerPhone: event.target.value }))} /></Field><Field><FieldLabel>Original receipt</FieldLabel><Input value={credit.receipt} disabled={disabled || busy} onChange={(event) => setCredit((current) => ({ ...current, receipt: event.target.value }))} /></Field><Field><FieldLabel>Total credit value</FieldLabel><Input readOnly value={creditTotal} /></Field></FieldGroup><Field><FieldLabel>Reason</FieldLabel><Textarea required value={credit.reason} disabled={disabled || busy} onChange={(event) => setCredit((current) => ({ ...current, reason: event.target.value }))} /></Field>
          <div className="space-y-3 rounded-md border bg-muted/20 p-3"><div className="flex items-center justify-between"><p className="text-sm font-medium">Returned items</p><Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => setCredit((current) => ({ ...current, items: [...current.items, emptyCreditItem()] }))}><Plus />Add item</Button></div>{credit.items.map((item, index) => <div key={item.key} className="space-y-3 rounded-md border bg-background p-3"><div className="flex items-center justify-between"><p className="text-sm font-medium">Item {index + 1}</p><Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} disabled={disabled || busy || credit.items.length === 1} onClick={() => setCredit((current) => ({ ...current, items: current.items.filter((entry) => entry.key !== item.key) }))}><Trash2 /></Button></div><FieldGroup className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Catalog product (optional)</FieldLabel><ProductCombobox value={item.productId ? String(item.productId) : ''} storeId={storeId} disabled={disabled || busy} onChange={(value) => updateCreditItem(item.key, { productId: value ? Number(value) : null })} onSelect={(product) => selectCreditProduct(item.key, product)} /></Field><Field><FieldLabel>Product name</FieldLabel>{item.productId ? <p className="flex min-h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">{item.productName}</p> : <Input required placeholder="Type product name" value={item.productName} disabled={disabled || busy} onChange={(event) => updateCreditItem(item.key, { productName: event.target.value })} />}</Field><Field><FieldLabel>Quantity</FieldLabel><Input required type="number" min={1} step={1} value={item.quantity} disabled={disabled || busy} onChange={(event) => updateCreditQuantity(item, event.target.value)} /></Field><Field><FieldLabel>Line value</FieldLabel><Input required type="number" min={0.01} step={0.01} value={item.originalValue} readOnly={Boolean(item.productId && !item.valueOverridden)} disabled={disabled || busy} onChange={(event) => updateCreditItem(item.key, { originalValue: event.target.value, valueOverridden: true })} />{item.productId && !item.unitPrice ? <p className="mt-1 text-xs text-destructive">This catalog product has no selling price.</p> : null}{item.productId && item.unitPrice ? <p className="mt-1 text-xs text-muted-foreground">Auto-calculated at {money(Number(item.unitPrice), currency)} per unit</p> : null}</Field></FieldGroup><div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.unwornUnused} disabled={disabled || busy} onChange={(event) => updateCreditItem(item.key, { unwornUnused: event.target.checked })} />Unworn / unused</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.originalTagsAttached} disabled={disabled || busy} onChange={(event) => updateCreditItem(item.key, { originalTagsAttached: event.target.checked })} />Original tags attached</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.originalPackaging} disabled={disabled || busy} onChange={(event) => updateCreditItem(item.key, { originalPackaging: event.target.checked })} />Original packaging</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.inspectedApproved} disabled={disabled || busy} onChange={(event) => updateCreditItem(item.key, { inspectedApproved: event.target.checked })} />Inspected and approved</label></div></div>)}</div><Button type="submit" disabled={disabled || busy || Number(creditTotal) <= 0}><Plus />Submit credit note</Button></form>
      </section><section className="space-y-3"><h3 className="font-semibold">Credit notes for {businessDate}</h3>{loading ? <LoaderCircle className="animate-spin" /> : data.creditNotes.length ? data.creditNotes.map((note) => <CreditNoteCard key={note.id} note={note} currency={currency} onRefresh={() => void load()} />) : <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No credit notes recorded for this date.</p>}</section>
    </> : null}
    {showDeposits ? <>
      <section className="rounded-lg border bg-card p-4"><div className="mb-4 flex items-center gap-2"><Plus className="size-4 text-primary" /><div><h3 className="font-semibold">New customer deposit</h3><p className="text-sm text-muted-foreground">Add every reserved item. The catalog selling price and line value are calculated automatically.</p></div></div><form className="space-y-4" onSubmit={(event) => void submitDeposit(event)}><FieldGroup className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Customer name</FieldLabel><Input required value={deposit.customerName} disabled={disabled || busy} onChange={(event) => setDeposit((current) => ({ ...current, customerName: event.target.value }))} /></Field><Field><FieldLabel>Phone</FieldLabel><Input value={deposit.customerPhone} disabled={disabled || busy} onChange={(event) => setDeposit((current) => ({ ...current, customerPhone: event.target.value }))} /></Field></FieldGroup><div className="space-y-3 rounded-md border bg-muted/20 p-3"><div className="flex items-center justify-between"><p className="text-sm font-medium">Reserved items</p><Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => setDeposit((current) => ({ ...current, items: [...current.items, emptyDepositItem()] }))}><Plus />Add item</Button></div>{deposit.items.map((item, index) => <div key={item.key} className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[minmax(15rem,1fr)_6rem_9rem_auto]"><Field><FieldLabel>Product {index + 1}</FieldLabel><ProductCombobox value={item.productId ? String(item.productId) : ''} storeId={storeId} disabled={disabled || busy} onChange={(value) => updateDepositItem(item.key, { productId: value ? Number(value) : null })} onSelect={(product) => selectDepositProduct(item.key, product)} />{item.productId && !item.unitPrice ? <p className="mt-1 text-xs text-destructive">This product has no selling price in the catalog.</p> : null}</Field><Field><FieldLabel>Units</FieldLabel><Input required type="number" min={1} step={1} value={item.quantity} disabled={disabled || busy} onChange={(event) => updateDepositItem(item.key, { quantity: event.target.value })} /></Field><Field><FieldLabel>Line value</FieldLabel><Input readOnly value={lineValue(item.quantity, item.unitPrice)} placeholder="Select product" /></Field><Button type="button" variant="ghost" size="icon" className="self-end" aria-label={`Remove item ${index + 1}`} disabled={disabled || busy || deposit.items.length === 1} onClick={() => setDeposit((current) => ({ ...current, items: current.items.filter((entry) => entry.key !== item.key) }))}><Trash2 /></Button></div>)}</div><div className="rounded-md border bg-primary/5 px-4 py-3 text-right"><span className="text-sm text-muted-foreground">Total product value </span><b className="text-lg">{money(Number(depositTotal), currency)}</b></div><FieldGroup className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Amount received now</FieldLabel><Input required type="number" min={0.01} step={0.01} value={deposit.initialPayment} disabled={disabled || busy} onChange={(event) => setDeposit((current) => ({ ...current, initialPayment: event.target.value }))} /></Field><Field><FieldLabel>Payment method</FieldLabel><Select required value={deposit.paymentMethodId} onValueChange={(value) => setDeposit((current) => ({ ...current, paymentMethodId: value }))} disabled={disabled || busy}><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger><SelectContent><SelectGroup>{paymentMethods.map((method) => <SelectItem key={method.id} value={String(method.id)}>{method.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field><Field><FieldLabel>Expected collection date</FieldLabel><Input type="date" value={deposit.expectedCollectionDate} disabled={disabled || busy} onChange={(event) => setDeposit((current) => ({ ...current, expectedCollectionDate: event.target.value }))} /></Field></FieldGroup><Button type="submit" disabled={disabled || busy || !deposit.items.every((item) => item.productId && item.unitPrice) || Number(depositTotal) <= 0 || Number(deposit.initialPayment) > Number(depositTotal)}><Plus />Record deposit</Button></form></section><section className="space-y-3"><h3 className="font-semibold">Deposits and open balances</h3>{loading ? <LoaderCircle className="animate-spin" /> : data.deposits.length ? data.deposits.map((item) => <DepositCard key={item.id} deposit={item} businessDate={businessDate} currency={currency} paymentMethods={paymentMethods} onRefresh={() => void load()} />) : <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No deposits or open balances.</p>}</section>
    </> : null}
  </div>;
}
