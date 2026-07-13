import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { entries, users } from './schema';
import {
  brands,
  categories,
  expenseCategories,
  products,
  stores,
  weeklyReviews,
} from './foundation-schema';

const id = (name = 'id') => bigint(name, { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey();
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const percentage = (name: string) => numeric(name, { precision: 6, scale: 2 });
const actor = (name: string) =>
  integer(name)
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' });
const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
const actors = () => ({
  createdByUserId: actor('created_by_user_id'),
  updatedByUserId: actor('updated_by_user_id'),
});

export const organizationSettings = pgTable(
  'organization_settings',
  {
    id: integer('id').primaryKey().default(1),
    companyName: text('company_name').notNull().default('StateStreet'),
    tagline: text('tagline').notNull().default('Retail Group'),
    currency: text('currency').notNull().default('GHS'),
    logo: text('logo'),
    weekStart: text('week_start').notNull().default('monday'),
    minimumPasswordLength: integer('minimum_password_length').notNull().default(8),
    sessionDays: integer('session_days').notNull().default(7),
    updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    check('org_settings_singleton_check', sql`${t.id} = 1`),
    check('org_settings_week_start_check', sql`${t.weekStart} in ('monday', 'sunday')`),
    check('org_settings_password_length_check', sql`${t.minimumPasswordLength} between 8 and 128`),
    check('org_settings_session_days_check', sql`${t.sessionDays} between 1 and 90`),
  ]
);

export const surveyRateLimits = pgTable(
  'survey_rate_limits',
  {
    fingerprint: text('fingerprint').primaryKey(),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull().defaultNow(),
    submissionCount: integer('submission_count').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('survey_rate_limits_updated_idx').on(t.updatedAt),
    check('survey_rate_limits_count_check', sql`${t.submissionCount} > 0`),
  ]
);

export const performanceTargets = pgTable(
  'performance_targets',
  {
    id: id(),
    metric: text('metric').notNull(),
    scopeType: text('scope_type').notNull(),
    storeId: bigint('store_id', { mode: 'number' }).references(() => stores.id, { onDelete: 'restrict' }),
    brandId: bigint('brand_id', { mode: 'number' }).references(() => brands.id, { onDelete: 'restrict' }),
    categoryId: bigint('category_id', { mode: 'number' }).references(() => categories.id, {
      onDelete: 'restrict',
    }),
    periodType: text('period_type').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    value: money('value').notNull(),
    unit: text('unit').notNull(),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('targets_group_period_uidx')
      .on(t.metric, t.periodStart, t.periodEnd)
      .where(sql`${t.scopeType} = 'group'`),
    uniqueIndex('targets_store_period_uidx')
      .on(t.metric, t.storeId, t.periodStart, t.periodEnd)
      .where(sql`${t.scopeType} = 'store'`),
    uniqueIndex('targets_brand_period_uidx')
      .on(t.metric, t.brandId, t.periodStart, t.periodEnd)
      .where(sql`${t.scopeType} = 'brand'`),
    uniqueIndex('targets_category_period_uidx')
      .on(t.metric, t.categoryId, t.periodStart, t.periodEnd)
      .where(sql`${t.scopeType} = 'category'`),
    index('targets_metric_period_idx').on(t.metric, t.periodStart, t.periodEnd),
    index('targets_store_idx').on(t.storeId, t.periodStart),
    index('targets_brand_idx').on(t.brandId, t.periodStart),
    index('targets_category_idx').on(t.categoryId, t.periodStart),
    check('targets_scope_check', sql`${t.scopeType} in ('group', 'store', 'brand', 'category')`),
    check('targets_period_type_check', sql`${t.periodType} in ('week', 'month', 'quarter', 'year')`),
    check('targets_period_range_check', sql`${t.periodEnd} >= ${t.periodStart}`),
    check('targets_value_check', sql`${t.value} >= 0`),
    check('targets_unit_check', sql`${t.unit} in ('money', 'percent', 'count', 'ratio')`),
    check(
      'targets_scope_reference_check',
      sql`(
        (${t.scopeType} = 'group' and ${t.storeId} is null and ${t.brandId} is null and ${t.categoryId} is null) or
        (${t.scopeType} = 'store' and ${t.storeId} is not null and ${t.brandId} is null and ${t.categoryId} is null) or
        (${t.scopeType} = 'brand' and ${t.storeId} is null and ${t.brandId} is not null and ${t.categoryId} is null) or
        (${t.scopeType} = 'category' and ${t.storeId} is null and ${t.brandId} is null and ${t.categoryId} is not null)
      )`
    ),
  ]
);

export const productInsights = pgTable(
  'product_insights',
  {
    id: id(),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    status: text('status').notNull().default('active'),
    performance: text('performance'),
    campaign: text('campaign'),
    insight: text('insight'),
    unitsSold: integer('units_sold'),
    currentStock: integer('current_stock'),
    sellThroughPercent: percentage('sell_through_percent'),
    salesValue: money('sales_value'),
    daysInStock: integer('days_in_stock'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('product_insights_product_period_uidx').on(t.productId, t.periodStart, t.periodEnd),
    index('product_insights_status_idx').on(t.status, t.periodEnd),
    check('product_insights_period_check', sql`${t.periodEnd} >= ${t.periodStart}`),
    check('product_insights_status_check', sql`${t.status} in ('active', 'slow', 'dead', 'out-of-stock')`),
    check(
      'product_insights_performance_check',
      sql`${t.performance} is null or ${t.performance} in ('strong', 'steady', 'underperforming')`
    ),
    check(
      'product_insights_metrics_check',
      sql`(${t.unitsSold} is null or ${t.unitsSold} >= 0) and (${t.currentStock} is null or ${t.currentStock} >= 0) and (${t.sellThroughPercent} is null or ${t.sellThroughPercent} between 0 and 100) and (${t.salesValue} is null or ${t.salesValue} >= 0) and (${t.daysInStock} is null or ${t.daysInStock} >= 0)`
    ),
  ]
);

export const inventorySummarySnapshots = pgTable(
  'inventory_summary_snapshots',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    systemQuantity: integer('system_quantity').notNull(),
    physicalQuantity: integer('physical_quantity').notNull(),
    stockValue: money('stock_value').notNull().default('0'),
    countedByName: text('counted_by_name'),
    notes: text('notes'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('inventory_summary_snapshots_store_date_uidx').on(t.storeId, t.businessDate),
    index('inventory_summary_snapshots_date_idx').on(t.businessDate),
    check(
      'inventory_summary_snapshots_values_check',
      sql`${t.systemQuantity} >= 0 and ${t.physicalQuantity} >= 0 and ${t.stockValue} >= 0`
    ),
  ]
);

export const legacyMigrationRecords = pgTable(
  'legacy_migration_records',
  {
    entryId: integer('entry_id')
      .primaryKey()
      .references(() => entries.id, { onDelete: 'restrict' }),
    disposition: text('disposition').notNull(),
    targetType: text('target_type'),
    targetId: bigint('target_id', { mode: 'number' }),
    sourceCreatedAt: timestamp('source_created_at', { withTimezone: true }).notNull(),
    sourcePayloadHash: text('source_payload_hash').notNull(),
    note: text('note'),
    migratedByUserId: integer('migrated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    migratedAt: timestamp('migrated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('legacy_migration_records_disposition_idx').on(t.disposition, t.targetType),
    index('legacy_migration_records_target_idx').on(t.targetType, t.targetId),
    check(
      'legacy_migration_records_disposition_check',
      sql`${t.disposition} in ('converted', 'derived', 'retained', 'blocked')`
    ),
    check(
      'legacy_migration_records_target_check',
      sql`(${t.disposition} = 'converted' and ${t.targetType} is not null and ${t.targetId} is not null) or ${t.disposition} <> 'converted'`
    ),
  ]
);

export const actionItems = pgTable(
  'action_items',
  {
    id: id(),
    department: text('department').notNull(),
    sourceType: text('source_type'),
    sourceId: bigint('source_id', { mode: 'number' }),
    storeId: bigint('store_id', { mode: 'number' }).references(() => stores.id, { onDelete: 'restrict' }),
    brandId: bigint('brand_id', { mode: 'number' }).references(() => brands.id, { onDelete: 'restrict' }),
    categoryId: bigint('category_id', { mode: 'number' }).references(() => categories.id, {
      onDelete: 'restrict',
    }),
    title: text('title').notNull(),
    detail: text('detail'),
    priority: text('priority').notNull().default('medium'),
    ownerUserId: integer('owner_user_id').references(() => users.id, { onDelete: 'restrict' }),
    ownerName: text('owner_name'),
    dueDate: date('due_date'),
    status: text('status').notNull().default('open'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    index('action_items_department_status_idx').on(t.department, t.status, t.dueDate),
    index('action_items_owner_status_idx').on(t.ownerUserId, t.status),
    index('action_items_store_idx').on(t.storeId, t.status),
    index('action_items_source_idx').on(t.sourceType, t.sourceId),
    check('action_items_priority_check', sql`${t.priority} in ('low', 'medium', 'high', 'critical')`),
    check(
      'action_items_status_check',
      sql`${t.status} in ('open', 'in-progress', 'blocked', 'completed', 'cancelled')`
    ),
    check('action_items_owner_check', sql`${t.ownerUserId} is not null or ${t.ownerName} is not null`),
  ]
);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    movementType: text('movement_type').notNull(),
    quantity: integer('quantity').notNull(),
    unitCost: money('unit_cost'),
    sourceType: text('source_type').notNull(),
    sourceId: bigint('source_id', { mode: 'number' }),
    sourceLineId: bigint('source_line_id', { mode: 'number' }),
    createdByUserId: actor('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('inventory_movements_product_store_date_idx').on(t.productId, t.storeId, t.businessDate),
    index('inventory_movements_store_date_idx').on(t.storeId, t.businessDate),
    index('inventory_movements_source_idx').on(t.sourceType, t.sourceId, t.sourceLineId),
    check(
      'inventory_movements_type_check',
      sql`${t.movementType} in ('opening-balance', 'receipt', 'transfer-in', 'transfer-out', 'count-adjustment', 'sale', 'return', 'write-off')`
    ),
    check('inventory_movements_quantity_check', sql`${t.quantity} <> 0`),
    check('inventory_movements_unit_cost_check', sql`${t.unitCost} is null or ${t.unitCost} >= 0`),
  ]
);

export const inventoryDispositions = pgTable(
  'inventory_dispositions',
  {
    id: id(),
    reviewDate: date('review_date').notNull(),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    justification: text('justification').notNull(),
    status: text('status').notNull().default('proposed'),
    actionItemId: bigint('action_item_id', { mode: 'number' }).references(() => actionItems.id, {
      onDelete: 'set null',
    }),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    index('inventory_dispositions_store_status_idx').on(t.storeId, t.status, t.reviewDate),
    index('inventory_dispositions_product_idx').on(t.productId, t.reviewDate),
    check(
      'inventory_dispositions_action_check',
      sql`${t.action} in ('markdown-20', 'markdown-40', 'markdown-60', 'transfer', 'donate', 'write-off')`
    ),
    check(
      'inventory_dispositions_status_check',
      sql`${t.status} in ('proposed', 'approved', 'in-progress', 'completed', 'rejected', 'cancelled')`
    ),
  ]
);

export const cashAccounts = pgTable(
  'cash_accounts',
  {
    id: id(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('cash_accounts_code_lower_uidx').on(sql`lower(${t.code})`),
    check('cash_accounts_type_check', sql`${t.type} in ('bank', 'cash', 'mobile-money', 'other')`),
  ]
);

export const capitalSnapshots = pgTable(
  'capital_snapshots',
  {
    id: id(),
    year: integer('year').notNull(),
    capitalEmployed: money('capital_employed').notNull(),
    totalInvestment: money('total_investment').notNull(),
    notes: text('notes'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('capital_snapshots_year_uidx').on(t.year),
    check('capital_snapshots_year_check', sql`${t.year} between 2000 and 2200`),
    check('capital_snapshots_amounts_check', sql`${t.capitalEmployed} >= 0 and ${t.totalInvestment} >= 0`),
  ]
);

export const cashTransactions = pgTable(
  'cash_transactions',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    direction: text('direction').notNull(),
    category: text('category').notNull(),
    expenseCategoryId: bigint('expense_category_id', { mode: 'number' }).references(() => expenseCategories.id, {
      onDelete: 'restrict',
    }),
    amount: money('amount').notNull(),
    cashAccountId: bigint('cash_account_id', { mode: 'number' }).references(() => cashAccounts.id, {
      onDelete: 'restrict',
    }),
    reference: text('reference'),
    description: text('description'),
    sourceType: text('source_type'),
    sourceId: bigint('source_id', { mode: 'number' }),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    index('cash_transactions_date_direction_idx').on(t.businessDate, t.direction),
    index('cash_transactions_account_idx').on(t.cashAccountId, t.businessDate),
    index('cash_transactions_source_idx').on(t.sourceType, t.sourceId),
    check('cash_transactions_direction_check', sql`${t.direction} in ('inflow', 'outflow')`),
    check('cash_transactions_amount_check', sql`${t.amount} > 0`),
  ]
);

export const workingCapitalItems = pgTable(
  'working_capital_items',
  {
    id: id(),
    type: text('type').notNull(),
    entity: text('entity').notNull(),
    originalAmount: money('original_amount').notNull(),
    openAmount: money('open_amount').notNull(),
    dueDate: date('due_date'),
    status: text('status').notNull().default('open'),
    notes: text('notes'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    index('working_capital_type_status_due_idx').on(t.type, t.status, t.dueDate),
    check('working_capital_type_check', sql`${t.type} in ('debtor', 'creditor')`),
    check(
      'working_capital_amounts_check',
      sql`${t.originalAmount} > 0 and ${t.openAmount} >= 0 and ${t.openAmount} <= ${t.originalAmount}`
    ),
    check(
      'working_capital_status_check',
      sql`${t.status} in ('open', 'partial', 'settled', 'written-off')`
    ),
  ]
);

export const workingCapitalSettlements = pgTable(
  'working_capital_settlements',
  {
    id: id(),
    workingCapitalItemId: bigint('working_capital_item_id', { mode: 'number' })
      .notNull()
      .references(() => workingCapitalItems.id, { onDelete: 'restrict' }),
    businessDate: date('business_date').notNull(),
    amount: money('amount').notNull(),
    cashAccountId: bigint('cash_account_id', { mode: 'number' }).references(() => cashAccounts.id, {
      onDelete: 'restrict',
    }),
    reference: text('reference'),
    createdByUserId: actor('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('working_capital_settlements_item_idx').on(t.workingCapitalItemId, t.businessDate),
    check('working_capital_settlements_amount_check', sql`${t.amount} > 0`),
  ]
);

export const financialForecasts = pgTable(
  'financial_forecasts',
  {
    id: id(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    revenue: money('revenue').notNull(),
    grossProfit: money('gross_profit').notNull(),
    netProfit: money('net_profit').notNull(),
    cashBalance: money('cash_balance').notNull(),
    confidence: text('confidence').notNull().default('medium'),
    assumptions: text('assumptions'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('financial_forecasts_period_uidx').on(t.periodStart, t.periodEnd),
    check('financial_forecasts_period_check', sql`${t.periodEnd} >= ${t.periodStart}`),
    check('financial_forecasts_confidence_check', sql`${t.confidence} in ('low', 'medium', 'high')`),
  ]
);

export const marketingCampaignReports = pgTable(
  'marketing_campaign_reports',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    name: text('name').notNull(),
    brandId: bigint('brand_id', { mode: 'number' })
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict' }),
    platform: text('platform').notNull(),
    reach: integer('reach').notNull().default(0),
    engagement: integer('engagement').notNull().default(0),
    storeVisits: integer('store_visits').notNull().default(0),
    revenueInfluenced: money('revenue_influenced').notNull().default('0'),
    spend: money('spend').notNull().default('0'),
    status: text('status').notNull().default('active'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    index('marketing_campaigns_brand_date_idx').on(t.brandId, t.businessDate),
    index('marketing_campaigns_status_idx').on(t.status, t.businessDate),
    check(
      'marketing_campaigns_counts_check',
      sql`${t.reach} >= 0 and ${t.engagement} >= 0 and ${t.storeVisits} >= 0`
    ),
    check('marketing_campaigns_amounts_check', sql`${t.revenueInfluenced} >= 0 and ${t.spend} >= 0`),
    check('marketing_campaigns_status_check', sql`${t.status} in ('planned', 'active', 'paused', 'completed')`),
  ]
);

export const leadMetrics = pgTable(
  'lead_metrics',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    channel: text('channel').notNull(),
    campaignReportId: bigint('campaign_report_id', { mode: 'number' }).references(() => marketingCampaignReports.id, {
      onDelete: 'set null',
    }),
    leadCount: integer('lead_count').notNull(),
    qualifiedCount: integer('qualified_count').notNull().default(0),
    convertedCount: integer('converted_count').notNull().default(0),
    averageValue: money('average_value'),
    notes: text('notes'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    index('lead_metrics_date_channel_idx').on(t.businessDate, t.channel),
    index('lead_metrics_campaign_idx').on(t.campaignReportId),
    check(
      'lead_metrics_counts_check',
      sql`${t.leadCount} >= 0 and ${t.qualifiedCount} >= 0 and ${t.convertedCount} >= 0 and ${t.qualifiedCount} <= ${t.leadCount} and ${t.convertedCount} <= ${t.qualifiedCount}`
    ),
    check('lead_metrics_average_value_check', sql`${t.averageValue} is null or ${t.averageValue} >= 0`),
  ]
);

export const socialMetrics = pgTable(
  'social_metrics',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    platform: text('platform').notNull(),
    brandId: bigint('brand_id', { mode: 'number' }).references(() => brands.id, { onDelete: 'restrict' }),
    followers: integer('followers').notNull().default(0),
    posts: integer('posts').notNull().default(0),
    reels: integer('reels').notNull().default(0),
    stories: integer('stories').notNull().default(0),
    reach: integer('reach').notNull().default(0),
    impressions: integer('impressions').notNull().default(0),
    engagement: integer('engagement').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    websiteVisits: integer('website_visits').notNull().default(0),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('social_metrics_date_platform_brand_uidx')
      .on(t.businessDate, t.platform, t.brandId)
      .where(sql`${t.brandId} is not null`),
    uniqueIndex('social_metrics_date_platform_group_uidx')
      .on(t.businessDate, t.platform)
      .where(sql`${t.brandId} is null`),
    index('social_metrics_date_platform_idx').on(t.businessDate, t.platform),
    index('social_metrics_brand_idx').on(t.brandId, t.businessDate),
    check(
      'social_metrics_counts_check',
      sql`${t.followers} >= 0 and ${t.posts} >= 0 and ${t.reels} >= 0 and ${t.stories} >= 0 and ${t.reach} >= 0 and ${t.impressions} >= 0 and ${t.engagement} >= 0 and ${t.clicks} >= 0 and ${t.websiteVisits} >= 0`
    ),
  ]
);

export const clientelingActivities = pgTable(
  'clienteling_activities',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    type: text('type').notNull(),
    storeId: bigint('store_id', { mode: 'number' }).references(() => stores.id, { onDelete: 'restrict' }),
    contacted: integer('contacted').notNull(),
    responses: integer('responses').notNull().default(0),
    appointments: integer('appointments').notNull().default(0),
    estimatedRevenue: money('estimated_revenue').notNull().default('0'),
    notes: text('notes'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('clienteling_date_type_store_uidx')
      .on(t.businessDate, t.type, t.storeId)
      .where(sql`${t.storeId} is not null`),
    uniqueIndex('clienteling_date_type_group_uidx')
      .on(t.businessDate, t.type)
      .where(sql`${t.storeId} is null`),
    index('clienteling_store_date_idx').on(t.storeId, t.businessDate),
    check(
      'clienteling_counts_check',
      sql`${t.contacted} >= 0 and ${t.responses} >= 0 and ${t.appointments} >= 0 and ${t.responses} <= ${t.contacted} and ${t.appointments} <= ${t.responses}`
    ),
    check('clienteling_revenue_check', sql`${t.estimatedRevenue} >= 0`),
  ]
);

export const customerFeedback = pgTable(
  'customer_feedback',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    source: text('source').notNull(),
    type: text('type').notNull(),
    category: text('category'),
    npsScore: integer('nps_score'),
    recommendation: text('recommendation'),
    frequency: text('frequency'),
    detail: text('detail').notNull(),
    storeId: bigint('store_id', { mode: 'number' }).references(() => stores.id, { onDelete: 'restrict' }),
    brandId: bigint('brand_id', { mode: 'number' }).references(() => brands.id, { onDelete: 'restrict' }),
    contactName: text('contact_name'),
    contactValue: text('contact_value'),
    contactConsent: boolean('contact_consent').notNull().default(false),
    retentionUntil: date('retention_until'),
    contactRedactedAt: timestamp('contact_redacted_at', { withTimezone: true }),
    capturedByUserId: integer('captured_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('customer_feedback_date_store_idx').on(t.businessDate, t.storeId),
    index('customer_feedback_brand_idx').on(t.brandId, t.businessDate),
    index('customer_feedback_type_idx').on(t.type, t.businessDate),
    index('customer_feedback_retention_idx')
      .on(t.retentionUntil)
      .where(sql`${t.contactName} is not null or ${t.contactValue} is not null`),
    check('customer_feedback_nps_score_check', sql`${t.npsScore} is null or ${t.npsScore} between 0 and 10`),
    check(
      'customer_feedback_recommendation_check',
      sql`${t.recommendation} is null or ${t.recommendation} in ('yes', 'likely', 'no')`
    ),
    check(
      'customer_feedback_contact_consent_check',
      sql`${t.contactValue} is null or (${t.contactConsent} = true and ${t.retentionUntil} is not null)`
    ),
    check(
      'customer_feedback_contact_retention_check',
      sql`(${t.contactName} is null and ${t.contactValue} is null) or (${t.contactConsent} = true and ${t.retentionUntil} is not null)`
    ),
  ]
);

export const storeStandardReviews = pgTable(
  'store_standard_reviews',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    operationsScore: integer('operations_score').notNull(),
    vmScore: integer('vm_score').notNull(),
    readinessScore: integer('readiness_score').notNull(),
    customerExperienceScore: integer('customer_experience_score').notNull(),
    cleanlinessScore: integer('cleanliness_score').notNull(),
    safetyScore: integer('safety_score').notNull(),
    issues: text('issues'),
    reviewedByUserId: actor('reviewed_by_user_id'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('store_standard_reviews_store_date_uidx').on(t.storeId, t.businessDate),
    index('store_standard_reviews_store_date_idx').on(t.storeId, t.businessDate),
    check(
      'store_standard_reviews_scores_check',
      sql`${t.operationsScore} between 0 and 100 and ${t.vmScore} between 0 and 100 and ${t.readinessScore} between 0 and 100 and ${t.customerExperienceScore} between 0 and 100 and ${t.cleanlinessScore} between 0 and 100 and ${t.safetyScore} between 0 and 100`
    ),
  ]
);

export const visualMerchandisingReviews = pgTable(
  'visual_merchandising_reviews',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    windowDisplayScore: integer('window_display_score').notNull(),
    mannequinScore: integer('mannequin_score').notNull(),
    productPresentationScore: integer('product_presentation_score').notNull(),
    sizeArrangementScore: integer('size_arrangement_score').notNull(),
    improvements: text('improvements'),
    reviewedByUserId: actor('reviewed_by_user_id'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vm_reviews_store_date_uidx').on(t.storeId, t.businessDate),
    index('vm_reviews_store_date_idx').on(t.storeId, t.businessDate),
    check(
      'vm_reviews_scores_check',
      sql`${t.windowDisplayScore} between 0 and 100 and ${t.mannequinScore} between 0 and 100 and ${t.productPresentationScore} between 0 and 100 and ${t.sizeArrangementScore} between 0 and 100`
    ),
  ]
);

export const storeExperienceReviews = pgTable(
  'store_experience_reviews',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    category: text('category').notNull(),
    rating: integer('rating').notNull(),
    npsScore: integer('nps_score'),
    recommendation: text('recommendation'),
    comments: text('comments'),
    reviewedByUserId: actor('reviewed_by_user_id'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('store_experience_reviews_store_date_category_uidx').on(t.storeId, t.businessDate, t.category),
    index('store_experience_reviews_store_date_idx').on(t.storeId, t.businessDate),
    check('store_experience_reviews_rating_check', sql`${t.rating} between 1 and 5`),
    check('store_experience_reviews_nps_check', sql`${t.npsScore} is null or ${t.npsScore} between 0 and 10`),
    check(
      'store_experience_reviews_recommendation_check',
      sql`${t.recommendation} is null or ${t.recommendation} in ('yes', 'likely', 'no')`
    ),
  ]
);

export const maintenanceRequests = pgTable(
  'maintenance_requests',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    category: text('category').notNull(),
    priority: text('priority').notNull().default('medium'),
    description: text('description').notNull(),
    assignedToUserId: integer('assigned_to_user_id').references(() => users.id, { onDelete: 'restrict' }),
    assignedToName: text('assigned_to_name'),
    estimatedCost: money('estimated_cost'),
    dueDate: date('due_date'),
    status: text('status').notNull().default('open'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    reportedByUserId: actor('reported_by_user_id'),
    updatedByUserId: actor('updated_by_user_id'),
    ...timestamps(),
  },
  (t) => [
    index('maintenance_store_status_idx').on(t.storeId, t.status, t.dueDate),
    index('maintenance_assignee_status_idx').on(t.assignedToUserId, t.status),
    check('maintenance_priority_check', sql`${t.priority} in ('low', 'medium', 'high', 'critical')`),
    check('maintenance_status_check', sql`${t.status} in ('open', 'in-progress', 'blocked', 'completed', 'cancelled')`),
    check('maintenance_cost_check', sql`${t.estimatedCost} is null or ${t.estimatedCost} >= 0`),
  ]
);

export const incidents = pgTable(
  'incidents',
  {
    id: id(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    type: text('type').notNull(),
    severity: text('severity').notNull(),
    description: text('description').notNull(),
    immediateAction: text('immediate_action'),
    followUpRequired: boolean('follow_up_required').notNull().default(false),
    status: text('status').notNull().default('open'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    reportedByUserId: actor('reported_by_user_id'),
    updatedByUserId: actor('updated_by_user_id'),
    ...timestamps(),
  },
  (t) => [
    index('incidents_store_status_idx').on(t.storeId, t.status, t.occurredAt),
    index('incidents_severity_status_idx').on(t.severity, t.status),
    check('incidents_severity_check', sql`${t.severity} in ('low', 'medium', 'high', 'critical')`),
    check('incidents_status_check', sql`${t.status} in ('open', 'investigating', 'resolved', 'closed')`),
  ]
);

export const sopReviews = pgTable(
  'sop_reviews',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    area: text('area').notNull(),
    complianceScore: integer('compliance_score').notNull(),
    deviations: text('deviations'),
    correctiveAction: text('corrective_action'),
    reviewedByUserId: actor('reviewed_by_user_id'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('sop_reviews_store_date_area_uidx').on(t.storeId, t.businessDate, t.area),
    index('sop_reviews_store_date_idx').on(t.storeId, t.businessDate),
    index('sop_reviews_area_date_idx').on(t.area, t.businessDate),
    check('sop_reviews_score_check', sql`${t.complianceScore} between 0 and 100`),
  ]
);

export const peopleSnapshots = pgTable(
  'people_snapshots',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    staffTotal: integer('staff_total').notNull(),
    staffPresent: integer('staff_present').notNull(),
    punctualityScore: integer('punctuality_score').notNull(),
    trainingCompletionScore: integer('training_completion_score').notNull(),
    absenceReason: text('absence_reason'),
    notes: text('notes'),
    recordedByUserId: actor('recorded_by_user_id'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('people_snapshots_store_date_uidx').on(t.storeId, t.businessDate),
    check(
      'people_snapshots_counts_check',
      sql`${t.staffTotal} >= 0 and ${t.staffPresent} >= 0 and ${t.staffPresent} <= ${t.staffTotal}`
    ),
    check(
      'people_snapshots_scores_check',
      sql`${t.punctualityScore} between 0 and 100 and ${t.trainingCompletionScore} between 0 and 100`
    ),
  ]
);

export const brandHealthAssessments = pgTable(
  'brand_health_assessments',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    brandId: bigint('brand_id', { mode: 'number' })
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict' }),
    type: text('type').notNull(),
    awarenessScore: integer('awareness_score').notNull(),
    considerationScore: integer('consideration_score').notNull(),
    preferenceScore: integer('preference_score').notNull(),
    satisfactionScore: integer('satisfaction_score').notNull(),
    loyaltyScore: integer('loyalty_score').notNull(),
    advocacyScore: integer('advocacy_score').notNull(),
    momentumScore: integer('momentum_score').notNull(),
    overallOverride: integer('overall_override'),
    overrideReason: text('override_reason'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('brand_health_brand_date_type_uidx').on(t.brandId, t.businessDate, t.type),
    check(
      'brand_health_scores_check',
      sql`${t.awarenessScore} between 0 and 100 and ${t.considerationScore} between 0 and 100 and ${t.preferenceScore} between 0 and 100 and ${t.satisfactionScore} between 0 and 100 and ${t.loyaltyScore} between 0 and 100 and ${t.advocacyScore} between 0 and 100 and ${t.momentumScore} between 0 and 100 and (${t.overallOverride} is null or ${t.overallOverride} between 0 and 100)`
    ),
    check(
      'brand_health_override_reason_check',
      sql`${t.overallOverride} is null or ${t.overrideReason} is not null`
    ),
  ]
);

export const brandSentimentSnapshots = pgTable(
  'brand_sentiment_snapshots',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    brandId: bigint('brand_id', { mode: 'number' })
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict' }),
    source: text('source').notNull(),
    positiveMentions: integer('positive_mentions').notNull().default(0),
    neutralMentions: integer('neutral_mentions').notNull().default(0),
    negativeMentions: integer('negative_mentions').notNull().default(0),
    positiveTheme: text('positive_theme'),
    negativeTheme: text('negative_theme'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('brand_sentiment_brand_date_source_uidx').on(t.brandId, t.businessDate, t.source),
    check(
      'brand_sentiment_counts_check',
      sql`${t.positiveMentions} >= 0 and ${t.neutralMentions} >= 0 and ${t.negativeMentions} >= 0`
    ),
  ]
);

export const competitorActivities = pgTable(
  'competitor_activities',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    competitor: text('competitor').notNull(),
    brandId: bigint('brand_id', { mode: 'number' }).references(() => brands.id, { onDelete: 'restrict' }),
    shareOfVoice: percentage('share_of_voice'),
    activityType: text('activity_type'),
    description: text('description').notNull(),
    threatLevel: text('threat_level').notNull().default('medium'),
    recommendedResponse: text('recommended_response'),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    index('competitor_activities_date_threat_idx').on(t.businessDate, t.threatLevel),
    index('competitor_activities_brand_idx').on(t.brandId, t.businessDate),
    check('competitor_share_of_voice_check', sql`${t.shareOfVoice} is null or ${t.shareOfVoice} between 0 and 100`),
    check('competitor_threat_level_check', sql`${t.threatLevel} in ('low', 'medium', 'high', 'critical')`),
  ]
);

export const digitalReputationSnapshots = pgTable(
  'digital_reputation_snapshots',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    brandId: bigint('brand_id', { mode: 'number' }).references(() => brands.id, { onDelete: 'restrict' }),
    googleRating: numeric('google_rating', { precision: 3, scale: 2 }),
    googleReviewCount: integer('google_review_count').notNull().default(0),
    instagramSentiment: percentage('instagram_sentiment'),
    instagramFollowers: integer('instagram_followers').notNull().default(0),
    responseRate: percentage('response_rate'),
    averageResponseHours: numeric('average_response_hours', { precision: 8, scale: 2 }),
    nps: integer('nps'),
    trustpilotRating: numeric('trustpilot_rating', { precision: 3, scale: 2 }),
    newReviews: integer('new_reviews').notNull().default(0),
    negativeReviews: integer('negative_reviews').notNull().default(0),
    ...actors(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('digital_reputation_date_brand_uidx')
      .on(t.businessDate, t.brandId)
      .where(sql`${t.brandId} is not null`),
    uniqueIndex('digital_reputation_date_group_uidx')
      .on(t.businessDate)
      .where(sql`${t.brandId} is null`),
    index('digital_reputation_brand_date_idx').on(t.brandId, t.businessDate),
    check(
      'digital_reputation_ratings_check',
      sql`(${t.googleRating} is null or ${t.googleRating} between 0 and 5) and (${t.trustpilotRating} is null or ${t.trustpilotRating} between 0 and 5)`
    ),
    check(
      'digital_reputation_percentages_check',
      sql`(${t.instagramSentiment} is null or ${t.instagramSentiment} between 0 and 100) and (${t.responseRate} is null or ${t.responseRate} between 0 and 100)`
    ),
    check('digital_reputation_nps_check', sql`${t.nps} is null or ${t.nps} between -100 and 100`),
    check(
      'digital_reputation_counts_check',
      sql`${t.googleReviewCount} >= 0 and ${t.instagramFollowers} >= 0 and ${t.newReviews} >= 0 and ${t.negativeReviews} >= 0`
    ),
    check(
      'digital_reputation_response_time_check',
      sql`${t.averageResponseHours} is null or ${t.averageResponseHours} >= 0`
    ),
  ]
);

export const weeklyReviewCategoryNotes = pgTable(
  'weekly_review_category_notes',
  {
    id: id(),
    weeklyReviewId: bigint('weekly_review_id', { mode: 'number' })
      .notNull()
      .references(() => weeklyReviews.id, { onDelete: 'cascade' }),
    categoryId: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    performanceComment: text('performance_comment'),
    overstocked: boolean('overstocked').notNull().default(false),
    slowMoving: boolean('slow_moving').notNull().default(false),
    weeksWithoutMovement: integer('weeks_without_movement'),
    valueAtRisk: money('value_at_risk'),
    correctiveAction: text('corrective_action'),
    managerComment: text('manager_comment'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('weekly_review_category_notes_review_category_uidx').on(t.weeklyReviewId, t.categoryId),
    index('weekly_review_category_notes_category_idx').on(t.categoryId),
    check(
      'weekly_review_category_notes_risk_check',
      sql`(${t.weeksWithoutMovement} is null or ${t.weeksWithoutMovement} >= 0) and (${t.valueAtRisk} is null or ${t.valueAtRisk} >= 0)`
    ),
  ]
);

export type PerformanceTarget = typeof performanceTargets.$inferSelect;
export type ActionItem = typeof actionItems.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type CustomerFeedback = typeof customerFeedback.$inferSelect;
