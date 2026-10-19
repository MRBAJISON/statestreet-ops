import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { AppUser } from './auth';
import { testDatabaseUrl } from './test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const describeDb = databaseUrl ? describe : describe.skip;
const period = { periodStart: '2026-10-01', periodEnd: '2026-10-07' };
const social = { ...period, platform: 'Instagram', follows: 20, profileActivity: 80, followers: 1000, posts: 4, reach: 500, engagement: 50, reels: 0, stories: 0, impressions: 1000, clicks: 10, websiteVisits: 5 };
const clienteling = { ...period, type: 'Calls', contacted: 20, responses: 10, appointments: 5, estimatedRevenue: '300' };

describeDb('marketing reporting periods', () => {
  const client = new Client({ connectionString: databaseUrl });
  let user: AppUser;
  let brandId: number;
  let storeId: number;
  let executeWorkflow: typeof import('./workflow-mutations').executeWorkflow;
  const campaign = () => ({ ...period, name: 'Autumn', brandId, platform: 'Instagram', spend: '100', revenueInfluenced: '400', status: 'active', reach: 700, engagement: 60, storeVisits: 10 });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_DRIVER = 'node-postgres';
    await client.connect();
    await client.query('truncate table users, stores, brands, categories restart identity cascade');
    const actor = await client.query("insert into users (name,email,password_hash,role,department) values ('Period test','period-test@example.com','unused','marketing','marketing') returning id");
    user = { id: String(actor.rows[0].id), name: 'Period test', email: 'period-test@example.com', role: 'marketing', department: 'marketing' };
    brandId = Number((await client.query("insert into brands(code,name) values ('period-brand','Period brand') returning id")).rows[0].id);
    storeId = Number((await client.query("insert into stores(code,name,type) values ('period-store','Period store','store') returning id")).rows[0].id);
    ({ executeWorkflow } = await import('./workflow-mutations'));
    await import('./reporting/marketing');
    await import('./export');
  }, 60000);
  beforeEach(async () => { await client.query('truncate table marketing_campaign_reports, social_metrics, clienteling_activities, audit_events restart identity cascade'); });
  afterAll(async () => { await client.end(); });

  it('supports legacy daily inserts with original counts and timestamps', async () => {
    const queries = [
      { query: "insert into marketing_campaign_reports(business_date,name,brand_id,platform,spend,status,created_by_user_id,updated_by_user_id) values ('2026-10-15','Legacy',$1,'Instagram',100,'active',$2,$2)", args: [brandId, Number(user.id)] },
      { query: "insert into social_metrics(business_date,platform,followers,created_by_user_id,updated_by_user_id) values ('2026-10-15','Instagram',1000,$1,$1)", args: [Number(user.id)] },
      { query: "insert into clienteling_activities(business_date,type,contacted,created_by_user_id,updated_by_user_id) values ('2026-10-15','Calls',20,$1,$1)", args: [Number(user.id)] },
    ];
    for (const { query, args } of queries) {
      const result = await client.query(`${query} returning business_date::text, period_start::text, period_end::text`, args);
      expect(result.rows[0]).toEqual({ business_date: '2026-10-15', period_start: '2026-10-15', period_end: '2026-10-15' });
    }
  });

  it('saves full ranges and audits exact-range social/clienteling corrections without duplicating', async () => {
    for (const [name, input, entity] of [
      ['social-metric', social, 'social-metric'],
      ['clienteling', clienteling, 'clienteling-activity'],
    ] as const) {
      const record = await executeWorkflow(name, user, input);
      expect(record).toMatchObject({ period_start: period.periodStart, period_end: period.periodEnd });
      const corrected = await executeWorkflow(name, user, { ...input, followers: 1100, contacted: 25 });
      expect(corrected.id).toBe(record.id);
      const audit = await client.query('select action from audit_events where entity_type=$1 order by id', [entity]);
      expect(audit.rows.map((row) => row.action)).toEqual(['create', 'update']);
      await expect(executeWorkflow(name, user, { ...input, periodEnd: '2026-10-08' })).rejects.toMatchObject({ status: 409 });
    }
  });

  it('rejects normalized overlaps including boundary dates, and permits adjacent periods/different scopes', async () => {
    for (const [name, input, normalized] of [
      ['campaign', campaign(), { name: ' AUTUMN ', platform: ' INSTAGRAM ' }],
      ['social-metric', social, { platform: ' INSTAGRAM ' }],
      ['clienteling', clienteling, { type: ' CALLS ' }],
    ] as const) {
      await executeWorkflow(name, user, input);
      await expect(executeWorkflow(name, user, { ...input, ...normalized, periodStart: '2026-10-07', periodEnd: '2026-10-10' })).rejects.toMatchObject({ status: 409 });
      await executeWorkflow(name, user, { ...input, periodStart: '2026-10-08', periodEnd: '2026-10-14' });
    }
    await executeWorkflow('campaign', user, { ...campaign(), name: 'Different campaign' });
    await executeWorkflow('social-metric', user, { ...social, brandId });
    await executeWorkflow('clienteling', user, { ...clienteling, storeId });
  });

  it('serializes concurrent partially overlapping writes for all three forms', async () => {
    await client.query(`create function test_delay_marketing() returns trigger language plpgsql as $$ begin perform pg_sleep(0.2); return new; end $$`);
    const cases = [ ['campaign', campaign(), 'marketing_campaign_reports'], ['social-metric', social, 'social_metrics'], ['clienteling', clienteling, 'clienteling_activities'] ] as const;
    try {
      for (const [name, input, table] of cases) {
        await client.query(`create trigger zz_test_delay_marketing before insert on ${table} for each row execute function test_delay_marketing()`);
        const results = await Promise.allSettled([
          executeWorkflow(name, user, input),
          executeWorkflow(name, user, { ...input, periodStart: '2026-10-05', periodEnd: '2026-10-10' }),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
        expect((await client.query(`select count(*)::int as count from ${table}`)).rows[0].count).toBe(1);
      }
    } finally { await client.query('drop function test_delay_marketing() cascade'); }
  }, 20000);

  it('excludes partial periods from totals and exports; followers use only completed snapshots', async () => {
    const { getMarketingDomain } = await import('./reporting/marketing');
    const { loadTypedExportRows } = await import('./export');
    for (const [name, input] of [['campaign', campaign()], ['social-metric', social], ['clienteling', { ...clienteling, storeId }]] as const) {
      await executeWorkflow(name, user, input);
      await executeWorkflow(name, user, { ...input, periodStart: '2026-10-08', periodEnd: '2026-10-14', followers: 1100 });
    }
    await executeWorkflow('social-metric', user, { ...social, periodStart: '2026-10-15', periodEnd: '2026-10-21', followers: 9000 });
    const scope = { preset: 'custom' as const, from: '2026-10-05', to: '2026-10-16', compareFrom: '2026-09-23', compareTo: '2026-10-04', store: null };
    const domain = await getMarketingDomain(scope);
    expect(domain.summary).toMatchObject({ spend: 100, influencedRevenue: 400 });
    expect(domain.campaigns).toHaveLength(1);
    expect(domain.contentCadence.posts).toBe(4);
    expect(domain.social[0]).toMatchObject({ followers: 1100, reach: 500, follows: 20, profileActivity: 80 });
    expect(domain.clienteling[0]).toMatchObject({ contacted: 20, revenue: 300 });
    expect(domain.partialMarketingSummaries).toHaveLength(4);
    const rows = await loadTypedExportRows({ scope: 'marketing', range: scope, includeCustomerContacts: false, includeUnitCost: false });
    for (const key of ['campaigns', 'socialMetrics', 'clienteling'] as const) expect(rows[key]).toHaveLength(1);
    expect(rows.partialCampaigns).toHaveLength(1);
    expect(rows.partialSocialMetrics).toHaveLength(2);
    expect(rows.partialClienteling).toHaveLength(1);
    const full = await getMarketingDomain({ ...scope, from: '2026-10-01', to: '2026-10-31' });
    expect(full.summary.spend).toBe(200);
    expect(full.partialMarketingSummaries).toEqual([]);
    expect(full.social[0].followers).toBe(9000); // Latest balance, never 11,100 summed followers.
    expect(full.social[0]).toMatchObject({ follows: 60, profileActivity: 240 });
  }, 60000);

  it('persists optional blanks as unknown, preserves known audience history and exports new metrics', async () => {
    await executeWorkflow('social-metric', user, social);
    const minimal = { periodStart: '2026-10-08', periodEnd: '2026-10-14', platform: 'Instagram', impressions: 500, reach: 250, follows: 0, profileActivity: 10, engagement: 15 };
    const saved = await executeWorkflow('social-metric', user, minimal);
    expect(saved).toMatchObject({ follows: 0, profile_activity: 10, followers: null, posts: null, reels: null, stories: null, clicks: null, website_visits: null });
    const { getMarketingDomain } = await import('./reporting/marketing');
    const { loadTypedExportRows } = await import('./export');
    const scope = { preset: 'custom' as const, from: '2026-10-01', to: '2026-10-31', compareFrom: '2026-09-01', compareTo: '2026-09-30', store: null };
    const domain = await getMarketingDomain(scope);
    expect(domain.social[0]).toMatchObject({ followers: 1000, follows: 20, profileActivity: 90, clicks: null, websiteVisits: null, impressions: 1500, reach: 750, engagement: 65 });
    expect(domain.contentCadence).toEqual({ posts: null, reels: null, stories: null });
    const rows = await loadTypedExportRows({ scope: 'marketing', range: scope, includeCustomerContacts: false, includeUnitCost: false });
    expect(rows.socialMetrics?.[1]).toMatchObject({ follows: 0, profileActivity: 10, followers: null, posts: null, clicks: null });

    // Explicit zero is known, and saving the same period corrects rather than duplicates.
    const corrected = await executeWorkflow('social-metric', user, { ...minimal, followers: 0, posts: 0, reels: 0, stories: 0, clicks: 0, websiteVisits: 0 });
    expect(corrected.id).toBe(saved.id);
    const complete = await getMarketingDomain(scope);
    expect(complete.social[0]).toMatchObject({ followers: 0, clicks: 10, websiteVisits: 5 });
    expect(complete.contentCadence).toEqual({ posts: 4, reels: 0, stories: 0 });
  }, 60000);

  it('does not fabricate new metrics for legacy rows or report a partial sum as a complete total', async () => {
    await client.query("insert into social_metrics(business_date,platform,followers,created_by_user_id,updated_by_user_id) values ('2026-10-01','Instagram',1000,$1,$1)", [Number(user.id)]);
    await executeWorkflow('social-metric', user, { ...social, periodStart: '2026-10-08', periodEnd: '2026-10-14' });
    const { getMarketingDomain } = await import('./reporting/marketing');
    const scope = { preset: 'custom' as const, from: '2026-10-01', to: '2026-10-31', compareFrom: '2026-09-01', compareTo: '2026-09-30', store: null };
    expect((await getMarketingDomain(scope)).social[0]).toMatchObject({ follows: null, profileActivity: null, followers: 1000 });
    await expect(client.query("update social_metrics set follows=-1 where business_date='2026-10-01'")).rejects.toMatchObject({ code: '23514' });
    await expect(client.query("update social_metrics set profile_activity=-1 where business_date='2026-10-01'")).rejects.toMatchObject({ code: '23514' });
    await expect(client.query("update social_metrics set posts=-1 where business_date='2026-10-01'")).rejects.toMatchObject({ code: '23514' });
  });

  it('retains store filtering for clienteling and role restrictions for writes', async () => {
    await executeWorkflow('clienteling', user, { ...clienteling, storeId });
    await executeWorkflow('clienteling', user, clienteling); // Group, not a store entry.
    const { getMarketingDomain } = await import('./reporting/marketing');
    const scope = { preset: 'custom' as const, from: '2026-10-01', to: '2026-10-31', compareFrom: '2026-09-01', compareTo: '2026-09-30', store: { id: storeId, code: 'period-store', name: 'Period store' } };
    expect((await getMarketingDomain(scope)).clienteling[0].contacted).toBe(20);
    for (const role of ['owner', 'finance', 'commercial', 'inventory', 'brand', 'store-manager'] as const) {
      for (const [name, input] of [['campaign', campaign()], ['social-metric', social], ['clienteling', clienteling]] as const) {
        await expect(executeWorkflow(name, { ...user, role }, input)).rejects.toMatchObject({ status: 403 });
      }
    }
    await executeWorkflow('campaign', { ...user, role: 'operations' }, campaign());
  });
});
