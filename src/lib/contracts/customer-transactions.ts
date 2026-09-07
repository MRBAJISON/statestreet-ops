import { z } from 'zod';
import { dateSchema, moneySchema, optionalMoneySchema, positiveIdSchema } from './shared';

const optionalText = (max: number) => z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().trim().max(max).optional()
);

const condition = z.boolean();
const optionalIdSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null) return undefined;
    if (typeof value === 'string') return Number(value);
    return value;
  },
  positiveIdSchema.optional()
);
const requiredIdSchema = z.preprocess(
  (value) => (typeof value === 'string' ? Number(value) : value),
  positiveIdSchema
);

export const creditNoteItemSchema = z.object({
  productId: optionalIdSchema,
  productName: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(100_000),
  originalValue: moneySchema,
  unitPrice: optionalMoneySchema,
  unwornUnused: condition,
  originalTagsAttached: condition,
  originalPackaging: condition,
  inspectedApproved: condition,
});

export const createCreditNoteSchema = z.object({
  type: z.literal('credit-note'),
  businessDate: dateSchema,
  storeId: optionalIdSchema,
  customerName: z.string().trim().min(1).max(160),
  customerPhone: optionalText(40),
  originalReceiptNumber: optionalText(120),
  originalPurchaseDate: dateSchema.optional(),
  reason: z.string().trim().min(1).max(1000),
  requestedValue: optionalMoneySchema,
  items: z.array(creditNoteItemSchema).min(1).max(50),
});

export const decideCreditNoteSchema = z.object({
  type: z.literal('credit-note'),
  action: z.enum(['approve', 'reject']),
  approvedValue: optionalMoneySchema,
  reason: optionalText(1000),
});

export const redeemCreditNoteSchema = z.object({
  type: z.literal('credit-note'),
  action: z.literal('redeem'),
  businessDate: dateSchema,
  replacementProductId: optionalIdSchema,
  replacementDescription: optionalText(200),
  replacementValue: moneySchema,
  paymentMethodId: optionalIdSchema,
}).refine((value) => Boolean(value.replacementProductId || value.replacementDescription), {
  path: ['replacementDescription'],
  message: 'Select a replacement product or describe it',
});

export const inventoryCreditDecisionSchema = z.object({
  type: z.literal('credit-note'),
  action: z.literal('inventory-decision'),
  itemId: positiveIdSchema,
  decision: z.enum(['restock', 'reject']),
  reason: z.string().trim().min(1).max(1000),
});

export const createDepositSchema = z.object({
  type: z.literal('deposit'),
  businessDate: dateSchema,
  storeId: optionalIdSchema,
  customerName: z.string().trim().min(1).max(160),
  customerPhone: optionalText(40),
  items: z.array(z.object({
    productId: requiredIdSchema,
    quantity: z.number().int().positive().max(100_000),
  })).min(1).max(50),
  initialPayment: moneySchema,
  paymentMethodId: optionalIdSchema,
  reference: optionalText(120),
  expectedCollectionDate: dateSchema.optional(),
}).superRefine((value, ctx) => {
  if (Number(value.initialPayment) < 0) {
    ctx.addIssue({ code: 'custom', path: ['initialPayment'], message: 'Initial payment cannot be negative' });
  }
  if (Number(value.initialPayment) > 0 && !value.paymentMethodId) {
    ctx.addIssue({ code: 'custom', path: ['paymentMethodId'], message: 'Select a payment method for the amount received' });
  }
  const productIds = new Set(value.items.map((item) => item.productId));
  if (productIds.size !== value.items.length) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Each product can appear only once per deposit' });
  }
});

export const depositPaymentSchema = z.object({
  type: z.literal('deposit'),
  action: z.literal('payment'),
  businessDate: dateSchema,
  amount: moneySchema,
  paymentMethodId: optionalIdSchema,
  reference: optionalText(120),
});

export const collectDepositSchema = z.object({
  type: z.literal('deposit'),
  action: z.literal('collect'),
});

export const requestDepositCancellationSchema = z.object({
  type: z.literal('deposit'),
  action: z.literal('request-cancellation'),
  reason: z.string().trim().min(1).max(1000),
});

export const decideDepositCancellationSchema = z.object({
  type: z.literal('deposit'),
  action: z.literal('decide-cancellation'),
  decision: z.enum(['refund', 'forfeit', 'store-credit']),
  reason: z.string().trim().min(1).max(1000),
});

export const customerTransactionInputSchema = z.discriminatedUnion('type', [
  createCreditNoteSchema,
  createDepositSchema,
]);

export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
export type DecideCreditNoteInput = z.infer<typeof decideCreditNoteSchema>;
export type RedeemCreditNoteInput = z.infer<typeof redeemCreditNoteSchema>;
export type InventoryCreditDecisionInput = z.infer<typeof inventoryCreditDecisionSchema>;
export type CreateDepositInput = z.infer<typeof createDepositSchema>;
export type DepositPaymentInput = z.infer<typeof depositPaymentSchema>;
export type CustomerTransactionInput = z.infer<typeof customerTransactionInputSchema>;
