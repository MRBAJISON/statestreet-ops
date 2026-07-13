import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
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
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { entries, users } from './schema';

const id = (name = 'id') => bigint(name, { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey();
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stores = pgTable(
  'stores',
  {
    id: id(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull().default('store'),
    active: boolean('active').notNull().default(true),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('stores_code_lower_uidx').on(sql`lower(${t.code})`),
    check('stores_type_check', sql`${t.type} in ('store', 'warehouse', 'office')`),
  ]
);

export const brands = pgTable(
  'brands',
  {
    id: id(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex('brands_code_lower_uidx').on(sql`lower(${t.code})`)]
);

export const brandStores = pgTable(
  'brand_stores',
  {
    brandId: bigint('brand_id', { mode: 'number' })
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.brandId, t.storeId], name: 'brand_stores_pk' }),
    index('brand_stores_store_idx').on(t.storeId),
  ]
);

export const categories = pgTable(
  'categories',
  {
    id: id(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex('categories_code_lower_uidx').on(sql`lower(${t.code})`)]
);

export const brandCategories = pgTable(
  'brand_categories',
  {
    brandId: bigint('brand_id', { mode: 'number' })
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    categoryId: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.brandId, t.categoryId], name: 'brand_categories_pk' }),
    index('brand_categories_category_idx').on(t.categoryId),
  ]
);

export const subcategories = pgTable(
  'subcategories',
  {
    id: id(),
    categoryId: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('subcategories_category_code_lower_uidx').on(t.categoryId, sql`lower(${t.code})`),
    index('subcategories_category_idx').on(t.categoryId),
  ]
);

export const suppliers = pgTable(
  'suppliers',
  {
    id: id(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex('suppliers_code_lower_uidx').on(sql`lower(${t.code})`)]
);

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: id(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex('payment_methods_code_lower_uidx').on(sql`lower(${t.code})`)]
);

export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: id(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    group: text('group').notNull(),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('expense_categories_code_lower_uidx').on(sql`lower(${t.code})`),
    check('expense_categories_group_check', sql`${t.group} in ('operating', 'capital', 'below-line')`),
  ]
);

export const products = pgTable(
  'products',
  {
    id: id(),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    brandId: bigint('brand_id', { mode: 'number' })
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict' }),
    categoryId: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    subcategoryId: bigint('subcategory_id', { mode: 'number' }).references(() => subcategories.id, {
      onDelete: 'restrict',
    }),
    size: text('size'),
    color: text('color'),
    unitCost: money('unit_cost'),
    sellingPrice: money('selling_price'),
    active: boolean('active').notNull().default(true),
    createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    updatedByUserId: integer('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('products_sku_lower_uidx').on(sql`lower(${t.sku})`),
    index('products_brand_idx').on(t.brandId),
    index('products_category_idx').on(t.categoryId),
    index('products_subcategory_idx').on(t.subcategoryId),
    index('products_created_by_idx').on(t.createdByUserId),
    index('products_updated_by_idx').on(t.updatedByUserId),
    check('products_unit_cost_check', sql`${t.unitCost} is null or ${t.unitCost} >= 0`),
    check('products_selling_price_check', sql`${t.sellingPrice} is null or ${t.sellingPrice} >= 0`),
  ]
);

export const dailyReports = pgTable(
  'daily_reports',
  {
    id: id(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    businessDate: date('business_date').notNull(),
    status: text('status').notNull().default('draft'),
    transactions: integer('transactions').notNull().default(0),
    footfall: integer('footfall').notNull().default(0),
    totalCustomers: integer('total_customers').notNull().default(0),
    newCustomers: integer('new_customers').notNull().default(0),
    returningCustomers: integer('returning_customers').notNull().default(0),
    notes: text('notes'),
    lockVersion: integer('lock_version').notNull().default(1),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: integer('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    submittedByUserId: integer('submitted_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedByUserId: integer('approved_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('daily_reports_store_date_uidx').on(t.storeId, t.businessDate),
    index('daily_reports_date_status_idx').on(t.businessDate, t.status),
    index('daily_reports_created_by_idx').on(t.createdByUserId),
    index('daily_reports_updated_by_idx').on(t.updatedByUserId),
    index('daily_reports_submitted_by_idx').on(t.submittedByUserId),
    index('daily_reports_approved_by_idx').on(t.approvedByUserId),
    check('daily_reports_status_check', sql`${t.status} in ('draft', 'submitted', 'approved')`),
    check(
      'daily_reports_counts_check',
      sql`${t.transactions} >= 0 and ${t.footfall} >= 0 and ${t.totalCustomers} >= 0 and ${t.newCustomers} >= 0 and ${t.returningCustomers} >= 0`
    ),
    check(
      'daily_reports_customer_breakdown_check',
      sql`${t.newCustomers} + ${t.returningCustomers} <= ${t.totalCustomers}`
    ),
    check('daily_reports_lock_version_check', sql`${t.lockVersion} > 0`),
  ]
);

export const dailySalesLines = pgTable(
  'daily_sales_lines',
  {
    id: id(),
    dailyReportId: bigint('daily_report_id', { mode: 'number' })
      .notNull()
      .references(() => dailyReports.id, { onDelete: 'cascade' }),
    categoryId: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    openingStock: integer('opening_stock').notNull().default(0),
    unitsSold: integer('units_sold').notNull().default(0),
    grossRevenue: money('gross_revenue').notNull(),
    cogs: money('cogs').notNull(),
    discounts: money('discounts').notNull().default('0'),
    returns: money('returns').notNull().default('0'),
    creditSales: money('credit_sales').notNull().default('0'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('daily_sales_lines_report_category_uidx').on(t.dailyReportId, t.categoryId),
    index('daily_sales_lines_category_idx').on(t.categoryId),
    check('daily_sales_lines_counts_check', sql`${t.openingStock} >= 0 and ${t.unitsSold} >= 0`),
    check(
      'daily_sales_lines_amounts_check',
      sql`${t.grossRevenue} >= 0 and ${t.cogs} >= 0 and ${t.discounts} >= 0 and ${t.returns} >= 0 and ${t.creditSales} >= 0`
    ),
    check('daily_sales_lines_deductions_check', sql`${t.discounts} + ${t.returns} <= ${t.grossRevenue}`),
    check('daily_sales_lines_credit_check', sql`${t.creditSales} <= ${t.grossRevenue} - ${t.discounts} - ${t.returns}`),
  ]
);

export const dailyPaymentLines = pgTable(
  'daily_payment_lines',
  {
    id: id(),
    dailyReportId: bigint('daily_report_id', { mode: 'number' })
      .notNull()
      .references(() => dailyReports.id, { onDelete: 'cascade' }),
    paymentMethodId: bigint('payment_method_id', { mode: 'number' })
      .notNull()
      .references(() => paymentMethods.id, { onDelete: 'restrict' }),
    amount: money('amount').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('daily_payment_lines_report_method_uidx').on(t.dailyReportId, t.paymentMethodId),
    index('daily_payment_lines_method_idx').on(t.paymentMethodId),
    check('daily_payment_lines_amount_check', sql`${t.amount} >= 0`),
  ]
);

export const dailyReportLegacyEntries = pgTable(
  'daily_report_legacy_entries',
  {
    dailyReportId: bigint('daily_report_id', { mode: 'number' })
      .notNull()
      .references(() => dailyReports.id, { onDelete: 'cascade' }),
    entryId: integer('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'restrict' }),
  },
  (t) => [
    primaryKey({ columns: [t.dailyReportId, t.entryId], name: 'daily_report_legacy_entries_pk' }),
    uniqueIndex('daily_report_legacy_entry_uidx').on(t.entryId),
  ]
);

export const goodsReceipts = pgTable(
  'goods_receipts',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    poNumber: text('po_number'),
    supplierId: bigint('supplier_id', { mode: 'number' })
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    receivingStoreId: bigint('receiving_store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('received'),
    notes: text('notes'),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: integer('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps(),
  },
  (t) => [
    index('goods_receipts_store_date_idx').on(t.receivingStoreId, t.businessDate),
    index('goods_receipts_supplier_idx').on(t.supplierId),
    index('goods_receipts_created_by_idx').on(t.createdByUserId),
    index('goods_receipts_updated_by_idx').on(t.updatedByUserId),
    check('goods_receipts_status_check', sql`${t.status} in ('draft', 'received', 'cancelled')`),
  ]
);

export const goodsReceiptLines = pgTable(
  'goods_receipt_lines',
  {
    id: id(),
    goodsReceiptId: bigint('goods_receipt_id', { mode: 'number' })
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: 'cascade' }),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitCost: money('unit_cost'),
    condition: text('condition').notNull().default('good'),
    discrepancy: text('discrepancy'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('goods_receipt_lines_receipt_product_uidx').on(t.goodsReceiptId, t.productId),
    index('goods_receipt_lines_product_idx').on(t.productId),
    check('goods_receipt_lines_quantity_check', sql`${t.quantity} > 0`),
    check('goods_receipt_lines_unit_cost_check', sql`${t.unitCost} is null or ${t.unitCost} >= 0`),
    check('goods_receipt_lines_condition_check', sql`${t.condition} in ('good', 'damaged', 'partial')`),
  ]
);

export const stockTransfers = pgTable(
  'stock_transfers',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    fromStoreId: bigint('from_store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    toStoreId: bigint('to_store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('requested'),
    reason: text('reason').notNull(),
    requestedByUserId: integer('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    authorizedByUserId: integer('authorized_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
    receivedByUserId: integer('received_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    index('stock_transfers_from_date_idx').on(t.fromStoreId, t.businessDate),
    index('stock_transfers_to_date_idx').on(t.toStoreId, t.businessDate),
    index('stock_transfers_status_idx').on(t.status),
    index('stock_transfers_requested_by_idx').on(t.requestedByUserId),
    index('stock_transfers_authorized_by_idx').on(t.authorizedByUserId),
    index('stock_transfers_received_by_idx').on(t.receivedByUserId),
    check('stock_transfers_store_check', sql`${t.fromStoreId} <> ${t.toStoreId}`),
    check(
      'stock_transfers_status_check',
      sql`${t.status} in ('requested', 'authorized', 'in-transit', 'received', 'cancelled')`
    ),
  ]
);

export const stockTransferLines = pgTable(
  'stock_transfer_lines',
  {
    id: id(),
    stockTransferId: bigint('stock_transfer_id', { mode: 'number' })
      .notNull()
      .references(() => stockTransfers.id, { onDelete: 'cascade' }),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitCost: money('unit_cost'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('stock_transfer_lines_transfer_product_uidx').on(t.stockTransferId, t.productId),
    index('stock_transfer_lines_product_idx').on(t.productId),
    check('stock_transfer_lines_quantity_check', sql`${t.quantity} > 0`),
    check('stock_transfer_lines_unit_cost_check', sql`${t.unitCost} is null or ${t.unitCost} >= 0`),
  ]
);

export const stockCounts = pgTable(
  'stock_counts',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('draft'),
    countedByUserId: integer('counted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    approvedByUserId: integer('approved_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    index('stock_counts_store_date_idx').on(t.storeId, t.businessDate),
    index('stock_counts_status_idx').on(t.status),
    index('stock_counts_counted_by_idx').on(t.countedByUserId),
    index('stock_counts_approved_by_idx').on(t.approvedByUserId),
    check('stock_counts_status_check', sql`${t.status} in ('draft', 'submitted', 'approved', 'cancelled')`),
  ]
);

export const stockCountLines = pgTable(
  'stock_count_lines',
  {
    id: id(),
    stockCountId: bigint('stock_count_id', { mode: 'number' })
      .notNull()
      .references(() => stockCounts.id, { onDelete: 'cascade' }),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    systemQuantity: integer('system_quantity').notNull(),
    physicalQuantity: integer('physical_quantity').notNull(),
    unitCost: money('unit_cost'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('stock_count_lines_count_product_uidx').on(t.stockCountId, t.productId),
    index('stock_count_lines_product_idx').on(t.productId),
    check('stock_count_lines_quantities_check', sql`${t.systemQuantity} >= 0 and ${t.physicalQuantity} >= 0`),
    check('stock_count_lines_unit_cost_check', sql`${t.unitCost} is null or ${t.unitCost} >= 0`),
  ]
);

export const replenishmentRequests = pgTable(
  'replenishment_requests',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    supplierId: bigint('supplier_id', { mode: 'number' }).references(() => suppliers.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('requested'),
    requestedByUserId: integer('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    index('replenishment_requests_store_date_idx').on(t.storeId, t.businessDate),
    index('replenishment_requests_supplier_idx').on(t.supplierId),
    index('replenishment_requests_status_idx').on(t.status),
    index('replenishment_requests_requested_by_idx').on(t.requestedByUserId),
    index('replenishment_requests_reviewed_by_idx').on(t.reviewedByUserId),
    check(
      'replenishment_requests_status_check',
      sql`${t.status} in ('requested', 'approved', 'ordered', 'fulfilled', 'rejected', 'cancelled')`
    ),
  ]
);

export const replenishmentRequestLines = pgTable(
  'replenishment_request_lines',
  {
    id: id(),
    replenishmentRequestId: bigint('replenishment_request_id', { mode: 'number' })
      .notNull()
      .references(() => replenishmentRequests.id, { onDelete: 'cascade' }),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    currentStock: integer('current_stock').notNull(),
    reorderQuantity: integer('reorder_quantity').notNull(),
    urgency: text('urgency').notNull().default('normal'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('replenishment_lines_request_product_uidx').on(t.replenishmentRequestId, t.productId),
    index('replenishment_lines_product_idx').on(t.productId),
    check('replenishment_lines_quantities_check', sql`${t.currentStock} >= 0 and ${t.reorderQuantity} > 0`),
    check('replenishment_lines_urgency_check', sql`${t.urgency} in ('low', 'normal', 'high', 'critical')`),
  ]
);

export const importBatches = pgTable(
  'import_batches',
  {
    id: id(),
    type: text('type').notNull(),
    filename: text('filename').notNull(),
    status: text('status').notNull().default('pending'),
    totalRows: integer('total_rows').notNull().default(0),
    importedRows: integer('imported_rows').notNull().default(0),
    errorRows: integer('error_rows').notNull().default(0),
    summary: jsonb('summary').$type<Record<string, unknown>>(),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    undoneAt: timestamp('undone_at', { withTimezone: true }),
    undoneByUserId: integer('undone_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('import_batches_type_created_idx').on(t.type, t.createdAt),
    index('import_batches_created_by_idx').on(t.createdByUserId),
    index('import_batches_undone_by_idx').on(t.undoneByUserId),
    check('import_batches_status_check', sql`${t.status} in ('pending', 'running', 'completed', 'failed', 'undone')`),
    check(
      'import_batches_counts_check',
      sql`${t.totalRows} >= 0 and ${t.importedRows} >= 0 and ${t.errorRows} >= 0 and ${t.importedRows} + ${t.errorRows} <= ${t.totalRows}`
    ),
    check(
      'import_batches_undo_check',
      sql`(${t.status} = 'undone' and ${t.undoneAt} is not null and ${t.undoneByUserId} is not null) or (${t.status} <> 'undone' and ${t.undoneAt} is null and ${t.undoneByUserId} is null)`
    ),
  ]
);

export const importBatchRows = pgTable(
  'import_batch_rows',
  {
    id: id(),
    importBatchId: bigint('import_batch_id', { mode: 'number' })
      .notNull()
      .references(() => importBatches.id, { onDelete: 'restrict' }),
    sheet: text('sheet').notNull(),
    sourceRow: integer('source_row').notNull(),
    operation: text('operation').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: bigint('entity_id', { mode: 'number' }).notNull(),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>().notNull(),
    undoneAt: timestamp('undone_at', { withTimezone: true }),
    undoneByUserId: integer('undone_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('import_batch_rows_batch_sheet_row_uidx').on(t.importBatchId, t.sheet, t.sourceRow),
    index('import_batch_rows_entity_idx').on(t.entityType, t.entityId),
    index('import_batch_rows_undone_by_idx').on(t.undoneByUserId),
    check('import_batch_rows_source_row_check', sql`${t.sourceRow} >= 2`),
    check('import_batch_rows_sheet_check', sql`${t.sheet} in ('expenses', 'budget')`),
    check('import_batch_rows_operation_check', sql`${t.operation} in ('insert', 'update')`),
    check('import_batch_rows_entity_type_check', sql`${t.entityType} in ('expense', 'budget')`),
    check(
      'import_batch_rows_before_check',
      sql`(${t.operation} = 'insert' and ${t.before} is null) or (${t.operation} = 'update' and ${t.before} is not null)`
    ),
    check(
      'import_batch_rows_undo_check',
      sql`(${t.undoneAt} is null and ${t.undoneByUserId} is null) or (${t.undoneAt} is not null and ${t.undoneByUserId} is not null)`
    ),
  ]
);

export const expenses = pgTable(
  'expenses',
  {
    id: id(),
    businessDate: date('business_date').notNull(),
    expenseCategoryId: bigint('expense_category_id', { mode: 'number' })
      .notNull()
      .references(() => expenseCategories.id, { onDelete: 'restrict' }),
    storeId: bigint('store_id', { mode: 'number' }).references(() => stores.id, { onDelete: 'restrict' }),
    amount: money('amount').notNull(),
    vendor: text('vendor'),
    invoiceReference: text('invoice_reference'),
    paymentMethodId: bigint('payment_method_id', { mode: 'number' }).references(() => paymentMethods.id, {
      onDelete: 'restrict',
    }),
    importBatchId: bigint('import_batch_id', { mode: 'number' }).references(() => importBatches.id, {
      onDelete: 'restrict',
    }),
    importSourceRow: integer('import_source_row'),
    description: text('description').notNull(),
    overspendReason: text('overspend_reason'),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: integer('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps(),
  },
  (t) => [
    index('expenses_category_date_idx').on(t.expenseCategoryId, t.businessDate),
    index('expenses_store_date_idx').on(t.storeId, t.businessDate),
    index('expenses_payment_method_idx').on(t.paymentMethodId),
    uniqueIndex('expenses_import_batch_source_uidx').on(t.importBatchId, t.importSourceRow),
    index('expenses_created_by_idx').on(t.createdByUserId),
    index('expenses_updated_by_idx').on(t.updatedByUserId),
    check('expenses_amount_check', sql`${t.amount} > 0`),
    check(
      'expenses_import_source_check',
      sql`(${t.importBatchId} is null and ${t.importSourceRow} is null) or (${t.importBatchId} is not null and ${t.importSourceRow} >= 2)`
    ),
  ]
);

export const budgets = pgTable(
  'budgets',
  {
    id: id(),
    year: integer('year').notNull(),
    expenseCategoryId: bigint('expense_category_id', { mode: 'number' })
      .notNull()
      .references(() => expenseCategories.id, { onDelete: 'restrict' }),
    storeId: bigint('store_id', { mode: 'number' }).references(() => stores.id, { onDelete: 'restrict' }),
    amount: money('amount').notNull(),
    notes: text('notes'),
    importBatchId: bigint('import_batch_id', { mode: 'number' }).references(() => importBatches.id, {
      onDelete: 'restrict',
    }),
    importSourceRow: integer('import_source_row'),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: integer('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('budgets_store_year_category_uidx').on(t.storeId, t.year, t.expenseCategoryId),
    uniqueIndex('budgets_group_year_category_uidx')
      .on(t.year, t.expenseCategoryId)
      .where(sql`${t.storeId} is null`),
    index('budgets_category_idx').on(t.expenseCategoryId),
    uniqueIndex('budgets_import_batch_source_uidx').on(t.importBatchId, t.importSourceRow),
    index('budgets_created_by_idx').on(t.createdByUserId),
    index('budgets_updated_by_idx').on(t.updatedByUserId),
    check('budgets_year_check', sql`${t.year} between 2000 and 2200`),
    check('budgets_amount_check', sql`${t.amount} >= 0`),
    check(
      'budgets_import_source_check',
      sql`(${t.importBatchId} is null and ${t.importSourceRow} is null) or (${t.importBatchId} is not null and ${t.importSourceRow} >= 2)`
    ),
  ]
);

export const customers = pgTable(
  'customers',
  {
    id: id(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    phoneNormalized: text('phone_normalized').notNull(),
    occupation: text('occupation'),
    sizePreference: text('size_preference'),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedByUserId: integer('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('customers_phone_normalized_uidx').on(t.phoneNormalized),
    index('customers_created_by_idx').on(t.createdByUserId),
    index('customers_updated_by_idx').on(t.updatedByUserId),
  ]
);

export const customerInteractions = pgTable(
  'customer_interactions',
  {
    id: id(),
    customerId: bigint('customer_id', { mode: 'number' })
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    businessDate: date('business_date').notNull(),
    lifecycle: text('lifecycle').notNull(),
    source: text('source').notNull(),
    sourceDetail: text('source_detail'),
    productId: bigint('product_id', { mode: 'number' }).references(() => products.id, { onDelete: 'restrict' }),
    interestText: text('interest_text'),
    notes: text('notes'),
    capturedByUserId: integer('captured_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('customer_interactions_customer_date_idx').on(t.customerId, t.businessDate),
    index('customer_interactions_store_date_idx').on(t.storeId, t.businessDate),
    index('customer_interactions_product_idx').on(t.productId),
    index('customer_interactions_captured_by_idx').on(t.capturedByUserId),
    check('customer_interactions_lifecycle_check', sql`${t.lifecycle} in ('lead', 'buyer')`),
  ]
);

export const weeklyReviews = pgTable(
  'weekly_reviews',
  {
    id: id(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => stores.id, { onDelete: 'restrict' }),
    weekEnd: date('week_end').notNull(),
    status: text('status').notNull().default('draft'),
    summary: text('summary'),
    risks: text('risks'),
    opportunities: text('opportunities'),
    marketingAmplifyCategoryId: bigint('marketing_amplify_category_id', { mode: 'number' }).references(
      () => categories.id,
      { onDelete: 'restrict' }
    ),
    differentThisWeek: text('different_this_week'),
    firstThreeActions: text('first_three_actions'),
    lockVersion: integer('lock_version').notNull().default(1),
    submittedByUserId: integer('submitted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    approvedByUserId: integer('approved_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('weekly_reviews_store_week_uidx').on(t.storeId, t.weekEnd),
    index('weekly_reviews_week_status_idx').on(t.weekEnd, t.status),
    index('weekly_reviews_submitted_by_idx').on(t.submittedByUserId),
    index('weekly_reviews_approved_by_idx').on(t.approvedByUserId),
    index('weekly_reviews_amplify_category_idx').on(t.marketingAmplifyCategoryId),
    check('weekly_reviews_status_check', sql`${t.status} in ('draft', 'submitted', 'approved')`),
    check('weekly_reviews_lock_version_check', sql`${t.lockVersion} > 0`),
  ]
);

export const weeklyReviewActions = pgTable(
  'weekly_review_actions',
  {
    id: id(),
    weeklyReviewId: bigint('weekly_review_id', { mode: 'number' })
      .notNull()
      .references(() => weeklyReviews.id, { onDelete: 'cascade' }),
    categoryId: bigint('category_id', { mode: 'number' }).references(() => categories.id, { onDelete: 'restrict' }),
    productId: bigint('product_id', { mode: 'number' }).references(() => products.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    ownerUserId: integer('owner_user_id').references(() => users.id, { onDelete: 'restrict' }),
    ownerName: text('owner_name'),
    targetUnits: integer('target_units'),
    targetRevenue: money('target_revenue'),
    dueDate: date('due_date'),
    status: text('status').notNull().default('open'),
    managerComment: text('manager_comment'),
    ...timestamps(),
  },
  (t) => [
    index('weekly_review_actions_review_idx').on(t.weeklyReviewId),
    index('weekly_review_actions_owner_idx').on(t.ownerUserId),
    index('weekly_review_actions_category_idx').on(t.categoryId),
    index('weekly_review_actions_product_idx').on(t.productId),
    check('weekly_review_actions_target_units_check', sql`${t.targetUnits} is null or ${t.targetUnits} >= 0`),
    check('weekly_review_actions_target_revenue_check', sql`${t.targetRevenue} is null or ${t.targetRevenue} >= 0`),
    check('weekly_review_actions_status_check', sql`${t.status} in ('open', 'in-progress', 'completed', 'cancelled')`),
  ]
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: id(),
    entityType: text('entity_type').notNull(),
    entityId: bigint('entity_id', { mode: 'number' }).notNull(),
    action: text('action').notNull(),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_events_entity_idx').on(t.entityType, t.entityId, t.createdAt),
    index('audit_events_actor_idx').on(t.actorUserId, t.createdAt),
    check(
      'audit_events_action_check',
      sql`${t.action} in ('create', 'update', 'submit', 'approve', 'reopen', 'cancel', 'complete', 'archive', 'restore', 'import', 'settle', 'authorize', 'receive', 'undo')`
    ),
  ]
);

export type Store = typeof stores.$inferSelect;
export type Product = typeof products.$inferSelect;
export type DailyReport = typeof dailyReports.$inferSelect;
