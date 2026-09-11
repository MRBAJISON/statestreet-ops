import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { AppUser } from './auth';
import type {
  CreateCreditSaleInput,
  CreateCreditNoteInput,
  CreateDepositInput,
  CreditSalePaymentInput,
  DecideCreditNoteInput,
  DepositPaymentInput,
  InventoryCreditDecisionInput,
  RedeemCreditNoteInput,
} from './contracts/customer-transactions';
import { db } from './db';
import {
  categories,
  customerCreditSaleItems,
  customerCreditSalePayments,
  customerCreditSales,
  customerCreditNoteItems,
  customerCreditNoteRedemptions,
  customerCreditNotes,
  customerDepositItems,
  customerDepositPayments,
  customerDeposits,
  paymentMethods,
  products,
  stores,
} from './db/foundation-schema';
import { HttpError, sessionUserId } from './server-errors';
import { resolveActingStore } from './store-access';

const STORE_TRANSACTION_READERS = new Set(['owner', 'finance', 'commercial', 'operations', 'inventory', 'store-manager']);
const CREDIT_APPROVERS = new Set(['finance', 'commercial']);
const CREDIT_PAYMENT_ACTORS = new Set(['store-manager', 'finance', 'operations']);

export interface CreditSaleItemView {
  id: number;
  categoryId: number;
  categoryName: string;
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineValue: number;
}

export interface CreditSalePaymentView {
  id: number;
  receiptNumber: string;
  businessDate: string;
  amount: number;
  paymentMethodId: number;
  reference: string | null;
}

export interface CreditSaleView {
  id: number;
  creditNumber: string;
  storeId: number;
  storeCode: string;
  storeName: string;
  businessDate: string;
  customerName: string;
  customerPhone: string | null;
  receiptNumber: string | null;
  dueDate: string | null;
  totalValue: number;
  paidValue: number;
  balanceValue: number;
  status: string;
  items: CreditSaleItemView[];
  payments: CreditSalePaymentView[];
}

export interface CreditNoteItemView {
  id: number;
  productId: number | null;
  productName: string;
  quantity: number;
  originalValue: number;
  unitPrice: number | null;
  unwornUnused: boolean;
  originalTagsAttached: boolean;
  originalPackaging: boolean;
  inspectedApproved: boolean;
  inventoryStatus: string;
  inventoryDecision: string | null;
  inventoryDecisionReason: string | null;
}

export interface DepositItemView {
  id: number;
  productId: number;
  productName: string;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  unitPrice: number;
  lineValue: number;
}

export interface CreditNoteView {
  id: number;
  noteNumber: string;
  storeId: number;
  storeCode: string;
  storeName: string;
  businessDate: string;
  customerName: string;
  customerPhone: string | null;
  originalReceiptNumber: string | null;
  originalPurchaseDate: string | null;
  reason: string;
  requestedValue: number;
  approvedValue: number | null;
  redeemedValue: number;
  remainingValue: number;
  status: string;
  decisionReason: string | null;
  submittedByUserId: number;
  approvedByUserId: number | null;
  approvedAt: string | null;
  items: CreditNoteItemView[];
  redemptions: Array<{
    id: number;
    businessDate: string;
    replacementDescription: string | null;
    replacementValue: number;
    creditApplied: number;
    additionalPayment: number;
  }>;
}

export interface DepositView {
  id: number;
  depositNumber: string;
  storeId: number;
  storeCode: string;
  storeName: string;
  businessDate: string;
  customerName: string;
  customerPhone: string | null;
  productId: number;
  productName: string;
  quantity: number;
  totalValue: number;
  items: DepositItemView[];
  paidValue: number;
  balanceValue: number;
  expectedCollectionDate: string | null;
  status: string;
  cancellationReason: string | null;
  cancellationDecision: string | null;
  decisionReason: string | null;
  payments: Array<{ id: number; paymentType: string; amount: number; businessDate: string; reference: string | null }>;
}

export interface CustomerTransactionList {
  creditSales: CreditSaleView[];
  creditNotes: CreditNoteView[];
  deposits: DepositView[];
}

export interface CustomerTransactionSummary {
  creditSales: number;
  creditCollections: number;
  openCreditBalance: number;
  approvedCredits: number;
  creditRedemptions: number;
  depositReceived: number;
  depositRefunds: number;
  additionalPayments: number;
  netRevenueAdjustment: number;
  cashAdjustment: number;
}

export interface CustomerTransactionDayAdjustment {
  businessDate: string;
  netRevenueAdjustment: number;
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

async function managerStore(user: AppUser, requestedStoreId?: number) {
  return resolveActingStore(user, requestedStoreId);
}

async function storeFilter(user: AppUser, requestedStoreId?: number) {
  if (user.role === 'store-manager') return managerStore(user, requestedStoreId);
  if (requestedStoreId) {
    const [store] = await db.select({ id: stores.id, code: stores.code, name: stores.name }).from(stores).where(and(eq(stores.id, requestedStoreId), eq(stores.active, true), eq(stores.type, 'store'))).limit(1);
    if (!store) throw new HttpError(404, 'Store not found');
    return store;
  }
  return null;
}

export async function listCustomerTransactions(
  user: AppUser,
  requestedStoreId?: number,
  businessDate?: string,
  includeOpenDeposits = false,
  includeOpenCreditSales = false
): Promise<CustomerTransactionList> {
  if (!STORE_TRANSACTION_READERS.has(user.role)) throw new HttpError(403, 'Forbidden');
  const store = await storeFilter(user, requestedStoreId);
  const noteConditions = [];
  const depositConditions = [];
  const creditSaleConditions = [];
  if (store) {
    noteConditions.push(eq(customerCreditNotes.storeId, store.id));
    depositConditions.push(eq(customerDeposits.storeId, store.id));
    creditSaleConditions.push(eq(customerCreditSales.storeId, store.id));
  }
  if (businessDate) {
    noteConditions.push(eq(customerCreditNotes.businessDate, businessDate));
    depositConditions.push(
      includeOpenDeposits
        ? or(eq(customerDeposits.businessDate, businessDate), inArray(customerDeposits.status, ['active', 'ready']))!
        : eq(customerDeposits.businessDate, businessDate)
    );
    creditSaleConditions.push(
      includeOpenCreditSales
        ? or(eq(customerCreditSales.businessDate, businessDate), inArray(customerCreditSales.status, ['open', 'partial']))!
        : eq(customerCreditSales.businessDate, businessDate)
    );
  }

  const [creditSaleRows, noteRows, depositRows] = await Promise.all([
    db.select({
      id: customerCreditSales.id,
      storeId: customerCreditSales.storeId,
      storeCode: stores.code,
      storeName: stores.name,
      businessDate: customerCreditSales.businessDate,
      customerName: customerCreditSales.customerName,
      customerPhone: customerCreditSales.customerPhone,
      receiptNumber: customerCreditSales.receiptNumber,
      dueDate: customerCreditSales.dueDate,
      totalValue: customerCreditSales.totalValue,
      openValue: customerCreditSales.openValue,
      status: customerCreditSales.status,
    }).from(customerCreditSales).innerJoin(stores, eq(stores.id, customerCreditSales.storeId))
      .where(creditSaleConditions.length ? and(...creditSaleConditions) : undefined)
      .orderBy(desc(customerCreditSales.businessDate), desc(customerCreditSales.id)).limit(200),
    db.select({
      id: customerCreditNotes.id,
      storeId: customerCreditNotes.storeId,
      storeCode: stores.code,
      storeName: stores.name,
      businessDate: customerCreditNotes.businessDate,
      customerName: customerCreditNotes.customerName,
      customerPhone: customerCreditNotes.customerPhone,
      originalReceiptNumber: customerCreditNotes.originalReceiptNumber,
      originalPurchaseDate: customerCreditNotes.originalPurchaseDate,
      reason: customerCreditNotes.reason,
      requestedValue: customerCreditNotes.requestedValue,
      approvedValue: customerCreditNotes.approvedValue,
      status: customerCreditNotes.status,
      decisionReason: customerCreditNotes.decisionReason,
      submittedByUserId: customerCreditNotes.submittedByUserId,
      approvedByUserId: customerCreditNotes.approvedByUserId,
      approvedAt: customerCreditNotes.approvedAt,
    }).from(customerCreditNotes).innerJoin(stores, eq(stores.id, customerCreditNotes.storeId))
      .where(noteConditions.length ? and(...noteConditions) : undefined)
      .orderBy(desc(customerCreditNotes.businessDate), desc(customerCreditNotes.id)).limit(200),
    db.select({
      id: customerDeposits.id,
      storeId: customerDeposits.storeId,
      storeCode: stores.code,
      storeName: stores.name,
      businessDate: customerDeposits.businessDate,
      customerName: customerDeposits.customerName,
      customerPhone: customerDeposits.customerPhone,
      productId: customerDeposits.productId,
      productName: customerDeposits.productName,
      quantity: customerDeposits.quantity,
      totalValue: customerDeposits.totalValue,
      expectedCollectionDate: customerDeposits.expectedCollectionDate,
      status: customerDeposits.status,
      cancellationReason: customerDeposits.cancellationReason,
      cancellationDecision: customerDeposits.cancellationDecision,
      decisionReason: customerDeposits.decisionReason,
    }).from(customerDeposits).innerJoin(stores, eq(stores.id, customerDeposits.storeId))
      .where(depositConditions.length ? and(...depositConditions) : undefined)
      .orderBy(desc(customerDeposits.businessDate), desc(customerDeposits.id)).limit(200),
  ]);

  const creditSaleIds = creditSaleRows.map((row) => row.id);
  const noteIds = noteRows.map((row) => row.id);
  const depositIds = depositRows.map((row) => row.id);
  const [items, redemptions, payments, depositItems] = await Promise.all([
    noteIds.length ? db.select().from(customerCreditNoteItems).where(inArray(customerCreditNoteItems.creditNoteId, noteIds)).orderBy(customerCreditNoteItems.id) : Promise.resolve([]),
    noteIds.length ? db.select().from(customerCreditNoteRedemptions).where(inArray(customerCreditNoteRedemptions.creditNoteId, noteIds)).orderBy(desc(customerCreditNoteRedemptions.businessDate), desc(customerCreditNoteRedemptions.id)) : Promise.resolve([]),
    depositIds.length ? db.select().from(customerDepositPayments).where(inArray(customerDepositPayments.depositId, depositIds)).orderBy(customerDepositPayments.id) : Promise.resolve([]),
    depositIds.length ? db.select().from(customerDepositItems).where(inArray(customerDepositItems.depositId, depositIds)).orderBy(customerDepositItems.id) : Promise.resolve([]),
  ]);
  const [creditSaleItemRows, creditSalePaymentRows] = await Promise.all([
    creditSaleIds.length
      ? db.select({
          id: customerCreditSaleItems.id,
          creditSaleId: customerCreditSaleItems.creditSaleId,
          categoryId: customerCreditSaleItems.categoryId,
          categoryName: categories.name,
          productId: customerCreditSaleItems.productId,
          productName: customerCreditSaleItems.productName,
          quantity: customerCreditSaleItems.quantity,
          unitPrice: customerCreditSaleItems.unitPrice,
          lineValue: customerCreditSaleItems.lineValue,
        }).from(customerCreditSaleItems)
          .innerJoin(categories, eq(categories.id, customerCreditSaleItems.categoryId))
          .where(inArray(customerCreditSaleItems.creditSaleId, creditSaleIds))
          .orderBy(customerCreditSaleItems.id)
      : Promise.resolve([]),
    creditSaleIds.length
      ? db.select().from(customerCreditSalePayments)
          .where(inArray(customerCreditSalePayments.creditSaleId, creditSaleIds))
          .orderBy(customerCreditSalePayments.id)
      : Promise.resolve([]),
  ]);
  const itemsByCreditSale = new Map<number, CreditSaleItemView[]>();
  for (const item of creditSaleItemRows) {
    const list = itemsByCreditSale.get(item.creditSaleId) ?? [];
    list.push({
      id: item.id,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: numberValue(item.unitPrice),
      lineValue: numberValue(item.lineValue),
    });
    itemsByCreditSale.set(item.creditSaleId, list);
  }
  const paymentsByCreditSale = new Map<number, CreditSalePaymentView[]>();
  for (const payment of creditSalePaymentRows) {
    const list = paymentsByCreditSale.get(payment.creditSaleId) ?? [];
    list.push({
      id: payment.id,
      receiptNumber: `RCP-${String(payment.storeId)}-${payment.id}`,
      businessDate: payment.businessDate,
      amount: numberValue(payment.amount),
      paymentMethodId: payment.paymentMethodId,
      reference: payment.reference,
    });
    paymentsByCreditSale.set(payment.creditSaleId, list);
  }
  const creditSales = creditSaleRows.map((sale) => {
    const payments = (paymentsByCreditSale.get(sale.id) ?? []).map((payment) => ({
      ...payment,
      receiptNumber: `RCP-${sale.storeCode}-${payment.id}`,
    }));
    const paidValue = payments.reduce((sum, payment) => sum + payment.amount, 0);
    return {
      id: sale.id,
      creditNumber: `CR-${sale.storeCode}-${sale.id}`,
      storeId: sale.storeId,
      storeCode: sale.storeCode,
      storeName: sale.storeName,
      businessDate: sale.businessDate,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      receiptNumber: sale.receiptNumber,
      dueDate: sale.dueDate,
      totalValue: numberValue(sale.totalValue),
      paidValue,
      balanceValue: numberValue(sale.openValue),
      status: sale.status,
      items: itemsByCreditSale.get(sale.id) ?? [],
      payments,
    } satisfies CreditSaleView;
  });
  const itemsByNote = new Map<number, CreditNoteItemView[]>();
  for (const item of items) {
    const list = itemsByNote.get(item.creditNoteId) ?? [];
    list.push({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      originalValue: numberValue(item.originalValue),
      unitPrice: item.unitPrice == null ? null : numberValue(item.unitPrice),
      unwornUnused: item.unwornUnused,
      originalTagsAttached: item.originalTagsAttached,
      originalPackaging: item.originalPackaging,
      inspectedApproved: item.inspectedApproved,
      inventoryStatus: item.inventoryStatus,
      inventoryDecision: item.inventoryDecision,
      inventoryDecisionReason: item.inventoryDecisionReason,
    });
    itemsByNote.set(item.creditNoteId, list);
  }
  const redemptionsByNote = new Map<number, CreditNoteView['redemptions']>();
  for (const item of redemptions) {
    const list = redemptionsByNote.get(item.creditNoteId) ?? [];
    list.push({ id: item.id, businessDate: item.businessDate, replacementDescription: item.replacementDescription, replacementValue: numberValue(item.replacementValue), creditApplied: numberValue(item.creditApplied), additionalPayment: numberValue(item.additionalPayment) });
    redemptionsByNote.set(item.creditNoteId, list);
  }
  const creditNotes = noteRows.map((note) => {
    const noteRedemptions = redemptionsByNote.get(note.id) ?? [];
    const approved = numberValue(note.approvedValue);
    const redeemed = noteRedemptions.reduce((sum, item) => sum + item.creditApplied, 0);
    return {
      id: note.id,
      noteNumber: `CN-${note.storeCode}-${note.id}`,
      storeId: note.storeId,
      storeCode: note.storeCode,
      storeName: note.storeName,
      businessDate: note.businessDate,
      customerName: note.customerName,
      customerPhone: note.customerPhone,
      originalReceiptNumber: note.originalReceiptNumber,
      originalPurchaseDate: note.originalPurchaseDate,
      reason: note.reason,
      requestedValue: numberValue(note.requestedValue),
      approvedValue: note.approvedValue == null ? null : approved,
      redeemedValue: redeemed,
      remainingValue: Math.max(approved - redeemed, 0),
      status: note.status,
      decisionReason: note.decisionReason,
      submittedByUserId: note.submittedByUserId,
      approvedByUserId: note.approvedByUserId,
      approvedAt: note.approvedAt?.toISOString() ?? null,
      items: itemsByNote.get(note.id) ?? [],
      redemptions: noteRedemptions,
    } satisfies CreditNoteView;
  });
  const itemsByDeposit = new Map<number, DepositItemView[]>();
  for (const item of depositItems) {
    const list = itemsByDeposit.get(item.depositId) ?? [];
    list.push({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      barcode: item.barcode,
      quantity: item.quantity,
      unitPrice: numberValue(item.unitPrice),
      lineValue: numberValue(item.lineValue),
    });
    itemsByDeposit.set(item.depositId, list);
  }
  const paymentsByDeposit = new Map<number, DepositView['payments']>();
  for (const payment of payments) {
    const list = paymentsByDeposit.get(payment.depositId) ?? [];
    list.push({ id: payment.id, paymentType: payment.paymentType, amount: numberValue(payment.amount), businessDate: payment.businessDate, reference: payment.reference });
    paymentsByDeposit.set(payment.depositId, list);
  }
  const deposits = depositRows.map((deposit) => {
    const depositPayments = paymentsByDeposit.get(deposit.id) ?? [];
    const paid = depositPayments.reduce((sum, payment) => sum + (payment.paymentType === 'refund' ? -payment.amount : payment.amount), 0);
    return {
      id: deposit.id,
      depositNumber: `DEP-${deposit.storeCode}-${deposit.id}`,
      storeId: deposit.storeId,
      storeCode: deposit.storeCode,
      storeName: deposit.storeName,
      businessDate: deposit.businessDate,
      customerName: deposit.customerName,
      customerPhone: deposit.customerPhone,
      productId: deposit.productId,
      productName: deposit.productName,
      quantity: deposit.quantity,
      totalValue: numberValue(deposit.totalValue),
      items: itemsByDeposit.get(deposit.id) ?? [],
      paidValue: Math.max(paid, 0),
      balanceValue: Math.max(numberValue(deposit.totalValue) - paid, 0),
      expectedCollectionDate: deposit.expectedCollectionDate,
      status: deposit.status,
      cancellationReason: deposit.cancellationReason,
      cancellationDecision: deposit.cancellationDecision,
      decisionReason: deposit.decisionReason,
      payments: depositPayments,
    } satisfies DepositView;
  });
  return { creditSales, creditNotes, deposits };
}

export async function getCustomerTransactionSummary(storeId: number, from: string, to: string): Promise<CustomerTransactionSummary> {
  const result = await db.execute(sql`
    select
      coalesce((select sum(sale.total_value) from customer_credit_sales sale where sale.store_id = ${storeId} and sale.business_date between ${from}::date and ${to}::date), 0) as credit_sales,
      coalesce((select sum(payment.amount) from customer_credit_sale_payments payment where payment.store_id = ${storeId} and payment.business_date between ${from}::date and ${to}::date), 0) as credit_collections,
      coalesce((select sum(sale.open_value) from customer_credit_sales sale where sale.store_id = ${storeId} and sale.status in ('open', 'partial')), 0) as open_credit_balance,
      coalesce((select sum(note.approved_value) from customer_credit_notes note where note.store_id = ${storeId} and note.business_date between ${from}::date and ${to}::date and note.status in ('approved', 'partially-redeemed', 'redeemed')), 0) as approved_credits,
      coalesce((select sum(redemption.credit_applied) from customer_credit_note_redemptions redemption join customer_credit_notes note on note.id = redemption.credit_note_id where note.store_id = ${storeId} and redemption.business_date between ${from}::date and ${to}::date), 0) as credit_redemptions,
      coalesce((select sum(payment.amount) from customer_deposit_payments payment where payment.store_id = ${storeId} and payment.business_date between ${from}::date and ${to}::date and payment.payment_type in ('deposit', 'balance')), 0) as deposit_received,
      coalesce((select sum(payment.amount) from customer_deposit_payments payment where payment.store_id = ${storeId} and payment.business_date between ${from}::date and ${to}::date and payment.payment_type = 'refund'), 0) as deposit_refunds,
      coalesce((select sum(redemption.additional_payment) from customer_credit_note_redemptions redemption where redemption.store_id = ${storeId} and redemption.business_date between ${from}::date and ${to}::date), 0) as additional_payments
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const creditSales = numberValue(row?.credit_sales);
  const creditCollections = numberValue(row?.credit_collections);
  const openCreditBalance = numberValue(row?.open_credit_balance);
  const approvedCredits = numberValue(row?.approved_credits);
  const creditRedemptions = numberValue(row?.credit_redemptions);
  const depositReceived = numberValue(row?.deposit_received);
  const depositRefunds = numberValue(row?.deposit_refunds);
  const additionalPayments = numberValue(row?.additional_payments);
  return {
    creditSales,
    creditCollections,
    openCreditBalance,
    approvedCredits,
    creditRedemptions,
    depositReceived,
    depositRefunds,
    additionalPayments,
    // Credit sales are revenue at the time the goods leave the store. Collections
    // are cash movements only and are deliberately excluded from net revenue.
    netRevenueAdjustment: creditSales + depositReceived + additionalPayments - approvedCredits - depositRefunds,
    cashAdjustment: depositReceived + additionalPayments + creditCollections - depositRefunds,
  };
}

export async function getCustomerTransactionDailyAdjustments(storeId: number, from: string, to: string): Promise<CustomerTransactionDayAdjustment[]> {
  const result = await db.execute(sql`
    select dates.business_date,
      coalesce(sum(dates.revenue_adjustment), 0) as net_revenue_adjustment
    from (
      select note.business_date, -note.approved_value as revenue_adjustment
      from customer_credit_notes note
      where note.store_id = ${storeId} and note.business_date between ${from}::date and ${to}::date and note.status in ('approved', 'partially-redeemed', 'redeemed')
      union all
      select payment.business_date, case when payment.payment_type = 'refund' then -payment.amount else payment.amount end
      from customer_deposit_payments payment
      where payment.store_id = ${storeId} and payment.business_date between ${from}::date and ${to}::date
      union all
      select redemption.business_date, redemption.additional_payment
      from customer_credit_note_redemptions redemption
      where redemption.store_id = ${storeId} and redemption.business_date between ${from}::date and ${to}::date
      union all
      select sale.business_date, sale.total_value
      from customer_credit_sales sale
      where sale.store_id = ${storeId} and sale.business_date between ${from}::date and ${to}::date
    ) dates
    group by dates.business_date order by dates.business_date
  `);
  return result.rows.map((row) => ({ businessDate: String(row.business_date), netRevenueAdjustment: numberValue(row.net_revenue_adjustment) }));
}

async function requireStoreManager(user: AppUser, requestedStoreId?: number) {
  if (user.role !== 'store-manager') throw new HttpError(403, 'Only a store manager can record this transaction');
  return managerStore(user, requestedStoreId);
}

function moneyString(value: number) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

async function requireCreditPaymentAccess(user: AppUser, storeId: number) {
  if (!CREDIT_PAYMENT_ACTORS.has(user.role)) throw new HttpError(403, 'You cannot record a credit payment');
  if (user.role === 'store-manager') {
    const store = await managerStore(user);
    if (store.id !== storeId) throw new HttpError(403, 'You cannot record a payment for this store');
  }
}

export async function createCreditSale(user: AppUser, input: CreateCreditSaleInput) {
  const store = await requireStoreManager(user, input.storeId);
  const actor = sessionUserId(user.id);
  const categoryIds = [...new Set(input.items.map((item) => item.categoryId))];
  const productIds = [...new Set(input.items.map((item) => item.productId).filter((id): id is number => id != null))];
  const [categoryRows, productRows] = await Promise.all([
    db.select({ id: categories.id }).from(categories).where(and(inArray(categories.id, categoryIds), eq(categories.active, true))),
    productIds.length
      ? db.select({ id: products.id, categoryId: products.categoryId, name: products.name, sellingPrice: products.sellingPrice })
          .from(products).where(and(inArray(products.id, productIds), eq(products.active, true)))
      : Promise.resolve([]),
  ]);
  if (categoryRows.length !== categoryIds.length) throw new HttpError(400, 'Choose an active category for every credit-sale line');
  const productById = new Map(productRows.map((product) => [product.id, product]));
  const items = input.items.map((item) => {
    const product = item.productId ? productById.get(item.productId) : undefined;
    if (item.productId && !product) throw new HttpError(400, 'One or more selected products are unavailable');
    if (product && product.categoryId !== item.categoryId) throw new HttpError(400, `${product.name} does not belong to the selected category`);
    const unitPrice = product?.sellingPrice == null ? Number(item.unitPrice ?? 0) : Number(product.sellingPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new HttpError(400, `${item.productName} needs a valid selling price before it can be recorded on credit`);
    }
    return {
      categoryId: item.categoryId,
      productId: product?.id ?? null,
      productName: product?.name ?? item.productName,
      quantity: item.quantity,
      unitPrice: moneyString(unitPrice),
      lineValue: moneyString(unitPrice * item.quantity),
    };
  });
  const totalValue = moneyString(items.reduce((sum, item) => sum + Number(item.lineValue), 0));
  const itemsJson = JSON.stringify(items);
  const result = await db.execute(sql`
    with created_sale as (
      insert into customer_credit_sales (
        store_id, daily_report_id, business_date, customer_name, customer_phone, receipt_number,
        due_date, total_value, open_value, status, created_by_user_id, updated_by_user_id
      )
      values (
        ${store.id},
        (select report.id from daily_reports report where report.store_id = ${store.id} and report.business_date = ${input.businessDate}::date limit 1),
        ${input.businessDate}, ${input.customerName}, ${input.customerPhone ?? null}, ${input.receiptNumber ?? null},
        ${input.dueDate ?? null}, ${totalValue}, ${totalValue}, 'open', ${actor}, ${actor}
      )
      returning *
    ), created_items as (
      insert into customer_credit_sale_items (credit_sale_id, category_id, product_id, product_name, quantity, unit_price, line_value)
      select sale.id, item."categoryId", item."productId", item."productName", item.quantity, item."unitPrice", item."lineValue"
      from created_sale sale
      cross join jsonb_to_recordset(${itemsJson}::jsonb) as item(
        "categoryId" bigint, "productId" bigint, "productName" text, quantity integer,
        "unitPrice" numeric(14, 2), "lineValue" numeric(14, 2)
      )
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata)
      select 'customer-credit-sale', sale.id, 'create', ${actor},
        jsonb_build_object('status', sale.status, 'totalValue', sale.total_value, 'openValue', sale.open_value),
        jsonb_build_object('storeId', sale.store_id, 'itemCount', (select count(*) from created_items))
      from created_sale sale
    )
    select id from created_sale
  `);
  const id = Number((result.rows[0] as { id?: number | string } | undefined)?.id ?? 0);
  if (!id) throw new HttpError(400, 'Credit sale could not be recorded');
  return id;
}

export async function addCreditSalePayment(user: AppUser, creditSaleId: number, input: CreditSalePaymentInput) {
  const [sale] = await db.select({ storeId: customerCreditSales.storeId }).from(customerCreditSales).where(eq(customerCreditSales.id, creditSaleId)).limit(1);
  if (!sale) throw new HttpError(404, 'Credit sale not found');
  await requireCreditPaymentAccess(user, sale.storeId);
  const actor = sessionUserId(user.id);
  const result = await db.execute(sql`
    with before_sale as materialized (
      select * from customer_credit_sales sale
      where sale.id = ${creditSaleId}
        and sale.status in ('open', 'partial')
        and sale.open_value >= ${input.amount}::numeric
      for update
    ), created_payment as (
      insert into customer_credit_sale_payments (
        credit_sale_id, store_id, business_date, amount, payment_method_id, reference, created_by_user_id
      )
      select sale.id, sale.store_id, ${input.businessDate}, ${input.amount}, ${input.paymentMethodId}, ${input.reference ?? null}, ${actor}
      from before_sale sale
      returning *
    ), updated_sale as (
      update customer_credit_sales sale
      set open_value = sale.open_value - ${input.amount}::numeric,
          status = case when sale.open_value - ${input.amount}::numeric = 0 then 'settled' else 'partial' end,
          updated_by_user_id = ${actor}, updated_at = now()
      from before_sale before
      where sale.id = before.id
      returning sale.*
    ), cash as (
      insert into cash_transactions (
        business_date, direction, category, amount, reference, description,
        source_type, source_id, created_by_user_id, updated_by_user_id
      )
      select payment.business_date, 'inflow', 'credit-sale-collection', payment.amount, payment.reference,
        concat('Credit sale payment from ', sale.customer_name), 'customer-credit-sale-payment', payment.id, ${actor}, ${actor}
      from created_payment payment join updated_sale sale on sale.id = payment.credit_sale_id
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'customer-credit-sale', sale.id, 'settle', ${actor}, to_jsonb(before), to_jsonb(sale),
        jsonb_build_object('paymentId', payment.id, 'amount', payment.amount, 'cashTransactionId', (select id from cash))
      from updated_sale sale
      join before_sale before on before.id = sale.id
      join created_payment payment on payment.credit_sale_id = sale.id
    )
    select sale.id, sale.status, sale.open_value, payment.id as payment_id
    from updated_sale sale join created_payment payment on payment.credit_sale_id = sale.id
  `);
  const row = result.rows[0] as { id?: number | string; payment_id?: number | string; open_value?: number | string; status?: string } | undefined;
  if (!row?.id || !row.payment_id) throw new HttpError(409, 'Payment exceeds the outstanding balance or the credit sale is already settled');
  return { id: Number(row.id), paymentId: Number(row.payment_id), status: row.status ?? 'partial', openValue: Number(row.open_value ?? 0) };
}

export interface CreditSalePaymentReceipt {
  receiptNumber: string;
  creditNumber: string;
  storeCode: string;
  storeName: string;
  businessDate: string;
  customerName: string;
  customerPhone: string | null;
  originalReceiptNumber: string | null;
  paymentDate: string;
  amount: number;
  paymentMethodName: string;
  reference: string | null;
  previousBalance: number;
  remainingBalance: number;
  items: Array<{ categoryName: string; productName: string; quantity: number; lineValue: number }>;
}

export async function getCreditSalePaymentReceipt(user: AppUser, creditSaleId: number, paymentId: number): Promise<CreditSalePaymentReceipt | null> {
  if (!STORE_TRANSACTION_READERS.has(user.role)) throw new HttpError(403, 'Forbidden');
  const [row] = await db.select({
    saleId: customerCreditSales.id,
    storeId: customerCreditSales.storeId,
    storeCode: stores.code,
    storeName: stores.name,
    businessDate: customerCreditSales.businessDate,
    customerName: customerCreditSales.customerName,
    customerPhone: customerCreditSales.customerPhone,
    originalReceiptNumber: customerCreditSales.receiptNumber,
    paymentDate: customerCreditSalePayments.businessDate,
    amount: customerCreditSalePayments.amount,
    paymentMethodName: paymentMethods.name,
    reference: customerCreditSalePayments.reference,
    paymentId: customerCreditSalePayments.id,
  })
    .from(customerCreditSalePayments)
    .innerJoin(customerCreditSales, eq(customerCreditSales.id, customerCreditSalePayments.creditSaleId))
    .innerJoin(stores, eq(stores.id, customerCreditSales.storeId))
    .innerJoin(paymentMethods, eq(paymentMethods.id, customerCreditSalePayments.paymentMethodId))
    .where(and(eq(customerCreditSalePayments.id, paymentId), eq(customerCreditSalePayments.creditSaleId, creditSaleId)))
    .limit(1);
  if (!row) return null;
  await storeFilter(user, row.storeId);
  const itemRows = await db.select({ categoryName: categories.name, productName: customerCreditSaleItems.productName, quantity: customerCreditSaleItems.quantity, lineValue: customerCreditSaleItems.lineValue })
    .from(customerCreditSaleItems).innerJoin(categories, eq(categories.id, customerCreditSaleItems.categoryId))
    .where(eq(customerCreditSaleItems.creditSaleId, creditSaleId)).orderBy(customerCreditSaleItems.id);
  const [sale] = await db.select({ totalValue: customerCreditSales.totalValue, openValue: customerCreditSales.openValue })
    .from(customerCreditSales).where(eq(customerCreditSales.id, creditSaleId)).limit(1);
  if (!sale) return null;
  return {
    receiptNumber: `RCP-${row.storeCode}-${row.paymentId}`,
    creditNumber: `CR-${row.storeCode}-${row.saleId}`,
    storeCode: row.storeCode,
    storeName: row.storeName,
    businessDate: row.businessDate,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    originalReceiptNumber: row.originalReceiptNumber,
    paymentDate: row.paymentDate,
    amount: numberValue(row.amount),
    paymentMethodName: row.paymentMethodName,
    reference: row.reference,
    previousBalance: numberValue(sale.openValue) + numberValue(row.amount),
    remainingBalance: numberValue(sale.openValue),
    items: itemRows.map((item) => ({ categoryName: item.categoryName, productName: item.productName, quantity: item.quantity, lineValue: numberValue(item.lineValue) })),
  };
}

export async function createCreditNote(user: AppUser, input: CreateCreditNoteInput) {
  const store = await requireStoreManager(user, input.storeId);
  const actor = sessionUserId(user.id);
  const productIds = input.items.map((item) => item.productId).filter((id): id is number => id != null);
  if (new Set(productIds).size !== productIds.length) throw new HttpError(400, 'Each returned product can appear only once per credit note');
  const result = await db.execute(sql`
    with created_note as (
      insert into customer_credit_notes (store_id, business_date, customer_name, customer_phone, original_receipt_number, original_purchase_date, reason, requested_value, status, submitted_by_user_id)
      values (${store.id}, ${input.businessDate}, ${input.customerName}, ${input.customerPhone ?? null}, ${input.originalReceiptNumber ?? null}, ${input.originalPurchaseDate ?? null}, ${input.reason}, (select sum(item."originalValue") from jsonb_to_recordset(${JSON.stringify(input.items)}::jsonb) as item("originalValue" numeric)), 'submitted', ${actor})
      returning *
    ), created_items as (
      insert into customer_credit_note_items (credit_note_id, product_id, product_name, quantity, original_value, unit_price, unworn_unused, original_tags_attached, original_packaging, inspected_approved)
      select note.id, item."productId", item."productName", item.quantity, item."originalValue", coalesce(item."unitPrice", item."originalValue" / item.quantity), item."unwornUnused", item."originalTagsAttached", item."originalPackaging", item."inspectedApproved"
      from created_note note
      cross join jsonb_to_recordset(${JSON.stringify(input.items)}::jsonb) as item("productId" bigint, "productName" text, quantity integer, "originalValue" numeric, "unitPrice" numeric, "unwornUnused" boolean, "originalTagsAttached" boolean, "originalPackaging" boolean, "inspectedApproved" boolean)
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata)
      select 'customer-credit-note', note.id, 'submit', ${actor}, jsonb_build_object('status', note.status, 'requestedValue', note.requested_value), jsonb_build_object('storeId', note.store_id, 'itemCount', (select count(*) from created_items))
      from created_note note
    )
    select id from created_note
  `);
  const id = Number((result.rows[0] as { id?: number | string } | undefined)?.id ?? 0);
  if (!id) throw new HttpError(400, 'Credit note could not be submitted');
  return id;
}

export async function decideCreditNote(user: AppUser, noteId: number, input: DecideCreditNoteInput) {
  if (!CREDIT_APPROVERS.has(user.role)) throw new HttpError(403, 'Only Finance or Commercial can decide a credit note');
  const actor = sessionUserId(user.id);
  if (input.action === 'approve' && input.approvedValue && Number(input.approvedValue) <= 0) throw new HttpError(400, 'Approved credit must be greater than zero');
  const requested = await db.execute(sql`select requested_value from customer_credit_notes where id = ${noteId} and status = 'submitted'`);
  const requestedValue = Number((requested.rows[0] as { requested_value?: string } | undefined)?.requested_value ?? 0);
  if (!requestedValue) throw new HttpError(404, 'Submitted credit note not found');
  if (input.action === 'approve' && input.approvedValue && Number(input.approvedValue) > requestedValue) throw new HttpError(400, 'Approved value cannot exceed the requested credit');
  const result = input.action === 'approve'
    ? await db.execute(sql`
      with updated_note as (
        update customer_credit_notes
        set status = 'approved', approved_value = coalesce(${input.approvedValue ?? null}, requested_value), approved_by_user_id = ${actor}, approved_at = now(), decision_reason = ${input.reason ?? null}, updated_at = now()
        where id = ${noteId} and status = 'submitted'
        returning *
      ), updated_items as (
        update customer_credit_note_items item
        set inventory_status = case when item.product_id is not null and item.unworn_unused and item.original_tags_attached and item.original_packaging and item.inspected_approved then 'auto-restocked' else 'pending-review' end, updated_at = now()
        from updated_note note
        where item.credit_note_id = note.id and item.inventory_status = 'pending'
        returning item.*
      ), restock_items as (
        select item.*, note.store_id, note.business_date, product.unit_cost
        from updated_items item
        join updated_note note on note.id = item.credit_note_id
        join products product on product.id = item.product_id
        where item.inventory_status = 'auto-restocked'
      ), movements as (
        insert into inventory_movements (business_date, product_id, store_id, movement_type, quantity, unit_cost, source_type, source_id, source_line_id, created_by_user_id)
        select business_date, product_id, store_id, 'return', quantity, unit_cost, 'customer-credit-note', credit_note_id, id, ${actor}
        from restock_items
      ), stock as (
        insert into store_stock_levels (store_id, product_id, quantity, as_of_date)
        select store_id, product_id, quantity, business_date from restock_items
        on conflict (store_id, product_id) do update set quantity = store_stock_levels.quantity + excluded.quantity, as_of_date = excluded.as_of_date, updated_at = now()
      ), audit as (
        insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata)
        select 'customer-credit-note', id, 'approve', ${actor}, jsonb_build_object('status', status, 'approvedValue', approved_value), jsonb_build_object('autoRestockedItems', (select count(*) from restock_items), 'reason', ${input.reason ?? null}::text) from updated_note
      )
      select id from updated_note
    `)
    : await db.execute(sql`
      with updated_note as (
        update customer_credit_notes set status = 'rejected', decision_reason = ${input.reason ?? null}, approved_by_user_id = ${actor}, approved_at = now(), updated_at = now()
        where id = ${noteId} and status = 'submitted' returning *
      ), audit as (
        insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata)
        select 'customer-credit-note', id, 'reject', ${actor}, jsonb_build_object('status', status), jsonb_build_object('reason', ${input.reason ?? null}::text) from updated_note
      )
      select id from updated_note
    `);
  if (!result.rows.length) throw new HttpError(409, 'This credit note has already been decided');
  return Number((result.rows[0] as { id: number | string }).id);
}

export async function decideCreditNoteInventory(user: AppUser, noteId: number, input: InventoryCreditDecisionInput) {
  if (!['inventory', 'operations'].includes(user.role)) throw new HttpError(403, 'Only Inventory can decide stock disposition');
  const actor = sessionUserId(user.id);
  const result = input.decision === 'restock'
    ? await db.execute(sql`
      with updated_item as (
        update customer_credit_note_items item
        set inventory_status = 'restocked', inventory_decision = 'restock', inventory_decision_reason = ${input.reason}, inventory_decided_by_user_id = ${actor}, inventory_decided_at = now(), updated_at = now()
        from customer_credit_notes note
        where item.id = ${input.itemId} and item.credit_note_id = note.id and note.id = ${noteId} and note.status = 'approved' and item.inventory_status = 'pending-review' and item.product_id is not null
        returning item.*, note.store_id, note.business_date
      ), product_cost as (
        select item.*, product.unit_cost from updated_item item join products product on product.id = item.product_id
      ), movement as (
        insert into inventory_movements (business_date, product_id, store_id, movement_type, quantity, unit_cost, source_type, source_id, source_line_id, created_by_user_id)
        select business_date, product_id, store_id, 'return', quantity, unit_cost, 'customer-credit-note', ${noteId}, id, ${actor} from product_cost
      ), stock as (
        insert into store_stock_levels (store_id, product_id, quantity, as_of_date)
        select store_id, product_id, quantity, business_date from product_cost
        on conflict (store_id, product_id) do update set quantity = store_stock_levels.quantity + excluded.quantity, as_of_date = excluded.as_of_date, updated_at = now()
      ), audit as (
        insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata)
        select 'customer-credit-note', ${noteId}, 'receive', ${actor}, jsonb_build_object('itemId', id, 'inventoryStatus', inventory_status), jsonb_build_object('reason', ${input.reason}::text) from updated_item
      ) select id from updated_item
    `)
    : await db.execute(sql`
      with updated_item as (
        update customer_credit_note_items item
        set inventory_status = 'rejected', inventory_decision = 'reject', inventory_decision_reason = ${input.reason}, inventory_decided_by_user_id = ${actor}, inventory_decided_at = now(), updated_at = now()
        from customer_credit_notes note
        where item.id = ${input.itemId} and item.credit_note_id = note.id and note.id = ${noteId} and note.status = 'approved' and item.inventory_status = 'pending-review'
        returning item.*
      ), audit as (
        insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata)
        select 'customer-credit-note', ${noteId}, 'update', ${actor}, jsonb_build_object('itemId', id, 'inventoryStatus', inventory_status), jsonb_build_object('reason', ${input.reason}::text) from updated_item
      ) select id from updated_item
    `);
  if (!result.rows.length) throw new HttpError(409, 'This item is no longer awaiting an inventory decision');
  return Number((result.rows[0] as { id: number | string }).id);
}

export async function redeemCreditNote(user: AppUser, noteId: number, input: RedeemCreditNoteInput) {
  const store = await requireStoreManager(user);
  const actor = sessionUserId(user.id);
  const hasPaymentMethod = input.paymentMethodId != null;
  if (Number(input.replacementValue) <= 0) throw new HttpError(400, 'Replacement value must be greater than zero');
  const result = await db.execute(sql`
    with note_balance as (
      select note.id, note.store_id, note.approved_value - coalesce(sum(redemption.credit_applied), 0) as remaining
      from customer_credit_notes note
      left join customer_credit_note_redemptions redemption on redemption.credit_note_id = note.id
      where note.id = ${noteId} and note.store_id = ${store.id} and note.status in ('approved', 'partially-redeemed')
      group by note.id, note.store_id, note.approved_value
    ), replacement_product as (
      select product.name from products product where product.id = ${input.replacementProductId ?? null} and product.active = true
    ), created_redemption as (
      insert into customer_credit_note_redemptions (credit_note_id, store_id, business_date, replacement_product_id, replacement_description, replacement_value, credit_applied, additional_payment, payment_method_id, created_by_user_id)
      select note.id, note.store_id, ${input.businessDate}, ${input.replacementProductId ?? null}, coalesce(${input.replacementDescription ?? null}, (select name from replacement_product)), ${input.replacementValue}, least(${input.replacementValue}::numeric, note.remaining), greatest(${input.replacementValue}::numeric - note.remaining, 0), ${input.paymentMethodId ?? null}, ${actor}
      from note_balance note
      where note.remaining > 0 and (${input.replacementValue}::numeric <= note.remaining or ${hasPaymentMethod}::boolean)
      returning *
    ), updated_note as (
      update customer_credit_notes note
      set status = case when coalesce((select sum(redemption.credit_applied) from customer_credit_note_redemptions redemption where redemption.credit_note_id = note.id), 0) >= note.approved_value then 'redeemed' else 'partially-redeemed' end, updated_at = now()
      from created_redemption redemption where note.id = redemption.credit_note_id returning note.*
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata)
      select 'customer-credit-note', note.id, 'complete', ${actor}, jsonb_build_object('status', note.status), jsonb_build_object('redemptionId', (select id from created_redemption), 'replacementValue', (select replacement_value from created_redemption), 'creditApplied', (select credit_applied from created_redemption), 'additionalPayment', (select additional_payment from created_redemption)) from updated_note note
    ) select id from created_redemption
  `);
  if (!result.rows.length) throw new HttpError(409, 'Credit note is unavailable, fully used, or needs a payment method for the balance');
  return Number((result.rows[0] as { id: number | string }).id);
}

export async function createDeposit(user: AppUser, input: CreateDepositInput) {
  const store = await requireStoreManager(user, input.storeId);
  const actor = sessionUserId(user.id);
  const productIds = input.items.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) throw new HttpError(400, 'Each product can appear only once per deposit');
  const result = await db.execute(sql`
    with item_input as (
      select item."productId"::bigint as product_id, item.quantity
      from jsonb_to_recordset(${JSON.stringify(input.items)}::jsonb) as item("productId" bigint, quantity integer)
    ), catalog_items as (
      select input.product_id, product.name, product.sku, product.barcode, product.selling_price,
        input.quantity,
        (input.quantity * product.selling_price)::numeric(14, 2) as line_value,
        coalesce(level.quantity, 0) - coalesce((
          select sum(reservation.quantity)
          from store_stock_reservations reservation
          where reservation.store_id = ${store.id}
            and reservation.product_id = product.id
            and reservation.status = 'active'
        ), 0) as available
      from item_input input
      join products product on product.id = input.product_id and product.active = true
      left join store_stock_levels level on level.product_id = product.id and level.store_id = ${store.id}
    ), valid_items as (
      select * from catalog_items
      where selling_price is not null and available >= quantity
    ), item_summary as (
      select count(*)::integer as item_count,
        sum(quantity)::integer as total_quantity,
        sum(line_value)::numeric(14, 2) as total_value,
        min(product_id) as first_product_id,
        min(name) as first_product_name
      from valid_items
    ), created_deposit as (
      insert into customer_deposits (store_id, business_date, customer_name, customer_phone, product_id, product_name, quantity, total_value, expected_collection_date, status, created_by_user_id)
      select ${store.id}, ${input.businessDate}, ${input.customerName}, ${input.customerPhone ?? null},
        summary.first_product_id,
        case when summary.item_count = 1 then summary.first_product_name else summary.item_count::text || ' items' end,
        summary.total_quantity, summary.total_value, ${input.expectedCollectionDate ?? null},
        case when ${input.initialPayment}::numeric >= summary.total_value then 'ready' else 'active' end,
        ${actor}
      from item_summary summary
      where summary.item_count = jsonb_array_length(${JSON.stringify(input.items)}::jsonb)
      returning *
    ), created_payment as (
      insert into customer_deposit_payments (deposit_id, store_id, business_date, payment_type, amount, payment_method_id, reference, created_by_user_id)
      select deposit.id, deposit.store_id, deposit.business_date, 'deposit', ${input.initialPayment}, ${input.paymentMethodId ?? null}, ${input.reference ?? null}, ${actor}
      from created_deposit deposit where ${input.initialPayment}::numeric > 0
      returning id
    ), new_items as (
      insert into customer_deposit_items (deposit_id, product_id, product_name, sku, barcode, quantity, unit_price, line_value)
      select deposit.id, item.product_id, item.name, item.sku, item.barcode, item.quantity, item.selling_price, item.line_value
      from created_deposit deposit cross join valid_items item
      returning *
    ), reservation as (
      insert into store_stock_reservations (deposit_id, store_id, product_id, quantity, status)
      select deposit.id, deposit.store_id, item.product_id, item.quantity, 'active'
      from created_deposit deposit join new_items item on item.deposit_id = deposit.id
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata)
      select 'customer-deposit', deposit.id, 'create', ${actor}, jsonb_build_object('status', deposit.status, 'totalValue', deposit.total_value), jsonb_build_object('paymentId', (select id from created_payment), 'reservationCount', (select count(*) from reservation)) from created_deposit deposit
    ) select id from created_deposit
  `);
  if (!result.rows.length) throw new HttpError(409, 'One or more selected products are unavailable or have no selling price in this store');
  return Number((result.rows[0] as { id: number | string }).id);
}

export async function addDepositPayment(user: AppUser, depositId: number, input: DepositPaymentInput) {
  const store = await requireStoreManager(user);
  const actor = sessionUserId(user.id);
  const result = await db.execute(sql`
    with deposit_balance as (
      select deposit.id, deposit.store_id, deposit.total_value - coalesce(sum(case when payment.payment_type = 'refund' then -payment.amount else payment.amount end), 0) as remaining
      from customer_deposits deposit
      left join customer_deposit_payments payment on payment.deposit_id = deposit.id
      where deposit.id = ${depositId} and deposit.store_id = ${store.id} and deposit.status in ('active', 'ready')
      group by deposit.id, deposit.store_id, deposit.total_value
    ), created_payment as (
      insert into customer_deposit_payments (deposit_id, store_id, business_date, payment_type, amount, payment_method_id, reference, created_by_user_id)
      select deposit.id, deposit.store_id, ${input.businessDate}, 'balance', ${input.amount}, ${input.paymentMethodId ?? null}, ${input.reference ?? null}, ${actor} from deposit_balance deposit where ${input.amount}::numeric <= deposit.remaining and ${input.amount}::numeric > 0 returning *
    ), updated_deposit as (
      update customer_deposits deposit set status = case when (select remaining from deposit_balance) - ${input.amount}::numeric <= 0 then 'ready' else 'active' end, updated_at = now()
      from created_payment payment where deposit.id = payment.deposit_id returning deposit.*
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata)
      select 'customer-deposit', deposit.id, 'update', ${actor}, jsonb_build_object('status', deposit.status), jsonb_build_object('paymentId', (select id from created_payment), 'amount', ${input.amount}::numeric) from updated_deposit deposit
    ) select id from created_payment
  `);
  if (!result.rows.length) throw new HttpError(409, 'Payment is greater than the outstanding deposit balance or the deposit is closed');
  return Number((result.rows[0] as { id: number | string }).id);
}

export async function collectDeposit(user: AppUser, depositId: number) {
  const store = await requireStoreManager(user);
  const actor = sessionUserId(user.id);
  const result = await db.execute(sql`
    with updated_deposit as (
      update customer_deposits deposit set status = 'collected', collected_at = now(), updated_at = now()
      where deposit.id = ${depositId} and deposit.store_id = ${store.id} and deposit.status = 'ready'
      and (select coalesce(sum(case when payment.payment_type = 'refund' then -payment.amount else payment.amount end), 0) from customer_deposit_payments payment where payment.deposit_id = deposit.id) >= deposit.total_value returning deposit.*
    ), reservation as (
      update store_stock_reservations stock set status = 'fulfilled', fulfilled_at = now() from updated_deposit deposit where stock.deposit_id = deposit.id and stock.status = 'active' returning stock.id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata) select 'customer-deposit', deposit.id, 'complete', ${actor}, jsonb_build_object('status', deposit.status), jsonb_build_object('reservationCount', (select count(*) from reservation)) from updated_deposit deposit
    ) select id from updated_deposit
  `);
  if (!result.rows.length) throw new HttpError(409, 'Deposit is not fully paid or has already been collected');
  return Number((result.rows[0] as { id: number | string }).id);
}

export async function requestDepositCancellation(user: AppUser, depositId: number, reason: string) {
  const store = await requireStoreManager(user);
  const actor = sessionUserId(user.id);
  const result = await db.execute(sql`
    with updated_deposit as (
      update customer_deposits set status = 'cancel-requested', cancellation_reason = ${reason}, cancellation_requested_at = now(), updated_at = now()
      where id = ${depositId} and store_id = ${store.id} and status in ('active', 'ready') returning *
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata) select 'customer-deposit', id, 'cancel', ${actor}, jsonb_build_object('status', status), jsonb_build_object('reason', ${reason}::text) from updated_deposit
    ) select id from updated_deposit
  `);
  if (!result.rows.length) throw new HttpError(409, 'Only an active deposit can be cancelled');
  return Number((result.rows[0] as { id: number | string }).id);
}

export type DecideDepositCancellationInput = {
  type: 'deposit';
  action: 'decide-cancellation';
  decision: 'refund' | 'forfeit' | 'store-credit';
  reason: string;
};

export async function decideDepositCancellation(user: AppUser, depositId: number, input: DecideDepositCancellationInput) {
  if (user.role !== 'finance') throw new HttpError(403, 'Only Finance can decide a deposit cancellation');
  const actor = sessionUserId(user.id);
  const result = await db.execute(sql`
    with deposit_balance as (
      select deposit.*, coalesce(sum(case when payment.payment_type = 'refund' then -payment.amount else payment.amount end), 0) as paid_value
      from customer_deposits deposit left join customer_deposit_payments payment on payment.deposit_id = deposit.id
      where deposit.id = ${depositId} and deposit.status = 'cancel-requested'
      group by deposit.id
    ), refund as (
      insert into customer_deposit_payments (deposit_id, store_id, business_date, payment_type, amount, reference, created_by_user_id)
      select deposit.id, deposit.store_id, current_date, 'refund', deposit.paid_value, 'Finance-approved deposit cancellation', ${actor} from deposit_balance deposit where ${input.decision} = 'refund' and deposit.paid_value > 0 returning id
    ), updated_deposit as (
      update customer_deposits deposit set status = case ${input.decision} when 'refund' then 'refunded' when 'forfeit' then 'forfeited' else 'store-credit' end, cancellation_decision = ${input.decision}, decision_reason = ${input.reason}, decided_by_user_id = ${actor}, decided_at = now(), updated_at = now()
      from deposit_balance balance where deposit.id = balance.id returning deposit.*
    ), reservation as (
      update store_stock_reservations stock set status = 'released', released_at = now() from updated_deposit deposit where stock.deposit_id = deposit.id and stock.status = 'active' returning stock.id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after, metadata) select 'customer-deposit', deposit.id, 'approve', ${actor}, jsonb_build_object('status', deposit.status, 'decision', deposit.cancellation_decision), jsonb_build_object('reason', ${input.reason}::text, 'refundPaymentId', (select id from refund), 'reservationId', (select id from reservation)) from updated_deposit deposit
    ) select id from updated_deposit
  `);
  if (!result.rows.length) throw new HttpError(409, 'This deposit is no longer awaiting Finance decision');
  return Number((result.rows[0] as { id: number | string }).id);
}
