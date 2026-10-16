import { asc, desc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { AppUser } from './auth';
import { insertAuditedRecord } from './audited-mutations';
import { leadMetricUpdateSchema, type LeadMetricPage } from './contracts/lead-metrics';
import { formatContractError } from './contracts/shared';
import type { leadMetricSchema } from './contracts/workflows';
import { db } from './db';
import { leadMetrics } from './db/operational-schema';
import { HttpError, sessionUserId } from './server-errors';

export function requireLeadMetricWriter(user: AppUser) {
  if (user.role !== 'marketing' && user.role !== 'operations') throw new HttpError(403, 'Lead summaries are managed by Marketing and Operations');
}

function rethrowLeadError(error: unknown): never {
  // Drizzle wraps database errors in cause; never expose SQL or parameters.
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const detail = current as { code?: string; cause?: unknown };
    if (detail.code === '23P01') throw new HttpError(409, 'This channel already has a summary overlapping these dates. Open Saved summaries and edit the existing entry, or choose a non-overlapping period.');
    if (detail.code === '23503') throw new HttpError(400, 'The selected campaign no longer exists');
    if (detail.code === '23514') throw new HttpError(400, 'Check the date range and lead counts');
    current = detail.cause;
  }
  throw error;
}

export async function createLeadMetric(user: AppUser, input: z.infer<typeof leadMetricSchema>) {
  requireLeadMetricWriter(user);
  const actor = sessionUserId(user.id);
  try {
    return await insertAuditedRecord({
      table: 'lead_metrics', entityType: 'lead-metric', actorUserId: actor,
      values: {
        business_date: input.periodStart, period_start: input.periodStart, period_end: input.periodEnd,
        channel: input.channel, campaign_report_id: input.campaignReportId ?? null,
        lead_count: input.leadCount, qualified_count: input.qualifiedCount, converted_count: input.convertedCount,
        average_value: input.averageValue ?? null, notes: input.notes ?? null,
        created_by_user_id: actor, updated_by_user_id: actor,
      },
    });
  } catch (error) { rethrowLeadError(error); }
}

export async function listLeadMetrics(user: AppUser, page: number): Promise<LeadMetricPage> {
  requireLeadMetricWriter(user);
  const pageSize = 10;
  const [records, totals] = await Promise.all([
    db.select({
      id: leadMetrics.id, periodStart: leadMetrics.periodStart, periodEnd: leadMetrics.periodEnd,
      channel: leadMetrics.channel, campaignReportId: leadMetrics.campaignReportId,
      leadCount: leadMetrics.leadCount, qualifiedCount: leadMetrics.qualifiedCount, convertedCount: leadMetrics.convertedCount,
      averageValue: leadMetrics.averageValue, notes: leadMetrics.notes, lockVersion: leadMetrics.lockVersion,
    }).from(leadMetrics).orderBy(desc(leadMetrics.periodStart), asc(leadMetrics.channel), desc(leadMetrics.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::integer` }).from(leadMetrics),
  ]);
  return { records, page, totalPages: Math.max(1, Math.ceil(totals[0].count / pageSize)) };
}

export async function updateLeadMetric(user: AppUser, id: number, body: unknown) {
  requireLeadMetricWriter(user);
  const parsed = leadMetricUpdateSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, formatContractError(parsed.error));
  const { summary: input, lockVersion, reason } = parsed.data;
  const actor = sessionUserId(user.id);
  try {
    const result = await db.execute(sql`
      with before_record as materialized (
        select * from lead_metrics where id = ${id} for update
      ), updated as (
        update lead_metrics target set
          business_date = ${input.periodStart}, period_start = ${input.periodStart}, period_end = ${input.periodEnd},
          channel = ${input.channel}, campaign_report_id = ${input.campaignReportId ?? null},
          lead_count = ${input.leadCount}, qualified_count = ${input.qualifiedCount}, converted_count = ${input.convertedCount},
          average_value = ${input.averageValue ?? null}, notes = ${input.notes ?? null},
          updated_by_user_id = ${actor}, updated_at = now(), lock_version = target.lock_version + 1
        from before_record
        where target.id = before_record.id and before_record.lock_version = ${lockVersion}
        returning target.*
      ), audit as (
        insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
        select 'lead-metric', updated.id, 'update', ${actor}, to_jsonb(before_record), to_jsonb(updated),
               jsonb_build_object('reason', ${reason}::text)
        from updated join before_record on before_record.id = updated.id
      ) select to_jsonb(updated) as record from updated
    `);
    const record = result.rows[0]?.record;
    if (!record) {
      const [exists] = await db.select({ id: leadMetrics.id }).from(leadMetrics).where(eq(leadMetrics.id, id));
      throw new HttpError(exists ? 409 : 404, exists ? 'This summary changed since you opened it. Reload Saved summaries and reopen it before saving.' : 'Summary not found');
    }
    return record;
  } catch (error) { rethrowLeadError(error); }
}
