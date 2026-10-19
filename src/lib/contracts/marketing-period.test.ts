import { describe, expect, it } from 'vitest';
import { campaignSchema, clientelingSchema, feedbackSchema, socialMetricSchema } from './workflows';
import { marketingWorkflows } from '@/components/forms/workflow-definitions';
import { buildWorkflowPayload } from '@/components/forms/workflow-payload';

const period = { periodStart: '2026-10-01', periodEnd: '2026-10-07' };
const cases = [
  { id: 'campaign', schema: campaignSchema, values: { name: 'Autumn', brandId: 1, platform: 'Instagram', spend: '50', revenueInfluenced: '200', status: 'active', reach: 100, engagement: 20, storeVisits: 10 } },
  { id: 'social-metric', schema: socialMetricSchema, values: { platform: 'Instagram', follows: 8, profileActivity: 12, followers: 100, posts: 4, reels: 0, stories: 0, reach: 50, impressions: 100, engagement: 10, clicks: 5, websiteVisits: 2 } },
  { id: 'clienteling', schema: clientelingSchema, values: { type: 'Calls', contacted: 10, responses: 5, appointments: 2, estimatedRevenue: '200' } },
] as const;

describe.each(cases)('$id reporting dates', ({ id, schema, values }) => {
  it('accepts an inclusive date range and a single day', () => {
    expect(schema.safeParse({ ...period, ...values }).success).toBe(true);
    expect(schema.safeParse({ ...period, ...values, periodEnd: period.periodStart }).success).toBe(true);
  });
  it('rejects missing, reversed, impossible and cross-month dates', () => {
    for (const dates of [
      { businessDate: period.periodStart },
      { periodStart: period.periodStart },
      { ...period, periodEnd: '2026-09-30' },
      { ...period, periodEnd: '2026-11-01' },
      { periodStart: '2026-02-30', periodEnd: '2026-02-30' },
    ]) expect(schema.safeParse({ ...values, ...dates }).success).toBe(false);
  });
  it('renders and sends both required dates instead of businessDate', () => {
    const definition = marketingWorkflows.find((workflow) => workflow.id === id)!;
    expect(definition.fields.filter((field) => ['periodStart', 'periodEnd'].includes(field.name)))
      .toMatchObject([{ type: 'date', required: true }, { type: 'date', required: true }]);
    expect(definition.fields.some((field) => field.name === 'businessDate')).toBe(false);
    expect(buildWorkflowPayload(definition, period)).toMatchObject(period);
  });
});

it('keeps clienteling funnel validation', () => {
  expect(clientelingSchema.safeParse({ ...period, type: 'Calls', contacted: 2, responses: 3, appointments: 1, estimatedRevenue: '0' }).success).toBe(false);
});

it('keeps individual feedback dates and action deadlines', () => {
  const fields = marketingWorkflows.find((workflow) => workflow.id === 'feedback')!.fields;
  expect(fields.filter((field) => field.type === 'date' && field.name !== 'retentionUntil'))
    .toMatchObject([{ name: 'businessDate', label: 'Date received', required: true }]);
  expect(fields.some((field) => ['periodStart', 'periodEnd'].includes(field.name))).toBe(false);
  const feedback = { source: 'In-store', type: 'Praise', detail: 'Helpful service', npsScore: 9 };
  expect(feedbackSchema.safeParse({ ...feedback, businessDate: period.periodStart }).success).toBe(true);
  expect(feedbackSchema.safeParse({ ...feedback, ...period }).success).toBe(false);
  expect(marketingWorkflows.find((workflow) => workflow.id === 'action')?.fields.some((field) => field.name === 'dueDate')).toBe(true);
});

describe('social snapshot measurements', () => {
  const required = ['impressions', 'reach', 'follows', 'profileActivity', 'engagement'] as const;
  const optional = ['followers', 'posts', 'reels', 'stories', 'clicks', 'websiteVisits'] as const;
  const values = { ...period, platform: 'Instagram', impressions: 100, reach: 50, follows: 5, profileActivity: 12, engagement: 20 };

  it('accepts just the five metrics and context, with optional blanks left unknown', () => {
    expect(socialMetricSchema.safeParse(values).success).toBe(true);
    for (const field of optional) {
      for (const value of ['', null, undefined]) {
        const parsed = socialMetricSchema.parse({ ...values, [field]: value });
        expect(parsed[field]).toBeUndefined();
      }
      expect(socialMetricSchema.parse({ ...values, [field]: 0 })[field]).toBe(0);
      expect(socialMetricSchema.safeParse({ ...values, [field]: -1 }).success).toBe(false);
    }
  });

  it.each(required)('requires an explicit nonnegative whole-number %s', (field) => {
    for (const invalid of [undefined, null, '', -1, 1.5, 100_000_001]) {
      expect(socialMetricSchema.safeParse({ ...values, [field]: invalid }).success).toBe(false);
    }
    expect(socialMetricSchema.parse({ ...values, [field]: 0 })[field]).toBe(0);
  });

  it('marks only these five numeric fields required and sends typed numbers', () => {
    const definition = marketingWorkflows.find((workflow) => workflow.id === 'social-metric')!;
    expect(definition.fields.filter((field) => field.type === 'number' && field.required).map((field) => field.name)).toEqual(required);
    expect(definition.fields.filter((field) => field.type === 'number').every((field) => field.defaultValue === '')).toBe(true);
    const formValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]));
    expect(socialMetricSchema.parse(buildWorkflowPayload(definition, { ...formValues, posts: '', followers: '' }))).toMatchObject(values);
    expect(socialMetricSchema.safeParse(buildWorkflowPayload(definition, { ...formValues, follows: '' })).success).toBe(false);
  });
});
