import { z } from 'zod';
import { moneySchema, positiveIdSchema } from './shared';

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const optionalProductMoney = z.preprocess(
  (value) => value === '' ? null : value,
  z.union([moneySchema, z.null()]).optional()
);

// The SKU is the barcode: one number identifies the product on the shelf and in
// the system, so it is captured once and written to both columns rather than
// asking anyone to keep two numbers in step.
export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(100).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(200),
  description: optionalText(2000),
  brandId: positiveIdSchema,
  categoryId: positiveIdSchema,
  subcategoryId: positiveIdSchema.optional().nullable(),
  size: optionalText(100),
  color: optionalText(100),
  unitCost: optionalProductMoney,
  sellingPrice: optionalProductMoney,
  // Opening quantity for one store. Products are stocked per store, so a quantity
  // is meaningless without saying which store holds it.
  storeId: positiveIdSchema.optional().nullable(),
  quantity: z.number().int().min(0).max(10_000_000).optional().nullable(),
});

export const updateProductSchema = createProductSchema
  .partial()
  .extend({
    active: z.boolean().optional(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .refine((input) => Object.entries(input).some(([key, value]) => key !== 'expectedUpdatedAt' && value !== undefined), {
    message: 'At least one product field must be updated',
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
