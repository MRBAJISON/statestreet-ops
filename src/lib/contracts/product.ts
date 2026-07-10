import { z } from 'zod';
import { optionalMoneySchema, positiveIdSchema } from './shared';

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(100).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(200),
  description: optionalText(2000),
  brandId: positiveIdSchema,
  categoryId: positiveIdSchema,
  subcategoryId: positiveIdSchema.optional().nullable(),
  size: optionalText(100),
  color: optionalText(100),
  unitCost: optionalMoneySchema,
  sellingPrice: optionalMoneySchema,
});

export const updateProductSchema = createProductSchema.partial().extend({
  active: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
