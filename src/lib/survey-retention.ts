import { sql } from 'drizzle-orm';

export async function redactExpiredSurveyContacts(): Promise<number> {
  const { db } = await import('./db');
  const result = await db.execute(sql`
    select public.redact_expired_customer_feedback_contacts() as redacted_count
  `);
  return Number(
    (result.rows[0] as { redacted_count?: number | string } | undefined)?.redacted_count ?? 0
  );
}
