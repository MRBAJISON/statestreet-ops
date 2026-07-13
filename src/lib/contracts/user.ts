import { z } from 'zod';
import { DEPARTMENTS, USER_ROLES } from '../access';

const nameSchema = z.string().trim().min(2).max(120);
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(6).max(256);
const storeSchema = z.string().trim().max(100).nullable().optional();

export const createUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(USER_ROLES),
    department: z.enum(DEPARTMENTS).optional(),
    store: storeSchema,
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    role: z.enum(USER_ROLES).optional(),
    department: z.enum(DEPARTMENTS).optional(),
    store: storeSchema,
    active: z.boolean().optional(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((input) => Object.entries(input).some(([key, value]) => key !== 'expectedUpdatedAt' && value !== undefined), {
    message: 'At least one account field must be updated',
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
