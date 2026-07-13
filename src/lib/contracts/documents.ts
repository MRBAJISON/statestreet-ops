import { z } from 'zod';
import { dateSchema, moneySchema, positiveIdSchema } from './shared';

const optionalText = (max = 2000) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), z.string().trim().max(max).optional());
const optionalId = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  positiveIdSchema.optional()
);
const optionalMoney = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  moneySchema.optional()
);

function uniqueProducts(lines: Array<{ productId: number }>, context: z.RefinementCtx) {
  const productIds = new Set<number>();
  lines.forEach((line, index) => {
    if (productIds.has(line.productId)) {
      context.addIssue({ code: 'custom', path: ['lines', index, 'productId'], message: 'Product is already included' });
    }
    productIds.add(line.productId);
  });
}

export const stockTransferSchema = z
  .object({
    businessDate: dateSchema,
    fromStoreId: optionalId,
    toStoreId: positiveIdSchema,
    reason: z.string().trim().min(1).max(500),
    notes: optionalText(1000),
    lines: z.array(z.object({ productId: positiveIdSchema, quantity: z.number().int().positive().max(1_000_000) })).min(1).max(200),
  })
  .superRefine((value, context) => {
    if (value.fromStoreId === value.toStoreId) {
      context.addIssue({ code: 'custom', path: ['toStoreId'], message: 'Destination must differ from the source store' });
    }
    uniqueProducts(value.lines, context);
  });

export const goodsReceiptSchema = z
  .object({
    businessDate: dateSchema,
    poNumber: optionalText(120),
    supplierId: positiveIdSchema,
    receivingStoreId: positiveIdSchema,
    notes: optionalText(1000),
    lines: z
      .array(
        z.object({
          productId: positiveIdSchema,
          quantity: z.number().int().positive().max(1_000_000),
          unitCost: optionalMoney,
          condition: z.enum(['good', 'damaged', 'partial']).default('good'),
          discrepancy: optionalText(1000),
        })
      )
      .min(1)
      .max(500),
  })
  .superRefine((value, context) => uniqueProducts(value.lines, context));

export const stockCountSchema = z
  .object({
    businessDate: dateSchema,
    storeId: positiveIdSchema,
    notes: optionalText(1000),
    lines: z.array(z.object({ productId: positiveIdSchema, physicalQuantity: z.number().int().min(0).max(1_000_000) })).min(1).max(1000),
  })
  .superRefine((value, context) => uniqueProducts(value.lines, context));

export const replenishmentSchema = z
  .object({
    businessDate: dateSchema,
    storeId: optionalId,
    supplierId: optionalId,
    notes: optionalText(1000),
    lines: z
      .array(
        z.object({
          productId: positiveIdSchema,
          reorderQuantity: z.number().int().positive().max(1_000_000),
          urgency: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
        })
      )
      .min(1)
      .max(500),
  })
  .superRefine((value, context) => uniqueProducts(value.lines, context));

export const inventoryDocumentSchema = z.enum(['stock-transfer', 'goods-receipt', 'stock-count', 'replenishment']);
export type InventoryDocumentName = z.infer<typeof inventoryDocumentSchema>;

export interface InventoryDocumentLineRecord {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  quantity?: number;
  unitCost?: string | null;
  condition?: 'good' | 'damaged' | 'partial';
  discrepancy?: string | null;
  systemQuantity?: number;
  physicalQuantity?: number;
  currentStock?: number;
  reorderQuantity?: number;
  urgency?: 'low' | 'normal' | 'high' | 'critical';
}

export interface InventoryDocumentRecord {
  id: number;
  businessDate: string;
  status: string;
  fromStoreName?: string | null;
  toStoreName?: string | null;
  receivingStoreName?: string | null;
  storeName?: string | null;
  supplierName?: string | null;
  poNumber?: string | null;
  reason?: string | null;
  notes?: string | null;
  lineCount: number;
  totalQuantity: number;
  lines?: InventoryDocumentLineRecord[];
}

export interface InventoryDocumentsResponse {
  documents: InventoryDocumentRecord[];
}

export interface InventoryDocumentResponse {
  document: InventoryDocumentRecord;
}

export const inventoryDocumentDecisionSchema = z.object({
  action: z.enum(['authorize', 'dispatch', 'receive', 'approve', 'order', 'fulfill', 'reject', 'cancel']),
  reason: optionalText(1000),
});

export const weeklyReviewSchema = z
  .object({
    weekEnd: dateSchema,
    status: z.enum(['draft', 'submitted']).default('draft'),
    summary: optionalText(3000),
    risks: optionalText(3000),
    opportunities: optionalText(3000),
    marketingAmplifyCategoryId: optionalId,
    differentThisWeek: optionalText(3000),
    firstThreeActions: optionalText(3000),
    lockVersion: z.number().int().positive().optional(),
    categoryNotes: z
      .array(
        z.object({
          categoryId: positiveIdSchema,
          performanceComment: optionalText(1000),
          overstocked: z.boolean().default(false),
          slowMoving: z.boolean().default(false),
          weeksWithoutMovement: z.number().int().min(0).max(1000).optional(),
          valueAtRisk: optionalMoney,
          correctiveAction: optionalText(1000),
          managerComment: optionalText(1000),
        })
      )
      .max(200)
      .default([]),
    actions: z
      .array(
        z.object({
          categoryId: optionalId,
          productId: optionalId,
          action: z.string().trim().min(1).max(1000),
          ownerUserId: optionalId,
          ownerName: optionalText(160),
          targetUnits: z.number().int().min(0).max(1_000_000).optional(),
          targetRevenue: optionalMoney,
          dueDate: z.preprocess((value) => (value === '' || value === null ? undefined : value), dateSchema.optional()),
          status: z.enum(['open', 'in-progress', 'completed', 'cancelled']).default('open'),
          managerComment: optionalText(1000),
        })
      )
      .max(100)
      .default([]),
  })
  .superRefine((value, context) => {
    const categoryIds = new Set<number>();
    value.categoryNotes.forEach((note, index) => {
      if (categoryIds.has(note.categoryId)) {
        context.addIssue({ code: 'custom', path: ['categoryNotes', index, 'categoryId'], message: 'Category is already included' });
      }
      categoryIds.add(note.categoryId);
    });
    value.actions.forEach((action, index) => {
      if (!action.ownerUserId && !action.ownerName) {
        context.addIssue({ code: 'custom', path: ['actions', index, 'ownerUserId'], message: 'Action owner is required' });
      }
    });
  });

export interface WeeklyReviewCategoryNoteRecord {
  id: number;
  categoryId: number;
  performanceComment: string | null;
  overstocked: boolean;
  slowMoving: boolean;
  weeksWithoutMovement: number | null;
  valueAtRisk: string | null;
  correctiveAction: string | null;
  managerComment: string | null;
}

export interface WeeklyReviewActionRecord {
  id: number;
  categoryId: number | null;
  productId: number | null;
  action: string;
  ownerUserId: number | null;
  ownerName: string | null;
  targetUnits: number | null;
  targetRevenue: string | null;
  dueDate: string | null;
  status: string;
  managerComment: string | null;
}

export interface WeeklyReviewRecord {
  id: number;
  storeId: number;
  storeName: string;
  weekEnd: string;
  status: 'draft' | 'submitted' | 'approved';
  summary: string | null;
  risks: string | null;
  opportunities: string | null;
  marketingAmplifyCategoryId: number | null;
  differentThisWeek: string | null;
  firstThreeActions: string | null;
  lockVersion: number;
  updatedAt: string;
  categoryNotes: WeeklyReviewCategoryNoteRecord[];
  actions: WeeklyReviewActionRecord[];
}
