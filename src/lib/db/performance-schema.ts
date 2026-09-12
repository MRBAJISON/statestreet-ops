import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  products,
  storeGroups,
  stores,
  dailyReports,
} from './foundation-schema';
import { users } from './schema';
const id = () =>
  bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey();
const store = () =>
  bigint('store_id', { mode: 'number' })
    .notNull()
    .references(() => stores.id);
const product = () =>
  bigint('product_id', { mode: 'number' })
    .notNull()
    .references(() => products.id);
const time = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const stockHistoryBaselines = pgTable(
  'stock_history_baselines',
  {
    storeId: store(),
    productId: product(),
    asOfDate: date('as_of_date').notNull(),
    quantity: integer('quantity').notNull(),
    lots: jsonb('lots').notNull().default([]),
    assignedReceiptDate: date('assigned_receipt_date')
      .notNull()
      .default('2026-07-01'),
    createdAt: time('created_at'),
  },
  (t) => [
    primaryKey({ columns: [t.storeId, t.productId] }),
    check('stock_history_baselines_quantity_check', sql`${t.quantity} >= 0`),
  ]
);
export const stockHistoryEvents = pgTable(
  'stock_history_events',
  {
    id: id(),
    sourceKey: text('source_key').notNull().unique(),
    storeId: store(),
    productId: product(),
    businessDate: date('business_date').notNull(),
    quantity: integer('quantity').notNull(),
    requestedQuantity: integer('requested_quantity').notNull(),
    kind: text('kind').notNull(),
    receiptDate: date('receipt_date'),
    transferKey: text('transfer_key'),
    createdAt: time('created_at'),
  },
  (t) => [
    index('stock_history_scope_date_idx').on(
      t.storeId,
      t.productId,
      t.businessDate,
      t.id
    ),
  ]
);
export const dailyReportStockSettlements = pgTable(
  'daily_report_stock_settlements',
  {
    dailyReportId: bigint('daily_report_id', { mode: 'number' })
      .notNull()
      .references(() => dailyReports.id, { onDelete: 'cascade' }),
    productId: product(),
    units: integer('units').notNull(),
    appliedUnits: integer('applied_units').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.dailyReportId, t.productId] })]
);
export const monthlyReviews = pgTable(
  'monthly_reviews',
  {
    id: id(),
    storeId: bigint('store_id', { mode: 'number' }).references(() => stores.id),
    groupId: bigint('group_id', { mode: 'number' }).references(
      () => storeGroups.id
    ),
    month: date('month').notNull(),
    status: text('status').notNull().default('draft'),
    executiveSummary: text('executive_summary').notNull().default(''),
    generatedSummary: text('generated_summary').notNull().default(''),
    sourceHash: text('source_hash'),
    sourceReferences: jsonb('source_references').notNull().default([]),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    managementOutcomes: text('management_outcomes').notNull().default(''),
    operationalAssessment: text('operational_assessment').notNull().default(''),
    conclusion: text('conclusion').notNull().default(''),
    storeComments: jsonb('store_comments').notNull().default({}),
    lockVersion: integer('lock_version').notNull().default(1),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    updatedByUserId: integer('updated_by_user_id')
      .notNull()
      .references(() => users.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: time('created_at'),
    updatedAt: time('updated_at'),
  },
  (t) => [
    unique().on(t.storeId, t.month),
    unique().on(t.groupId, t.month),
    check('monthly_reviews_month_check', sql`extract(day from ${t.month})=1`),
    check(
      'monthly_reviews_status_check',
      sql`${t.status} in ('draft','submitted')`
    ),
    check(
      'monthly_reviews_scope_check',
      sql`(${t.storeId} is not null)::integer + (${t.groupId} is not null)::integer = 1`
    ),
  ]
);
export const monthlyReviewAdvisors = pgTable(
  'monthly_review_advisors',
  {
    id: id(),
    monthlyReviewId: bigint('monthly_review_id', { mode: 'number' })
      .notNull()
      .references(() => monthlyReviews.id, { onDelete: 'cascade' }),
    storeId: store(),
    name: text('name').notNull(),
    actualSales: numeric('actual_sales', { precision: 14, scale: 2 }).notNull(),
    target: numeric('target', { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    index('monthly_review_advisors_review_idx').on(t.monthlyReviewId),
    check(
      'monthly_review_advisors_actual_sales_check',
      sql`${t.actualSales}>=0`
    ),
    check('monthly_review_advisors_target_check', sql`${t.target}>=0`),
  ]
);
export const monthlyReviewActions = pgTable(
  'monthly_review_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    monthlyReviewId: bigint('monthly_review_id', { mode: 'number' })
      .notNull()
      .references(() => monthlyReviews.id, { onDelete: 'restrict' }),
    storeId: bigint('store_id', { mode: 'number' }).references(() => stores.id),
    action: text('action').notNull(),
    outcome: text('outcome').notNull(),
    ownerName: text('owner_name').notNull(),
    dueDate: date('due_date').notNull(),
    goal: text('goal').notNull(),
    status: text('status').notNull().default('open'),
    progress: text('progress').notNull().default(''),
    updatedAt: time('updated_at'),
  },
  (t) => [
    index('monthly_review_actions_review_idx').on(t.monthlyReviewId),
    check(
      'monthly_review_actions_status_check',
      sql`${t.status} in ('open','in-progress','completed','cancelled')`
    ),
  ]
);
export const monthlyReviewActionLinks = pgTable(
  'monthly_review_action_links',
  {
    monthlyReviewId: bigint('monthly_review_id', { mode: 'number' })
      .notNull()
      .references(() => monthlyReviews.id, { onDelete: 'cascade' }),
    actionId: uuid('action_id')
      .notNull()
      .references(() => monthlyReviewActions.id, { onDelete: 'restrict' }),
  },
  (t) => [primaryKey({ columns: [t.monthlyReviewId, t.actionId] })]
);
