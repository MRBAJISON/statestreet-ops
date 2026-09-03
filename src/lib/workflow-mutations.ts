import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AppUser } from './auth';
import { insertAuditedRecord, upsertAuditedRecord } from './audited-mutations';
import { formatContractError } from './contracts/shared';
import {
  actionItemSchema,
  brandHealthSchema,
  brandSentimentSchema,
  budgetSchema,
  campaignSchema,
  capitalSnapshotSchema,
  cashTransactionSchema,
  clientelingSchema,
  competitorSchema,
  customerCaptureSchema,
  digitalReputationSchema,
  expenseSchema,
  feedbackSchema,
  financialForecastSchema,
  incidentSchema,
  inventoryDispositionSchema,
  leadMetricSchema,
  maintenanceSchema,
  peopleSnapshotSchema,
  performanceTargetSchema,
  productInsightSchema,
  socialMetricSchema,
  sopReviewSchema,
  storeExperienceSchema,
  storeStandardSchema,
  vmReviewSchema,
  workingCapitalSchema,
  type WorkflowName,
} from './contracts/workflows';
import { db } from './db';
import { stores } from './db/foundation-schema';
import { HttpError, sessionUserId } from './server-errors';
import { resolveActingStore } from './store-access';
import type { UserRole } from './types';

interface WorkflowHandler {
  roles: ReadonlySet<UserRole>;
  execute(user: AppUser, input: unknown): Promise<Record<string, unknown>>;
}

function workflow<TSchema extends z.ZodType>(
  schema: TSchema,
  roles: readonly UserRole[],
  create: (user: AppUser, input: z.infer<TSchema>) => Promise<Record<string, unknown>>
): WorkflowHandler {
  return {
    roles: new Set(roles),
    async execute(user, input) {
      const parsed = schema.safeParse(input);
      if (!parsed.success) throw new HttpError(400, formatContractError(parsed.error));
      return create(user, parsed.data);
    },
  };
}

const actors = (actorUserId: number) => ({
  created_by_user_id: actorUserId,
  updated_by_user_id: actorUserId,
});

const upsertActors = (actorUserId: number) => ({
  ...actors(actorUserId),
  updated_at: new Date(),
});

async function activeStoreById(id: number) {
  const [store] = await db
    .select({ id: stores.id, code: stores.code, name: stores.name })
    .from(stores)
    .where(and(eq(stores.id, id), eq(stores.active, true)))
    .limit(1);
  if (!store) throw new HttpError(400, 'The selected store is not active');
  return store;
}

async function assignedStore(user: AppUser, requestedStoreId?: number) {
  if (user.role !== 'store-manager') {
    if (!requestedStoreId) throw new HttpError(400, 'storeId is required');
    return activeStoreById(requestedStoreId);
  }
  // The store selected on the tab strip. A requested store is still honoured and
  // still checked, so a form that names its store explicitly keeps working.
  return resolveActingStore(user, requestedStoreId);
}

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = `233${digits.slice(1)}`;
  if (digits.length < 9 || digits.length > 15) throw new HttpError(400, 'Enter a valid phone number');
  return digits;
}

async function createExpense(user: AppUser, input: z.infer<typeof expenseSchema>) {
  if (input.storeId) await activeStoreById(input.storeId);
  const actorUserId = sessionUserId(user.id);
  const result = await db.execute(sql`
    with position as materialized (
      select *
      from public.expense_budget_position(
        ${input.businessDate}::date,
        ${input.expenseCategoryId}::bigint,
        ${input.storeId ?? null}::bigint
      )
    ), created as (
      insert into expenses (
        business_date, expense_category_id, store_id, amount, vendor, invoice_reference,
        payment_method_id, description, overspend_reason, created_by_user_id, updated_by_user_id
      )
      select
        ${input.businessDate}, ${input.expenseCategoryId}, ${input.storeId ?? null}, ${input.amount},
        ${input.vendor ?? null}, ${input.invoiceReference ?? null}, ${input.paymentMethodId ?? null},
        ${input.description}, ${input.overspendReason ?? null}, ${actorUserId}, ${actorUserId}
      from position
      where position.actual + ${input.amount}::numeric <= position.budget
         or ${input.overspendReason ?? null}::text is not null
      returning *
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after)
      select 'expense', created.id, 'create', ${actorUserId}, to_jsonb(created)
      from created
      returning id
    )
    select to_jsonb(created) as record from created
  `);
  const record = (result.rows[0] as { record?: Record<string, unknown> } | undefined)?.record;
  if (!record) throw new HttpError(409, 'This expense exceeds its annual budget; add an overspend reason');
  return record;
}

async function captureCustomer(user: AppUser, input: z.infer<typeof customerCaptureSchema>) {
  const store = await assignedStore(user, input.storeId);
  const actorUserId = sessionUserId(user.id);
  const phoneNormalized = normalizePhone(input.phone);
  const result = await db.execute(sql`
    with before_customer as materialized (
      select * from customers where phone_normalized = ${phoneNormalized}
    ), customer_record as (
      insert into customers as customer (
        name, phone, phone_normalized, occupation, size_preference,
        created_by_user_id, updated_by_user_id
      )
      values (
        ${input.name}, ${input.phone}, ${phoneNormalized}, ${input.occupation ?? null},
        ${input.sizePreference ?? null}, ${actorUserId}, ${actorUserId}
      )
      on conflict (phone_normalized) do update
      set name = excluded.name,
          phone = excluded.phone,
          occupation = coalesce(excluded.occupation, customer.occupation),
          size_preference = coalesce(excluded.size_preference, customer.size_preference),
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = now()
      returning customer.*, (xmax = 0) as inserted
    ), customer_audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after)
      select
        'customer', customer.id,
        case when customer.inserted then 'create' else 'update' end,
        ${actorUserId},
        case when before.id is null then null else jsonb_build_object('id', before.id, 'name', before.name) end,
        jsonb_build_object('id', customer.id, 'name', customer.name)
      from customer_record customer
      left join before_customer before on before.id = customer.id
      returning id
    ), interaction as (
      insert into customer_interactions (
        customer_id, store_id, business_date, lifecycle, source, source_detail,
        product_id, interest_text, fulfillment_status, stock_gap_quantity, stock_gap_value, stock_gap_cause, notes, captured_by_user_id
      )
      select customer.id, ${store.id}, ${input.businessDate}, ${input.lifecycle}, ${input.source},
             ${input.sourceDetail ?? null}, ${input.productId ?? null}, ${input.interestText ?? null},
             ${input.fulfillmentStatus ?? null}, ${input.stockGapQuantity ?? null}, ${input.stockGapValue ?? null}, ${input.stockGapCause ?? null}, ${input.notes ?? null}, ${actorUserId}
      from customer_record customer
      returning *
    ), interaction_audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after)
      select 'customer-interaction', interaction.id, 'create', ${actorUserId}, to_jsonb(interaction)
      from interaction
      returning id
    )
    select to_jsonb(interaction) as record from interaction
  `);
  const record = (result.rows[0] as { record?: Record<string, unknown> } | undefined)?.record;
  if (!record) throw new Error('Customer interaction was not saved');
  return record;
}

export const WORKFLOW_HANDLERS: Record<WorkflowName, WorkflowHandler> = {
  expense: workflow(expenseSchema, ['finance', 'operations'], createExpense),
  budget: workflow(budgetSchema, ['owner', 'finance', 'commercial', 'operations'], async (user, input) => {
    if (input.storeId) await activeStoreById(input.storeId);
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'budgets', entityType: 'budget', actorUserId,
      key: { year: input.year, expense_category_id: input.expenseCategoryId, store_id: input.storeId ?? null },
      values: {
        year: input.year, expense_category_id: input.expenseCategoryId, store_id: input.storeId ?? null,
        amount: input.amount, notes: input.notes ?? null, ...upsertActors(actorUserId),
      },
      preserveOnUpdate: ['created_by_user_id'],
    });
  }),
  'capital-snapshot': workflow(capitalSnapshotSchema, ['finance', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'capital_snapshots', entityType: 'capital-snapshot', actorUserId, key: { year: input.year },
      values: {
        year: input.year, capital_employed: input.capitalEmployed, total_investment: input.totalInvestment,
        notes: input.notes ?? null, ...upsertActors(actorUserId),
      },
      preserveOnUpdate: ['created_by_user_id'],
    });
  }),
  'cash-transaction': workflow(cashTransactionSchema, ['finance', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return insertAuditedRecord({
      table: 'cash_transactions', entityType: 'cash-transaction', actorUserId,
      values: {
        business_date: input.businessDate, direction: input.direction, category: input.category,
        expense_category_id: input.expenseCategoryId ?? null, amount: input.amount,
        cash_account_id: input.cashAccountId ?? null, reference: input.reference ?? null,
        description: input.description ?? null, source_type: 'manual', source_id: null, ...actors(actorUserId),
      },
    });
  }),
  'working-capital': workflow(workingCapitalSchema, ['finance', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return insertAuditedRecord({
      table: 'working_capital_items', entityType: 'working-capital-item', actorUserId,
      values: {
        type: input.type, entity: input.entity, original_amount: input.originalAmount,
        open_amount: input.originalAmount, due_date: input.dueDate ?? null, status: 'open',
        notes: input.notes ?? null, ...actors(actorUserId),
      },
    });
  }),
  forecast: workflow(financialForecastSchema, ['finance', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'financial_forecasts', entityType: 'financial-forecast', actorUserId,
      key: { period_start: input.periodStart, period_end: input.periodEnd },
      values: {
        period_start: input.periodStart, period_end: input.periodEnd, revenue: input.revenue,
        gross_profit: input.grossProfit, net_profit: input.netProfit, cash_balance: input.cashBalance,
        confidence: input.confidence, assumptions: input.assumptions ?? null, ...upsertActors(actorUserId),
      },
      preserveOnUpdate: ['created_by_user_id'],
    });
  }),
  target: workflow(performanceTargetSchema, ['owner', 'finance', 'commercial', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    const periodEnd = input.periodEnd ?? '2099-12-31';
    return upsertAuditedRecord({
      table: 'performance_targets', entityType: 'performance-target', actorUserId,
      key: {
        metric: input.metric, scope_type: input.scopeType, store_id: input.storeId ?? null,
        brand_id: input.brandId ?? null, category_id: input.categoryId ?? null,
        period_start: input.periodStart, period_end: periodEnd, recurring: input.recurring,
      },
      values: {
        metric: input.metric, scope_type: input.scopeType, store_id: input.storeId ?? null,
        brand_id: input.brandId ?? null, category_id: input.categoryId ?? null,
        period_type: input.periodType, period_start: input.periodStart, period_end: periodEnd,
        recurring: input.recurring, value: input.value, unit: input.unit, ...upsertActors(actorUserId),
      },
      preserveOnUpdate: ['created_by_user_id'],
    });
  }),
  action: workflow(actionItemSchema, ['owner', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'], async (user, input) => {
    const allowedDepartment = user.role === 'owner' || user.role === 'operations' || user.role === input.department ||
      (user.role === 'marketing' && input.department === 'brand');
    if (!allowedDepartment) throw new HttpError(403, 'You cannot create an action for this department');
    const actorUserId = sessionUserId(user.id);
    return insertAuditedRecord({
      table: 'action_items', entityType: 'action-item', actorUserId,
      values: {
        department: input.department, source_type: 'manual', source_id: null,
        store_id: input.storeId ?? null, brand_id: input.brandId ?? null,
        category_id: input.categoryId ?? null, title: input.title, detail: input.detail ?? null,
        priority: input.priority, owner_user_id: input.ownerUserId ?? null,
        owner_name: input.ownerName ?? null, due_date: input.dueDate ?? null,
        status: 'open', completed_at: null, ...actors(actorUserId),
      },
    });
  }),
  'product-insight': workflow(productInsightSchema, ['commercial', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'product_insights', entityType: 'product-insight', actorUserId,
      key: { product_id: input.productId, period_start: input.periodStart, period_end: input.periodEnd },
      values: {
        product_id: input.productId, period_start: input.periodStart, period_end: input.periodEnd,
        status: input.status, performance: input.performance ?? null, campaign: input.campaign ?? null,
        insight: input.insight ?? null, units_sold: input.unitsSold ?? null,
        current_stock: input.currentStock ?? null, sell_through_percent: input.sellThroughPercent ?? null,
        sales_value: input.salesValue ?? null, days_in_stock: input.daysInStock ?? null,
        ...upsertActors(actorUserId),
      },
      preserveOnUpdate: ['created_by_user_id'],
    });
  }),
  campaign: workflow(campaignSchema, ['marketing', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return insertAuditedRecord({
      table: 'marketing_campaign_reports', entityType: 'marketing-campaign', actorUserId,
      values: {
        business_date: input.businessDate, name: input.name, brand_id: input.brandId,
        platform: input.platform, reach: input.reach, engagement: input.engagement,
        store_visits: input.storeVisits, revenue_influenced: input.revenueInfluenced,
        spend: input.spend, status: input.status, ...actors(actorUserId),
      },
    });
  }),
  'lead-metric': workflow(leadMetricSchema, ['marketing', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return insertAuditedRecord({
      table: 'lead_metrics', entityType: 'lead-metric', actorUserId,
      values: {
        business_date: input.businessDate, channel: input.channel,
        campaign_report_id: input.campaignReportId ?? null, lead_count: input.leadCount,
        qualified_count: input.qualifiedCount, converted_count: input.convertedCount,
        average_value: input.averageValue ?? null, notes: input.notes ?? null, ...actors(actorUserId),
      },
    });
  }),
  'social-metric': workflow(socialMetricSchema, ['marketing', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'social_metrics', entityType: 'social-metric', actorUserId,
      key: { business_date: input.businessDate, platform: input.platform, brand_id: input.brandId ?? null },
      values: {
        business_date: input.businessDate, platform: input.platform, brand_id: input.brandId ?? null,
        followers: input.followers, posts: input.posts, reels: input.reels, stories: input.stories,
        reach: input.reach, impressions: input.impressions, engagement: input.engagement,
        clicks: input.clicks, website_visits: input.websiteVisits, ...upsertActors(actorUserId),
      },
      preserveOnUpdate: ['created_by_user_id'],
    });
  }),
  clienteling: workflow(clientelingSchema, ['marketing', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'clienteling_activities', entityType: 'clienteling-activity', actorUserId,
      key: { business_date: input.businessDate, type: input.type, store_id: input.storeId ?? null },
      values: {
        business_date: input.businessDate, type: input.type, store_id: input.storeId ?? null,
        contacted: input.contacted, responses: input.responses, appointments: input.appointments,
        estimated_revenue: input.estimatedRevenue, notes: input.notes ?? null, ...upsertActors(actorUserId),
      },
      preserveOnUpdate: ['created_by_user_id'],
    });
  }),
  feedback: workflow(feedbackSchema, ['marketing', 'brand', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return insertAuditedRecord({
      table: 'customer_feedback', entityType: 'customer-feedback', actorUserId,
      values: {
        business_date: input.businessDate, source: input.source, type: input.type,
        category: input.category ?? null, nps_score: input.npsScore ?? null,
        recommendation: input.recommendation ?? null, frequency: input.frequency ?? null,
        detail: input.detail, store_id: input.storeId ?? null, brand_id: input.brandId ?? null,
        contact_name: input.contactName ?? null, contact_value: input.contactValue ?? null,
        contact_consent: input.contactConsent, retention_until: input.retentionUntil ?? null,
        captured_by_user_id: actorUserId,
      },
      redact: ['contact_name', 'contact_value'],
    });
  }),
  'store-standard': workflow(storeStandardSchema, ['operations'], async (user, input) => {
    await activeStoreById(input.storeId);
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'store_standard_reviews', entityType: 'store-standard-review', actorUserId,
      key: { business_date: input.businessDate, store_id: input.storeId },
      values: {
        business_date: input.businessDate, store_id: input.storeId,
        operations_score: input.operationsScore, vm_score: input.vmScore,
        readiness_score: input.readinessScore, customer_experience_score: input.customerExperienceScore,
        cleanliness_score: input.cleanlinessScore, safety_score: input.safetyScore,
        issues: input.issues ?? null, reviewed_by_user_id: actorUserId, updated_at: new Date(),
      },
      preserveOnUpdate: ['reviewed_by_user_id'],
    });
  }),
  'vm-review': workflow(vmReviewSchema, ['operations'], async (user, input) => {
    await activeStoreById(input.storeId);
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'visual_merchandising_reviews', entityType: 'visual-merchandising-review', actorUserId,
      key: { business_date: input.businessDate, store_id: input.storeId },
      values: {
        business_date: input.businessDate, store_id: input.storeId,
        window_display_score: input.windowDisplayScore, mannequin_score: input.mannequinScore,
        product_presentation_score: input.productPresentationScore,
        size_arrangement_score: input.sizeArrangementScore, improvements: input.improvements ?? null,
        reviewed_by_user_id: actorUserId, updated_at: new Date(),
      },
      preserveOnUpdate: ['reviewed_by_user_id'],
    });
  }),
  'store-experience': workflow(storeExperienceSchema, ['operations'], async (user, input) => {
    await activeStoreById(input.storeId);
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'store_experience_reviews', entityType: 'store-experience-review', actorUserId,
      key: { business_date: input.businessDate, store_id: input.storeId, category: input.category },
      values: {
        business_date: input.businessDate, store_id: input.storeId, category: input.category,
        rating: input.rating, nps_score: input.npsScore ?? null,
        recommendation: input.recommendation ?? null, comments: input.comments ?? null,
        reviewed_by_user_id: actorUserId, updated_at: new Date(),
      },
      preserveOnUpdate: ['reviewed_by_user_id'],
    });
  }),
  maintenance: workflow(maintenanceSchema, ['operations'], async (user, input) => {
    await activeStoreById(input.storeId);
    const actorUserId = sessionUserId(user.id);
    return insertAuditedRecord({
      table: 'maintenance_requests', entityType: 'maintenance-request', actorUserId,
      values: {
        business_date: input.businessDate, store_id: input.storeId, category: input.category,
        priority: input.priority, description: input.description,
        assigned_to_user_id: input.assignedToUserId ?? null, assigned_to_name: input.assignedToName ?? null,
        estimated_cost: input.estimatedCost ?? null, due_date: input.dueDate ?? null,
        status: 'open', resolved_at: null, reported_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      },
    });
  }),
  incident: workflow(incidentSchema, ['operations'], async (user, input) => {
    await activeStoreById(input.storeId);
    const actorUserId = sessionUserId(user.id);
    return insertAuditedRecord({
      table: 'incidents', entityType: 'incident', actorUserId,
      values: {
        occurred_at: input.occurredAt, store_id: input.storeId, type: input.type,
        severity: input.severity, description: input.description,
        immediate_action: input.immediateAction ?? null, follow_up_required: input.followUpRequired,
        status: 'open', resolved_at: null, reported_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      },
    });
  }),
  'sop-review': workflow(sopReviewSchema, ['operations'], async (user, input) => {
    await activeStoreById(input.storeId);
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'sop_reviews', entityType: 'sop-review', actorUserId,
      key: { business_date: input.businessDate, store_id: input.storeId, area: input.area },
      values: {
        business_date: input.businessDate, store_id: input.storeId, area: input.area,
        compliance_score: input.complianceScore, deviations: input.deviations ?? null,
        corrective_action: input.correctiveAction ?? null, reviewed_by_user_id: actorUserId,
        updated_at: new Date(),
      },
      preserveOnUpdate: ['reviewed_by_user_id'],
    });
  }),
  people: workflow(peopleSnapshotSchema, ['operations'], async (user, input) => {
    await activeStoreById(input.storeId);
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'people_snapshots', entityType: 'people-snapshot', actorUserId,
      key: { business_date: input.businessDate, store_id: input.storeId },
      values: {
        business_date: input.businessDate, store_id: input.storeId, staff_total: input.staffTotal,
        staff_present: input.staffPresent, punctuality_score: input.punctualityScore,
        training_completion_score: input.trainingCompletionScore,
        absence_reason: input.absenceReason ?? null, notes: input.notes ?? null,
        recorded_by_user_id: actorUserId, updated_at: new Date(),
      },
      preserveOnUpdate: ['recorded_by_user_id'],
    });
  }),
  'brand-health': workflow(brandHealthSchema, ['brand', 'marketing', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'brand_health_assessments', entityType: 'brand-health-assessment', actorUserId,
      key: { business_date: input.businessDate, brand_id: input.brandId, type: input.type },
      values: {
        business_date: input.businessDate, brand_id: input.brandId, type: input.type,
        awareness_score: input.awarenessScore, consideration_score: input.considerationScore,
        preference_score: input.preferenceScore, satisfaction_score: input.satisfactionScore,
        loyalty_score: input.loyaltyScore, advocacy_score: input.advocacyScore,
        momentum_score: input.momentumScore, overall_override: input.overallOverride ?? null,
        override_reason: input.overrideReason ?? null, ...upsertActors(actorUserId),
      },
      preserveOnUpdate: ['created_by_user_id'],
    });
  }),
  'brand-sentiment': workflow(brandSentimentSchema, ['brand', 'marketing', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'brand_sentiment_snapshots', entityType: 'brand-sentiment-snapshot', actorUserId,
      key: { business_date: input.businessDate, brand_id: input.brandId, source: input.source },
      values: {
        business_date: input.businessDate, brand_id: input.brandId, source: input.source,
        positive_mentions: input.positiveMentions, neutral_mentions: input.neutralMentions,
        negative_mentions: input.negativeMentions, positive_theme: input.positiveTheme ?? null,
        negative_theme: input.negativeTheme ?? null, ...upsertActors(actorUserId),
      },
      preserveOnUpdate: ['created_by_user_id'],
    });
  }),
  competitor: workflow(competitorSchema, ['brand', 'marketing', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return insertAuditedRecord({
      table: 'competitor_activities', entityType: 'competitor-activity', actorUserId,
      values: {
        business_date: input.businessDate, competitor: input.competitor,
        brand_id: input.brandId ?? null, share_of_voice: input.shareOfVoice ?? null,
        activity_type: input.activityType ?? null, description: input.description,
        threat_level: input.threatLevel, recommended_response: input.recommendedResponse ?? null,
        ...actors(actorUserId),
      },
    });
  }),
  'digital-reputation': workflow(digitalReputationSchema, ['brand', 'marketing', 'operations'], async (user, input) => {
    const actorUserId = sessionUserId(user.id);
    return upsertAuditedRecord({
      table: 'digital_reputation_snapshots', entityType: 'digital-reputation-snapshot', actorUserId,
      key: { business_date: input.businessDate, brand_id: input.brandId ?? null },
      values: {
        business_date: input.businessDate, brand_id: input.brandId ?? null,
        google_rating: input.googleRating ?? null, google_review_count: input.googleReviewCount,
        instagram_sentiment: input.instagramSentiment ?? null,
        instagram_followers: input.instagramFollowers, response_rate: input.responseRate ?? null,
        average_response_hours: input.averageResponseHours ?? null, nps: input.nps ?? null,
        trustpilot_rating: input.trustpilotRating ?? null, new_reviews: input.newReviews,
        negative_reviews: input.negativeReviews, ...upsertActors(actorUserId),
      },
      preserveOnUpdate: ['created_by_user_id'],
    });
  }),
  'inventory-disposition': workflow(inventoryDispositionSchema, ['inventory', 'operations'], async (user, input) => {
    await activeStoreById(input.storeId);
    const actorUserId = sessionUserId(user.id);
    return insertAuditedRecord({
      table: 'inventory_dispositions', entityType: 'inventory-disposition', actorUserId,
      values: {
        review_date: input.reviewDate, product_id: input.productId, store_id: input.storeId,
        action: input.action, justification: input.justification, status: 'proposed',
        action_item_id: null, ...actors(actorUserId),
      },
    });
  }),
  'customer-capture': workflow(customerCaptureSchema, ['commercial', 'store-manager'], captureCustomer),
};

export async function executeWorkflow(name: WorkflowName, user: AppUser, input: unknown) {
  const handler = WORKFLOW_HANDLERS[name];
  if (!handler.roles.has(user.role)) throw new HttpError(403, 'Forbidden');
  return handler.execute(user, input);
}
