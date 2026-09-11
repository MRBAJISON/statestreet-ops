'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, LoaderCircle, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { downloadFile } from '@/lib/download-file';
import type { CreditNoteView, CreditSaleView, CustomerTransactionList, DepositView } from '@/lib/customer-transactions';
import type { ReferenceDataResponse } from '@/lib/contracts/reference-data';

function money(value: number, currency: string) { return new Intl.NumberFormat('en-GH', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
async function responseError(response: Response) { const payload = await response.json().catch(() => null) as { error?: string } | null; return payload?.error ?? 'The transaction could not be updated'; }
function Status({ value }: { value: string }) { return <Badge variant="outline" className="capitalize">{value.replaceAll('-', ' ')}</Badge>; }

function CreditSaleReviewCard({ sale, currency, paymentMethods, allowPayment, onRefresh }: { sale: CreditSaleView; currency: string; paymentMethods: Array<{ id: number; name: string }>; allowPayment: boolean; onRefresh: () => void }) {
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  async function recordPayment() {
    setBusy(true);
    try {
      const response = await fetch(`/api/customer-transactions/${sale.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'credit-sale', action: 'payment', businessDate: new Date().toISOString().slice(0, 10), amount, paymentMethodId: paymentMethodId ? Number(paymentMethodId) : undefined, reference }) });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json() as { paymentId?: number };
      toast.success('Credit payment recorded');
      if (payload.paymentId) {
        try { await downloadFile(`/api/customer-credit-sales/${sale.id}/payments/${payload.paymentId}/receipt`, `RCP-${sale.storeCode}-${payload.paymentId}.pdf`); }
        catch (downloadError) { toast.warning(`Payment recorded, but the receipt could not be downloaded: ${(downloadError as Error).message}`); }
      }
      setAmount(''); setPaymentMethodId(''); setReference(''); onRefresh();
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }

  async function downloadReceipt(paymentId: number, receiptNumber: string) {
    try { await downloadFile(`/api/customer-credit-sales/${sale.id}/payments/${paymentId}/receipt`, `${receiptNumber}.pdf`); }
    catch (error) { toast.error((error as Error).message); }
  }

  return <div className="rounded-lg border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{sale.creditNumber} · {sale.customerName} · {sale.storeName}</p><p className="text-sm text-muted-foreground">{sale.businessDate}{sale.dueDate ? ` · Due ${sale.dueDate}` : ''}{sale.customerPhone ? ` · ${sale.customerPhone}` : ''}</p></div><Status value={sale.status} /></div><div className="mt-3 space-y-2 text-sm">{sale.items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"><span><span className="font-medium">{item.categoryName}</span> · {item.productName}</span><span>{item.quantity} × {money(item.unitPrice, currency)} = <b>{money(item.lineValue, currency)}</b></span></div>)}</div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><span>Total <b>{money(sale.totalValue, currency)}</b></span><span>Paid <b>{money(sale.paidValue, currency)}</b></span><span>Outstanding <b>{money(sale.balanceValue, currency)}</b></span></div>{sale.payments.length ? <div className="mt-3 space-y-2 border-t pt-3 text-sm"><p className="font-medium">Payment history</p>{sale.payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2"><span>{payment.businessDate} · {payment.receiptNumber} · {money(payment.amount, currency)}</span><Button size="sm" variant="ghost" onClick={() => void downloadReceipt(payment.id, payment.receiptNumber)}>Download receipt</Button></div>)}</div> : null}{allowPayment && sale.status !== 'settled' && sale.balanceValue > 0 ? <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-[9rem_12rem_1fr_auto]"><Input type="number" min={0.01} max={sale.balanceValue} step={0.01} placeholder="Amount received" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} /><Select value={paymentMethodId} onValueChange={setPaymentMethodId} disabled={busy}><SelectTrigger><SelectValue placeholder="Payment method" /></SelectTrigger><SelectContent><SelectGroup>{paymentMethods.map((method) => <SelectItem key={method.id} value={String(method.id)}>{method.name}</SelectItem>)}</SelectGroup></SelectContent></Select><Input placeholder="Reference (optional)" value={reference} onChange={(event) => setReference(event.target.value)} disabled={busy} /><Button onClick={() => void recordPayment()} disabled={busy || !amount || !paymentMethodId || Number(amount) <= 0 || Number(amount) > sale.balanceValue}>{busy ? <LoaderCircle className="animate-spin" /> : <Check />}Record payment &amp; issue receipt</Button></div> : null}</div>;
}

function CreditReviewCard({ note, currency, onRefresh, inventoryMode }: { note: CreditNoteView; currency: string; onRefresh: () => void; inventoryMode: boolean }) {
  const [approvedValue, setApprovedValue] = useState(note.requestedValue.toFixed(2));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function decide(action: 'approve' | 'reject') {
    if (action === 'reject' && !reason.trim()) { toast.error('Add a reason before rejecting'); return; }
    setBusy(true);
    try { const response = await fetch(`/api/customer-transactions/${note.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'credit-note', action, approvedValue: action === 'approve' ? approvedValue : undefined, reason: reason || undefined }) }); if (!response.ok) throw new Error(await responseError(response)); toast.success(action === 'approve' ? 'Credit note approved' : 'Credit note rejected'); onRefresh(); }
    catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }
  async function inventoryDecision(itemId: number, decision: 'restock' | 'reject') {
    const inventoryReason = window.prompt(decision === 'restock' ? 'Reason for returning this item to stock' : 'Why is this item rejected from stock?');
    if (!inventoryReason?.trim()) return;
    setBusy(true);
    try { const response = await fetch(`/api/customer-transactions/${note.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'credit-note', action: 'inventory-decision', itemId, decision, reason: inventoryReason }) }); if (!response.ok) throw new Error(await responseError(response)); toast.success('Inventory decision recorded'); onRefresh(); }
    catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }
  return <div className="rounded-lg border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{note.noteNumber} · {note.storeName}</p><p className="text-sm text-muted-foreground">{note.customerName} · {note.businessDate} · {note.reason}</p></div><Status value={note.status} /></div><div className="mt-3 space-y-2 text-sm">{note.items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-3 py-2"><span className="font-medium">{item.productName}</span><span>{item.quantity} unit{item.quantity === 1 ? '' : 's'}</span><span>{money(item.originalValue, currency)}</span><Status value={item.inventoryStatus} />{item.inventoryStatus === 'pending-review' ? <>{inventoryMode ? <><Button size="sm" variant="outline" disabled={busy} onClick={() => void inventoryDecision(item.id, 'restock')}>Restock</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => void inventoryDecision(item.id, 'reject')}>Reject stock</Button></> : <span className="text-xs text-amber-700">Inventory decision required</span>}</> : null}</div>)}</div>{note.status === 'submitted' && !inventoryMode ? <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-[10rem_1fr_auto_auto]"><Input type="number" min={0.01} step={0.01} value={approvedValue} disabled={busy} onChange={(event) => setApprovedValue(event.target.value)} /><Textarea className="min-h-9" placeholder="Decision reason (required to reject)" value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /><Button onClick={() => void decide('approve')} disabled={busy || !approvedValue}>{busy ? <LoaderCircle className="animate-spin" /> : <Check />}Approve</Button><Button variant="destructive" onClick={() => void decide('reject')} disabled={busy}><X />Reject</Button></div> : null}</div>;
}

function DepositReviewCard({ deposit, currency, onRefresh }: { deposit: DepositView; currency: string; onRefresh: () => void }) {
  const [decision, setDecision] = useState<'refund' | 'forfeit' | 'store-credit'>('refund');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function decide() {
    if (!reason.trim()) { toast.error('Add a reason before deciding'); return; }
    setBusy(true);
    try { const response = await fetch(`/api/customer-transactions/${deposit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'deposit', action: 'decide-cancellation', decision, reason }) }); if (!response.ok) throw new Error(await responseError(response)); toast.success('Deposit cancellation decided'); onRefresh(); }
    catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }
  return <div className="rounded-lg border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{deposit.depositNumber} · {deposit.productName}</p><p className="text-sm text-muted-foreground">{deposit.storeName} · {deposit.customerName} · {deposit.businessDate}</p></div><Status value={deposit.status} /></div><div className="mt-3 space-y-2 text-sm">{deposit.items.length ? deposit.items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"><span className="font-medium">{item.productName}{item.sku ? ` · ${item.sku}` : ''}</span><span>{item.quantity} × {money(item.unitPrice, currency)} = <b>{money(item.lineValue, currency)}</b></span></div>) : <div className="rounded-md bg-muted/40 px-3 py-2">{deposit.productName} · {deposit.quantity} unit{deposit.quantity === 1 ? '' : 's'}</div>}</div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><span>Total <b>{money(deposit.totalValue, currency)}</b></span><span>Received <b>{money(deposit.paidValue, currency)}</b></span><span>Reason <b>{deposit.cancellationReason ?? '—'}</b></span></div>{deposit.status === 'cancel-requested' ? <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-[12rem_1fr_auto]"><Select value={decision} onValueChange={(value) => setDecision(value as typeof decision)} disabled={busy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="refund">Refund money</SelectItem><SelectItem value="forfeit">Forfeit deposit</SelectItem><SelectItem value="store-credit">Convert to store credit</SelectItem></SelectGroup></SelectContent></Select><Textarea className="min-h-9" placeholder="Finance decision reason" value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /><Button onClick={() => void decide()} disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Check />}Record decision</Button></div> : null}</div>;
}

export default function CustomerTransactionsReview({ currency, backHref, title, inventoryMode = false, includeDeposits = true, allowCreditPayments = false }: { currency: string; backHref: string; title: string; inventoryMode?: boolean; includeDeposits?: boolean; allowCreditPayments?: boolean }) {
  const [data, setData] = useState<CustomerTransactionList>({ creditSales: [], creditNotes: [], deposits: [] });
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const [transactionResponse, referenceResponse] = await Promise.all([fetch('/api/customer-transactions?openCredits=true', { cache: 'no-store' }), fetch('/api/reference-data', { cache: 'no-store' })]); if (!transactionResponse.ok) throw new Error(await responseError(transactionResponse)); if (!referenceResponse.ok) throw new Error(await responseError(referenceResponse)); setData(await transactionResponse.json() as CustomerTransactionList); const references = await referenceResponse.json() as ReferenceDataResponse; setPaymentMethods(references.paymentMethods); } catch (loadError) { setError((loadError as Error).message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6"><div className="flex items-center gap-3"><Button variant="outline" size="icon" asChild aria-label="Back"><Link href={backHref}><ArrowLeft /></Link></Button><div><h1 className="text-xl font-semibold tracking-tight">{title}</h1><p className="text-sm text-muted-foreground">{inventoryMode ? 'Decide whether inspected returned items can go back into stock.' : includeDeposits ? 'Review credit sales, credit notes, and Finance decisions on customer deposits.' : 'Review submitted customer credit sales and credit notes.'}</p></div></div>{error ? <Alert variant="destructive"><AlertTitle>Could not load transactions</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}{loading ? <LoaderCircle className="animate-spin" /> : <><section className="space-y-3"><h2 className="text-base font-semibold">Customer Credit Sales</h2>{data.creditSales.length ? data.creditSales.map((sale) => <CreditSaleReviewCard key={sale.id} sale={sale} currency={currency} paymentMethods={paymentMethods} allowPayment={allowCreditPayments} onRefresh={() => void load()} />) : <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No customer credit sales have been recorded.</p>}</section><section className="space-y-3"><h2 className="text-base font-semibold">Returns &amp; Credit Notes</h2>{data.creditNotes.length ? data.creditNotes.map((note) => <CreditReviewCard key={note.id} note={note} currency={currency} inventoryMode={inventoryMode} onRefresh={() => void load()} />) : <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No credit notes have been submitted.</p>}</section>{!inventoryMode && includeDeposits ? <section className="space-y-3"><h2 className="text-base font-semibold">Customer Deposits &amp; Redemptions</h2>{data.deposits.length ? data.deposits.map((deposit) => <DepositReviewCard key={deposit.id} deposit={deposit} currency={currency} onRefresh={() => void load()} />) : <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No customer deposits have been recorded.</p>}</section> : null}</>}</main>;
}
