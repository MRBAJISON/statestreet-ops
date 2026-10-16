import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { AppUser } from './auth';
import { testDatabaseUrl } from './test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const describeDb = databaseUrl ? describe : describe.skip;
const input = { periodStart: '2026-10-01', periodEnd: '2026-10-07', channel: 'Instagram', leadCount: 30, qualifiedCount: 20, convertedCount: 10 };

describeDb('lead periods, corrections and reporting', () => {
  const client = new Client({ connectionString: databaseUrl });
  let user: AppUser;
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_DRIVER = 'node-postgres';
    await client.connect();
    await client.query('truncate table users, stores, brands, categories restart identity cascade');
    const result = await client.query("insert into users (name,email,password_hash,role,department) values ('Lead test','lead-test@example.com','unused','marketing','marketing') returning id");
    user = { id: String(result.rows[0].id), name: 'Lead test', email: 'lead-test@example.com', role: 'marketing', department: 'marketing' };
    await import('./workflow-mutations');
    await import('./reporting/marketing');
    await import('./export');
  }, 60000);
  afterAll(async () => { await client.end(); });

  it('supports legacy single-day writes without changing their counts', async () => {
    const result = await client.query("insert into lead_metrics (business_date,channel,lead_count,created_by_user_id,updated_by_user_id) values ('2026-10-15','Legacy',12,$1,$1) returning period_start::text,period_end::text,lead_count", [Number(user.id)]);
    expect(result.rows[0]).toEqual({ period_start: '2026-10-15', period_end: '2026-10-15', lead_count: 12 });
  });

  it('blocks normalized-channel overlaps including shared boundary dates, but allows adjacent periods', async () => {
    const { executeWorkflow } = await import('./workflow-mutations');
    await executeWorkflow('lead-metric', user, input);
    await expect(executeWorkflow('lead-metric', user, { ...input, channel: '  INSTAGRAM ', periodStart: '2026-10-07', periodEnd: '2026-10-10' })).rejects.toMatchObject({ status: 409 });
    await executeWorkflow('lead-metric', user, { ...input, periodStart: '2026-10-08', periodEnd: '2026-10-14' });
  });

  it('serializes simultaneous overlapping inserts at the database boundary', async () => {
    const { executeWorkflow } = await import('./workflow-mutations');
    await client.query(`create function test_delay_lead() returns trigger language plpgsql as $$ begin perform pg_sleep(0.2); return new; end $$;
      create trigger zz_test_delay_lead before insert on lead_metrics for each row execute function test_delay_lead();`);
    try {
      const results = await Promise.allSettled([1, 2].map(() => executeWorkflow('lead-metric', user, { ...input, channel: 'Concurrent' })));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const count = await client.query("select count(*)::integer as count from lead_metrics where channel='Concurrent'");
      expect(count.rows[0].count).toBe(1);
    } finally { await client.query('drop trigger zz_test_delay_lead on lead_metrics; drop function test_delay_lead()'); }
  });

  it('audits corrections and rejects stale edits without another audit', async () => {
    const { executeWorkflow } = await import('./workflow-mutations');
    const { updateLeadMetric, listLeadMetrics } = await import('./lead-metrics');
    const record = await executeWorkflow('lead-metric', user, { ...input, channel: 'Corrections' });
    const id = Number(record.id);
    const body = { summary: { ...input, channel: 'Corrections', leadCount: 35 }, lockVersion: 1, reason: 'Recounted leads' };
    await updateLeadMetric(user, id, body);
    await expect(updateLeadMetric(user, id, body)).rejects.toMatchObject({ status: 409 });
    const audit = await client.query("select before->>'lead_count' as before, after->>'lead_count' as after, metadata->>'reason' as reason from audit_events where entity_type='lead-metric' and entity_id=$1 and action='update'", [id]);
    expect(audit.rows).toEqual([{ before: '30', after: '35', reason: 'Recounted leads' }]);
    expect((await listLeadMetrics(user, 1)).records.find((row) => row.id === id)?.lockVersion).toBe(2);
    await expect(updateLeadMetric(user, 999999, body)).rejects.toMatchObject({ status: 404 });
  });

  it('denies non-writers while retaining Operations access', async () => {
    const { executeWorkflow } = await import('./workflow-mutations');
    const { listLeadMetrics, updateLeadMetric } = await import('./lead-metrics');
    for (const role of ['owner', 'finance', 'commercial', 'inventory', 'brand', 'store-manager'] as const) {
      const denied = { ...user, role };
      await expect(executeWorkflow('lead-metric', denied, input)).rejects.toMatchObject({ status: 403 });
      await expect(listLeadMetrics(denied, 1)).rejects.toMatchObject({ status: 403 });
      await expect(updateLeadMetric(denied, 1, {})).rejects.toMatchObject({ status: 403 });
    }
    expect((await listLeadMetrics({ ...user, role: 'operations' }, 1)).records.length).toBeGreaterThan(0);
  });

  it('excludes partial periods from dashboard and export totals without daily proration', async () => {
    const { getMarketingDomain } = await import('./reporting/marketing');
    const { loadTypedExportRows } = await import('./export');
    const scope = { preset: 'custom' as const, from: '2026-10-05', to: '2026-10-15', compareFrom: '2026-09-24', compareTo: '2026-10-04', store: null };
    const domain = await getMarketingDomain(scope);
    expect(domain.summary.leads).toBe(42); // 8–14 October + legacy 15 October only.
    expect(domain.summary.qualified).toBe(20);
    expect(domain.partialLeadSummaries).toHaveLength(3);
    expect(domain.partialLeadSummaries.every((row) => row.periodStart === '2026-10-01')).toBe(true);
    const rows = await loadTypedExportRows({ scope: 'marketing', range: scope, includeCustomerContacts: false, includeUnitCost: false });
    expect(rows.leadMetrics?.reduce((total, row) => total + Number(row.leadCount), 0)).toBe(42);
    expect(rows.partialLeadMetrics).toHaveLength(3);
    expect((await getMarketingDomain({ ...scope, from: '2026-10-01', to: '2026-10-31' })).partialLeadSummaries).toEqual([]);
  }, 60000);
});
