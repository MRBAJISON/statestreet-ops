import { z } from 'zod';

const MONEY_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const positiveIdSchema = z.number().int().positive();

export const moneySchema = z
  .string()
  .trim()
  .regex(MONEY_PATTERN, 'Use a non-negative amount with no more than two decimal places')
  .transform((value) => {
    const [whole, fraction = ''] = value.split('.');
    return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
  });

export const optionalMoneySchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  moneySchema.optional()
);

export const dateSchema = z.string().regex(DATE_PATTERN, 'Use a date in YYYY-MM-DD format').refine((value) => {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}, 'Use a valid calendar date');

export function moneyToCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
}

export function formatContractError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length ? issue.path.join('.') : 'request'}: ${issue.message}`)
    .join('; ');
}
