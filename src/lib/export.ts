import ExcelJS from 'exceljs';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import type { SQLWrapper } from 'drizzle-orm';
import type { UserRole } from './types';

export type ExportScope = 'all' | 'finance' | 'commercial' | 'marketing' | 'inventory' | 'brand' | 'store';

export interface ExportDateRange {
  from?: string;
  to?: string;
}

export interface ExportScopeConfig {
  scope: ExportScope;
  label: string;
  description: string;
}

export type ExportSheetKey =
  | 'dailyReports'
  | 'payments'
  | 'expenses'
  | 'budgets'
  | 'cashTransactions'
  | 'workingCapital'
  | 'workingCapitalSettlements'
  | 'capitalSnapshots'
  | 'financialForecasts'
  | 'salesByCategory'
  | 'productInsights'
  | 'targets'
  | 'customerActivity'
  | 'campaigns'
  | 'leadMetrics'
  | 'socialMetrics'
  | 'clienteling'
  | 'customerFeedback'
  | 'products'
  | 'inventoryMovements'
  | 'goodsReceipts'
  | 'stockTransfers'
  | 'stockCounts'
  | 'replenishment'
  | 'inventoryDispositions'
  | 'brandHealth'
  | 'brandSentiment'
  | 'digitalReputation'
  | 'competitors'
  | 'weeklyReviews'
  | 'weeklyReviewActions'
  | 'actionItems'
  | 'storeStandards'
  | 'incidents'
  | 'peopleSnapshots';

export type ExportRow = Record<string, unknown>;

type ColumnFormat = 'currency' | 'integer' | 'decimal' | 'percent' | 'boolean' | 'datetime';
type SensitiveColumn = 'customer-contact' | 'unit-cost';

export interface ExportColumn {
  key: string;
  header: string;
  width: number;
  format?: ColumnFormat;
  sensitive?: SensitiveColumn;
}

export interface ExportSheetDefinition {
  key: ExportSheetKey;
  name: string;
  description: string;
  columns: ExportColumn[];
}

export interface ExportWorkbookInput {
  scope: ExportScope;
  range: ExportDateRange;
  rows: Partial<Record<ExportSheetKey, ExportRow[]>>;
  includeCustomerContacts: boolean;
  includeUnitCost: boolean;
  storeLabel?: string;
  generatedAt?: Date;
}

export interface LoadTypedExportInput {
  scope: ExportScope;
  range: ExportDateRange;
  includeCustomerContacts: boolean;
  includeUnitCost: boolean;
  storeId?: number;
}

const ROLE_SCOPE: Record<UserRole, ExportScopeConfig> = {
  owner: {
    scope: 'all',
    label: 'All departments',
    description: 'Executive and operational data across every typed reporting area.',
  },
  operations: {
    scope: 'all',
    label: 'All departments',
    description: 'Executive and operational data across every typed reporting area.',
  },
  finance: {
    scope: 'finance',
    label: 'Finance',
    description: 'Daily trading, payments, expenses, budgets, cash, and working capital.',
  },
  commercial: {
    scope: 'commercial',
    label: 'Commercial',
    description: 'Sales, category and product performance, targets, and customer capture.',
  },
  marketing: {
    scope: 'marketing',
    label: 'Marketing',
    description: 'Campaigns, leads, social performance, clienteling, and customer feedback.',
  },
  inventory: {
    scope: 'inventory',
    label: 'Inventory',
    description: 'Products, inventory movements, document summaries, and stock decisions.',
  },
  brand: {
    scope: 'brand',
    label: 'Brand',
    description: 'Brand health, sentiment, reputation, competitors, and customer feedback.',
  },
  'store-manager': {
    scope: 'store',
    label: 'Assigned store',
    description: 'Daily reports, sales, payments, reviews, transfers, and customer capture for your store.',
  },
};

export const EXPORT_SCOPE_LABELS: Record<ExportScope, string> = {
  all: 'All departments',
  finance: 'Finance',
  commercial: 'Commercial',
  marketing: 'Marketing',
  inventory: 'Inventory',
  brand: 'Brand',
  store: 'Assigned store',
};

const VALID_SCOPES = Object.keys(EXPORT_SCOPE_LABELS) as ExportScope[];

export function parseExportScope(value: string | null | undefined): ExportScope | null {
  return value && VALID_SCOPES.includes(value as ExportScope) ? (value as ExportScope) : null;
}

export function getExportScopeConfig(role: string): ExportScopeConfig | null {
  return Object.hasOwn(ROLE_SCOPE, role) ? ROLE_SCOPE[role as UserRole] : null;
}

export function canExportScope(role: string, scope: ExportScope): boolean {
  return getExportScopeConfig(role)?.scope === scope;
}

export function canIncludeCustomerContacts(role: string, scope: ExportScope): boolean {
  return (
    (role === 'commercial' && scope === 'commercial') ||
    (role === 'marketing' && scope === 'marketing') ||
    (role === 'store-manager' && scope === 'store')
  );
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function parseExportDateRange(params: Pick<URLSearchParams, 'get'>):
  | { range: ExportDateRange; error?: never }
  | { range?: never; error: string } {
  const from = params.get('from')?.trim() ?? '';
  const to = params.get('to')?.trim() ?? '';
  if (from && !isIsoDate(from)) return { error: 'from must be a valid YYYY-MM-DD date' };
  if (to && !isIsoDate(to)) return { error: 'to must be a valid YYYY-MM-DD date' };
  if (from && to && from > to) return { error: 'from cannot be after to' };
  return { range: { from: from || undefined, to: to || undefined } };
}

export function exportFilename(scope: ExportScope, range: ExportDateRange, now = new Date()): string {
  const slug: Record<ExportScope, string> = {
    all: 'all-departments',
    finance: 'finance',
    commercial: 'commercial',
    marketing: 'marketing',
    inventory: 'inventory',
    brand: 'brand',
    store: 'assigned-store',
  };
  const suffix =
    range.from || range.to
      ? `${range.from ?? 'start'}_to_${range.to ?? 'now'}`
      : now.toISOString().slice(0, 10);
  return `statestreet-${slug[scope]}-${suffix}.xlsx`;
}

const col = (
  key: string,
  header: string,
  width: number,
  format?: ColumnFormat,
  sensitive?: SensitiveColumn
): ExportColumn => ({ key, header, width, format, sensitive });

const SHEETS: Record<ExportSheetKey, Omit<ExportSheetDefinition, 'key'>> = {
  dailyReports: {
    name: 'Daily Reports',
    description: 'Typed daily trading summaries with sales and payment reconciliation.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeCode', 'Store Code', 14), col('storeName', 'Store', 24),
      col('status', 'Status', 12), col('transactions', 'Transactions', 14, 'integer'), col('footfall', 'Footfall', 12, 'integer'),
      col('totalCustomers', 'Customers', 12, 'integer'), col('newCustomers', 'New Customers', 15, 'integer'),
      col('returningCustomers', 'Returning Customers', 19, 'integer'), col('unitsSold', 'Units Sold', 12, 'integer'),
      col('grossRevenue', 'Gross Revenue', 16, 'currency'), col('discounts', 'Discounts', 14, 'currency'),
      col('returns', 'Returns', 14, 'currency'), col('netRevenue', 'Net Revenue', 16, 'currency'),
      col('cogs', 'COGS', 14, 'currency'), col('grossProfit', 'Gross Profit', 16, 'currency'),
      col('creditSales', 'Credit Sales', 15, 'currency'), col('paymentTotal', 'Payments', 15, 'currency'),
      col('paymentVariance', 'Payment Variance', 18, 'currency'), col('submittedAt', 'Submitted At', 21, 'datetime'),
      col('approvedAt', 'Approved At', 21, 'datetime'),
    ],
  },
  payments: {
    name: 'Payments',
    description: 'Payment-method lines attached to typed daily reports.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeCode', 'Store Code', 14), col('storeName', 'Store', 24),
      col('reportStatus', 'Report Status', 14), col('paymentMethod', 'Payment Method', 20), col('amount', 'Amount', 16, 'currency'),
    ],
  },
  expenses: {
    name: 'Expenses',
    description: 'Typed operating and capital expense records.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeName', 'Store', 22), col('category', 'Category', 22),
      col('categoryGroup', 'Category Group', 16), col('amount', 'Amount', 16, 'currency'), col('vendor', 'Vendor', 22),
      col('invoiceReference', 'Invoice Reference', 20), col('paymentMethod', 'Payment Method', 18),
      col('description', 'Description', 34), col('overspendReason', 'Overspend Reason', 30),
    ],
  },
  budgets: {
    name: 'Budgets',
    description: 'Annual typed budgets for the years touched by the selected range.',
    columns: [
      col('year', 'Year', 10, 'integer'), col('storeName', 'Store', 22), col('category', 'Category', 22),
      col('categoryGroup', 'Category Group', 16), col('amount', 'Budget Amount', 18, 'currency'), col('notes', 'Notes', 34),
    ],
  },
  cashTransactions: {
    name: 'Cash Transactions',
    description: 'Typed cash inflows and outflows.',
    columns: [
      col('businessDate', 'Business Date', 14), col('direction', 'Direction', 12), col('category', 'Category', 20),
      col('expenseCategory', 'Expense Category', 22), col('cashAccount', 'Cash Account', 20),
      col('amount', 'Amount', 16, 'currency'), col('reference', 'Reference', 18), col('description', 'Description', 34),
    ],
  },
  workingCapital: {
    name: 'Working Capital',
    description: 'Debtor and creditor items created in the selected range.',
    columns: [
      col('createdAt', 'Created At', 21, 'datetime'), col('type', 'Type', 12), col('entity', 'Entity', 24),
      col('originalAmount', 'Original Amount', 18, 'currency'), col('openAmount', 'Open Amount', 16, 'currency'),
      col('dueDate', 'Due Date', 14), col('status', 'Status', 14), col('notes', 'Notes', 34),
    ],
  },
  workingCapitalSettlements: {
    name: 'Working Capital Settlements',
    description: 'Dated settlements against debtor and creditor items.',
    columns: [
      col('businessDate', 'Business Date', 14), col('type', 'Type', 12), col('entity', 'Entity', 24),
      col('amount', 'Amount', 16, 'currency'), col('cashAccount', 'Cash Account', 20), col('reference', 'Reference', 20),
    ],
  },
  capitalSnapshots: {
    name: 'Capital Snapshots',
    description: 'Annual capital employed and investment snapshots.',
    columns: [
      col('year', 'Year', 10, 'integer'), col('capitalEmployed', 'Capital Employed', 19, 'currency'),
      col('totalInvestment', 'Total Investment', 18, 'currency'), col('notes', 'Notes', 34),
    ],
  },
  financialForecasts: {
    name: 'Financial Forecasts',
    description: 'Forecast periods that overlap the selected range.',
    columns: [
      col('periodStart', 'Period Start', 14), col('periodEnd', 'Period End', 14), col('revenue', 'Revenue', 16, 'currency'),
      col('grossProfit', 'Gross Profit', 16, 'currency'), col('netProfit', 'Net Profit', 16, 'currency'),
      col('cashBalance', 'Cash Balance', 16, 'currency'), col('confidence', 'Confidence', 12), col('assumptions', 'Assumptions', 36),
    ],
  },
  salesByCategory: {
    name: 'Sales by Category',
    description: 'Category-level sales lines from typed daily reports.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeCode', 'Store Code', 14), col('storeName', 'Store', 22),
      col('reportStatus', 'Report Status', 14), col('category', 'Category', 22), col('openingStock', 'Opening Stock', 14, 'integer'),
      col('unitsSold', 'Units Sold', 12, 'integer'), col('grossRevenue', 'Gross Revenue', 16, 'currency'),
      col('discounts', 'Discounts', 14, 'currency'), col('returns', 'Returns', 14, 'currency'),
      col('netRevenue', 'Net Revenue', 16, 'currency'), col('cogs', 'COGS', 14, 'currency'),
      col('grossProfit', 'Gross Profit', 16, 'currency'), col('creditSales', 'Credit Sales', 15, 'currency'),
    ],
  },
  productInsights: {
    name: 'Product Insights',
    description: 'Product performance periods that overlap the selected range.',
    columns: [
      col('periodStart', 'Period Start', 14), col('periodEnd', 'Period End', 14), col('sku', 'SKU', 16),
      col('product', 'Product', 26), col('brand', 'Brand', 20), col('category', 'Category', 20),
      col('status', 'Status', 14), col('performance', 'Performance', 16), col('unitsSold', 'Units Sold', 12, 'integer'),
      col('currentStock', 'Current Stock', 14, 'integer'), col('sellThroughPercent', 'Sell-through %', 16, 'decimal'),
      col('salesValue', 'Sales Value', 16, 'currency'), col('daysInStock', 'Days in Stock', 14, 'integer'),
      col('campaign', 'Campaign', 24), col('insight', 'Insight', 38),
    ],
  },
  targets: {
    name: 'Performance Targets',
    description: 'Targets whose periods overlap the selected range.',
    columns: [
      col('periodStart', 'Period Start', 14), col('periodEnd', 'Period End', 14), col('periodType', 'Period Type', 13),
      col('metric', 'Metric', 20), col('scopeType', 'Scope Type', 13), col('scopeName', 'Scope', 24),
      col('value', 'Target Value', 16, 'decimal'), col('unit', 'Unit', 12),
    ],
  },
  customerActivity: {
    name: 'Customer Activity',
    description: 'Typed customer-capture interactions. Contact fields are policy-controlled.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeName', 'Store', 22), col('lifecycle', 'Lifecycle', 12),
      col('source', 'Source', 18), col('sourceDetail', 'Source Detail', 24), col('sku', 'SKU', 16), col('product', 'Product', 24),
      col('interestText', 'Customer Interest', 32), col('customerName', 'Customer Name', 24, undefined, 'customer-contact'),
      col('phone', 'Phone', 18, undefined, 'customer-contact'), col('occupation', 'Occupation', 20, undefined, 'customer-contact'),
      col('sizePreference', 'Size Preference', 16, undefined, 'customer-contact'),
      col('notes', 'Notes', 34, undefined, 'customer-contact'),
    ],
  },
  campaigns: {
    name: 'Campaigns',
    description: 'Typed marketing campaign performance.',
    columns: [
      col('businessDate', 'Business Date', 14), col('name', 'Campaign', 26), col('brand', 'Brand', 20),
      col('platform', 'Platform', 16), col('status', 'Status', 12), col('reach', 'Reach', 14, 'integer'),
      col('engagement', 'Engagement', 14, 'integer'), col('storeVisits', 'Store Visits', 14, 'integer'),
      col('revenueInfluenced', 'Revenue Influenced', 20, 'currency'), col('spend', 'Spend', 14, 'currency'),
    ],
  },
  leadMetrics: {
    name: 'Lead Metrics',
    description: 'Lead, qualification, and conversion counts by channel.',
    columns: [
      col('businessDate', 'Business Date', 14), col('channel', 'Channel', 18), col('campaign', 'Campaign', 24),
      col('leadCount', 'Leads', 12, 'integer'), col('qualifiedCount', 'Qualified', 12, 'integer'),
      col('convertedCount', 'Converted', 12, 'integer'), col('averageValue', 'Average Value', 16, 'currency'), col('notes', 'Notes', 34),
    ],
  },
  socialMetrics: {
    name: 'Social Metrics',
    description: 'Typed social channel performance by platform and brand.',
    columns: [
      col('businessDate', 'Business Date', 14), col('platform', 'Platform', 16), col('brand', 'Brand', 20),
      col('followers', 'Followers', 14, 'integer'), col('posts', 'Posts', 10, 'integer'), col('reels', 'Reels', 10, 'integer'),
      col('stories', 'Stories', 10, 'integer'), col('reach', 'Reach', 14, 'integer'), col('impressions', 'Impressions', 14, 'integer'),
      col('engagement', 'Engagement', 14, 'integer'), col('clicks', 'Clicks', 12, 'integer'), col('websiteVisits', 'Website Visits', 15, 'integer'),
    ],
  },
  clienteling: {
    name: 'Clienteling',
    description: 'Aggregate clienteling activity without customer contact details.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeName', 'Store', 22), col('type', 'Activity Type', 18),
      col('contacted', 'Contacted', 12, 'integer'), col('responses', 'Responses', 12, 'integer'),
      col('appointments', 'Appointments', 14, 'integer'), col('estimatedRevenue', 'Estimated Revenue', 19, 'currency'), col('notes', 'Notes', 34),
    ],
  },
  customerFeedback: {
    name: 'Customer Feedback',
    description: 'Feedback and NPS records. Consented, unexpired follow-up contacts are policy-controlled.',
    columns: [
      col('businessDate', 'Business Date', 14), col('source', 'Source', 16), col('type', 'Type', 16),
      col('category', 'Category', 20), col('npsScore', 'NPS Score', 12, 'integer'), col('recommendation', 'Recommendation', 16),
      col('frequency', 'Frequency', 14), col('storeName', 'Store', 22), col('brand', 'Brand', 20), col('detail', 'Feedback', 42),
      col('contactName', 'Contact Name', 24, undefined, 'customer-contact'),
      col('contactValue', 'Phone or Email', 24, undefined, 'customer-contact'),
      col('retentionUntil', 'Follow-up Until', 16, undefined, 'customer-contact'),
    ],
  },
  products: {
    name: 'Product Catalog',
    description: 'Current typed product catalog. This reference sheet is not date-filtered.',
    columns: [
      col('sku', 'SKU', 16), col('name', 'Product', 28), col('brand', 'Brand', 20), col('category', 'Category', 20),
      col('size', 'Size', 12), col('color', 'Color', 14), col('sellingPrice', 'Selling Price', 16, 'currency'),
      col('unitCost', 'Unit Cost', 14, 'currency', 'unit-cost'), col('active', 'Active', 10, 'boolean'),
    ],
  },
  inventoryMovements: {
    name: 'Inventory Movements',
    description: 'Typed stock movements by product and store.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeName', 'Store', 22), col('sku', 'SKU', 16),
      col('product', 'Product', 26), col('movementType', 'Movement Type', 18), col('quantity', 'Quantity', 12, 'integer'),
      col('unitCost', 'Unit Cost', 14, 'currency', 'unit-cost'), col('movementValue', 'Movement Value', 18, 'currency', 'unit-cost'),
      col('sourceType', 'Source Type', 16), col('sourceId', 'Source ID', 12, 'integer'),
    ],
  },
  goodsReceipts: {
    name: 'Goods Receipts',
    description: 'Goods receipt document summaries and line totals.',
    columns: [
      col('businessDate', 'Business Date', 14), col('poNumber', 'PO Number', 16), col('supplier', 'Supplier', 22),
      col('storeName', 'Receiving Store', 24), col('status', 'Status', 12), col('lineCount', 'Lines', 10, 'integer'),
      col('totalUnits', 'Total Units', 13, 'integer'), col('totalValue', 'Total Value', 16, 'currency', 'unit-cost'), col('notes', 'Notes', 34),
    ],
  },
  stockTransfers: {
    name: 'Stock Transfers',
    description: 'Stock transfer document summaries. Store scope includes inbound and outbound transfers.',
    columns: [
      col('businessDate', 'Business Date', 14), col('fromStore', 'From Store', 22), col('toStore', 'To Store', 22),
      col('status', 'Status', 14), col('reason', 'Reason', 28), col('lineCount', 'Lines', 10, 'integer'),
      col('totalUnits', 'Total Units', 13, 'integer'), col('totalValue', 'Total Value', 16, 'currency', 'unit-cost'),
      col('authorizedAt', 'Authorized At', 21, 'datetime'), col('receivedAt', 'Received At', 21, 'datetime'), col('notes', 'Notes', 34),
    ],
  },
  stockCounts: {
    name: 'Stock Counts',
    description: 'Stock count document summaries with quantity variance.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeName', 'Store', 22), col('status', 'Status', 14),
      col('lineCount', 'Lines', 10, 'integer'), col('systemQuantity', 'System Quantity', 16, 'integer'),
      col('physicalQuantity', 'Physical Quantity', 17, 'integer'), col('variance', 'Variance', 12, 'integer'),
      col('varianceValue', 'Variance Value', 17, 'currency', 'unit-cost'), col('approvedAt', 'Approved At', 21, 'datetime'), col('notes', 'Notes', 34),
    ],
  },
  replenishment: {
    name: 'Replenishment',
    description: 'Replenishment request summaries and requested quantities.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeName', 'Store', 22), col('supplier', 'Supplier', 22),
      col('status', 'Status', 14), col('lineCount', 'Lines', 10, 'integer'), col('currentStock', 'Current Stock', 15, 'integer'),
      col('reorderQuantity', 'Reorder Quantity', 17, 'integer'), col('highestUrgency', 'Highest Urgency', 17),
      col('reviewedAt', 'Reviewed At', 21, 'datetime'), col('notes', 'Notes', 34),
    ],
  },
  inventoryDispositions: {
    name: 'Inventory Decisions',
    description: 'Typed markdown, transfer, donation, and write-off decisions.',
    columns: [
      col('reviewDate', 'Review Date', 14), col('storeName', 'Store', 22), col('sku', 'SKU', 16), col('product', 'Product', 26),
      col('action', 'Action', 16), col('status', 'Status', 14), col('justification', 'Justification', 38),
    ],
  },
  brandHealth: {
    name: 'Brand Health',
    description: 'Typed brand-health assessment scores.',
    columns: [
      col('businessDate', 'Business Date', 14), col('brand', 'Brand', 20), col('type', 'Assessment Type', 18),
      col('awarenessScore', 'Awareness', 12, 'integer'), col('considerationScore', 'Consideration', 14, 'integer'),
      col('preferenceScore', 'Preference', 12, 'integer'), col('satisfactionScore', 'Satisfaction', 14, 'integer'),
      col('loyaltyScore', 'Loyalty', 12, 'integer'), col('advocacyScore', 'Advocacy', 12, 'integer'),
      col('momentumScore', 'Momentum', 12, 'integer'), col('overallOverride', 'Overall Override', 17, 'integer'),
      col('overrideReason', 'Override Reason', 34),
    ],
  },
  brandSentiment: {
    name: 'Brand Sentiment',
    description: 'Typed sentiment mention counts and themes.',
    columns: [
      col('businessDate', 'Business Date', 14), col('brand', 'Brand', 20), col('source', 'Source', 16),
      col('positiveMentions', 'Positive', 12, 'integer'), col('neutralMentions', 'Neutral', 12, 'integer'),
      col('negativeMentions', 'Negative', 12, 'integer'), col('positiveTheme', 'Positive Theme', 30), col('negativeTheme', 'Negative Theme', 30),
    ],
  },
  digitalReputation: {
    name: 'Digital Reputation',
    description: 'Ratings, review volume, response, social sentiment, and NPS.',
    columns: [
      col('businessDate', 'Business Date', 14), col('brand', 'Brand', 20), col('googleRating', 'Google Rating', 14, 'decimal'),
      col('googleReviewCount', 'Google Reviews', 15, 'integer'), col('instagramSentiment', 'Instagram Sentiment', 19, 'percent'),
      col('instagramFollowers', 'Instagram Followers', 19, 'integer'), col('responseRate', 'Response Rate', 15, 'percent'),
      col('averageResponseHours', 'Avg Response Hours', 19, 'decimal'), col('nps', 'NPS', 10, 'integer'),
      col('trustpilotRating', 'Trustpilot Rating', 17, 'decimal'), col('newReviews', 'New Reviews', 13, 'integer'),
      col('negativeReviews', 'Negative Reviews', 16, 'integer'),
    ],
  },
  competitors: {
    name: 'Competitor Activity',
    description: 'Typed competitor monitoring and recommended responses.',
    columns: [
      col('businessDate', 'Business Date', 14), col('competitor', 'Competitor', 22), col('brand', 'Brand', 20),
      col('shareOfVoice', 'Share of Voice', 15, 'percent'), col('activityType', 'Activity Type', 18),
      col('threatLevel', 'Threat Level', 14), col('description', 'Description', 38), col('recommendedResponse', 'Recommended Response', 38),
    ],
  },
  weeklyReviews: {
    name: 'Weekly Reviews',
    description: 'Typed store weekly reviews in the selected range.',
    columns: [
      col('weekEnd', 'Week Ending', 14), col('storeName', 'Store', 22), col('status', 'Status', 12),
      col('summary', 'Summary', 36), col('risks', 'Risks', 34), col('opportunities', 'Opportunities', 34),
      col('amplifyCategory', 'Marketing Amplify', 22), col('differentThisWeek', 'Different This Week', 36),
      col('firstThreeActions', 'First Three Actions', 38), col('approvedAt', 'Approved At', 21, 'datetime'),
    ],
  },
  weeklyReviewActions: {
    name: 'Weekly Review Actions',
    description: 'Actions attached to store weekly reviews.',
    columns: [
      col('weekEnd', 'Week Ending', 14), col('storeName', 'Store', 22), col('category', 'Category', 20),
      col('sku', 'SKU', 16), col('product', 'Product', 24), col('action', 'Action', 36), col('ownerName', 'Owner', 22),
      col('targetUnits', 'Target Units', 13, 'integer'), col('targetRevenue', 'Target Revenue', 17, 'currency'),
      col('dueDate', 'Due Date', 14), col('status', 'Status', 14), col('managerComment', 'Manager Comment', 34),
    ],
  },
  actionItems: {
    name: 'Action Items',
    description: 'Cross-department action items created in the selected range.',
    columns: [
      col('createdAt', 'Created At', 21, 'datetime'), col('department', 'Department', 16), col('storeName', 'Store', 22),
      col('brand', 'Brand', 20), col('category', 'Category', 20), col('title', 'Title', 30), col('detail', 'Detail', 38),
      col('priority', 'Priority', 12), col('ownerName', 'Owner', 22), col('dueDate', 'Due Date', 14), col('status', 'Status', 14),
    ],
  },
  storeStandards: {
    name: 'Store Standards',
    description: 'Operational, merchandising, readiness, experience, cleanliness, and safety scores.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeName', 'Store', 22), col('operationsScore', 'Operations', 12, 'integer'),
      col('vmScore', 'VM', 10, 'integer'), col('readinessScore', 'Readiness', 12, 'integer'),
      col('customerExperienceScore', 'Customer Experience', 20, 'integer'), col('cleanlinessScore', 'Cleanliness', 13, 'integer'),
      col('safetyScore', 'Safety', 10, 'integer'), col('issues', 'Issues', 38),
    ],
  },
  incidents: {
    name: 'Incidents',
    description: 'Store incidents occurring in the selected range.',
    columns: [
      col('occurredAt', 'Occurred At', 21, 'datetime'), col('storeName', 'Store', 22), col('type', 'Type', 18),
      col('severity', 'Severity', 12), col('status', 'Status', 14), col('description', 'Description', 38),
      col('immediateAction', 'Immediate Action', 34), col('followUpRequired', 'Follow-up Required', 19, 'boolean'),
      col('resolvedAt', 'Resolved At', 21, 'datetime'),
    ],
  },
  peopleSnapshots: {
    name: 'People Snapshots',
    description: 'Store staffing, punctuality, and training snapshots.',
    columns: [
      col('businessDate', 'Business Date', 14), col('storeName', 'Store', 22), col('staffTotal', 'Staff Total', 12, 'integer'),
      col('staffPresent', 'Staff Present', 13, 'integer'), col('punctualityScore', 'Punctuality', 13, 'integer'),
      col('trainingCompletionScore', 'Training Completion', 19, 'integer'), col('absenceReason', 'Absence Reason', 30), col('notes', 'Notes', 34),
    ],
  },
};

const FINANCE_SHEETS: ExportSheetKey[] = [
  'dailyReports', 'payments', 'expenses', 'budgets', 'cashTransactions', 'workingCapital',
  'workingCapitalSettlements', 'capitalSnapshots', 'financialForecasts',
];
const COMMERCIAL_SHEETS: ExportSheetKey[] = [
  'salesByCategory', 'productInsights', 'targets', 'customerActivity', 'weeklyReviews',
];
const MARKETING_SHEETS: ExportSheetKey[] = [
  'campaigns', 'leadMetrics', 'socialMetrics', 'clienteling', 'customerFeedback',
];
const INVENTORY_SHEETS: ExportSheetKey[] = [
  'products', 'inventoryMovements', 'goodsReceipts', 'stockTransfers', 'stockCounts', 'replenishment', 'inventoryDispositions',
];
const BRAND_SHEETS: ExportSheetKey[] = [
  'brandHealth', 'brandSentiment', 'digitalReputation', 'competitors', 'customerFeedback',
];
const STORE_SHEETS: ExportSheetKey[] = [
  'dailyReports', 'salesByCategory', 'payments', 'weeklyReviews', 'weeklyReviewActions', 'stockTransfers', 'customerActivity',
];
const OPERATIONS_SHEETS: ExportSheetKey[] = ['actionItems', 'storeStandards', 'incidents', 'peopleSnapshots'];
const ALL_SHEETS = [
  ...new Set([
    ...FINANCE_SHEETS,
    ...COMMERCIAL_SHEETS,
    ...MARKETING_SHEETS,
    ...INVENTORY_SHEETS,
    ...BRAND_SHEETS,
    'weeklyReviewActions' as const,
    ...OPERATIONS_SHEETS,
  ]),
];

const SCOPE_SHEETS: Record<ExportScope, ExportSheetKey[]> = {
  all: ALL_SHEETS,
  finance: FINANCE_SHEETS,
  commercial: COMMERCIAL_SHEETS,
  marketing: MARKETING_SHEETS,
  inventory: INVENTORY_SHEETS,
  brand: BRAND_SHEETS,
  store: STORE_SHEETS,
};

export function getExportSheetDefinitions(
  scope: ExportScope,
  options: { includeCustomerContacts: boolean; includeUnitCost: boolean }
): ExportSheetDefinition[] {
  return SCOPE_SHEETS[scope].map((key) => {
    const base = SHEETS[key];
    const columns = base.columns.filter((column) => {
      if (column.sensitive === 'customer-contact') return options.includeCustomerContacts;
      if (column.sensitive === 'unit-cost') return options.includeUnitCost;
      return true;
    });
    return {
      key,
      name: key === 'customerActivity' && options.includeCustomerContacts ? 'Customer Capture' : base.name,
      description: base.description,
      columns,
    };
  });
}

const COLORS = {
  primary: 'FF0F766E',
  primaryDark: 'FF115E59',
  primaryLight: 'FFF0FDFA',
  text: 'FF1F2937',
  muted: 'FF64748B',
  border: 'FFCBD5E1',
  white: 'FFFFFFFF',
};

function rangeLabel(range: ExportDateRange): string {
  if (!range.from && !range.to) return 'All time';
  return `${range.from ?? 'Start'} to ${range.to ?? 'Now'} (inclusive)`;
}

function normalizeCell(value: unknown, format?: ColumnFormat): string | number {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (format === 'boolean') return value ? 'Yes' : 'No';
  if (format === 'currency' || format === 'integer' || format === 'decimal' || format === 'percent') {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? number : '';
  }
  return String(value);
}

function styleTitle(row: ExcelJS.Row): void {
  row.height = 28;
  row.font = { bold: true, color: { argb: COLORS.white }, size: 15 };
  row.alignment = { vertical: 'middle' };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } };
}

function styleHeader(row: ExcelJS.Row): void {
  row.height = 24;
  row.font = { bold: true, color: { argb: COLORS.white } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryDark } };
    cell.border = { bottom: { style: 'thin', color: { argb: COLORS.primaryDark } } };
  });
}

function buildIndexSheet(
  workbook: ExcelJS.Workbook,
  input: ExportWorkbookInput,
  definitions: ExportSheetDefinition[],
  generatedAt: Date
): void {
  const worksheet = workbook.addWorksheet('Export Index', { views: [{ state: 'frozen', ySplit: 7 }] });
  worksheet.mergeCells('A1:D1');
  const title = worksheet.getCell('A1');
  title.value = 'STATESTREET DATA EXPORT';
  styleTitle(worksheet.getRow(1));
  worksheet.addRow(['Scope', input.storeLabel ? `${EXPORT_SCOPE_LABELS[input.scope]} - ${input.storeLabel}` : EXPORT_SCOPE_LABELS[input.scope]]);
  worksheet.addRow(['Date range', rangeLabel(input.range)]);
  worksheet.addRow(['Generated', generatedAt.toISOString()]);
  worksheet.addRow([
    'Privacy',
    input.includeCustomerContacts
      ? 'Customer contact fields included for an explicitly authorized operational scope.'
      : 'Customer names, phone numbers, occupations, size preferences, and contact notes are excluded.',
  ]);
  worksheet.addRow([]);
  const header = worksheet.addRow(['Worksheet', 'Rows', 'Source', 'Coverage']);
  styleHeader(header);
  for (const definition of definitions) {
    const rows = input.rows[definition.key] ?? [];
    worksheet.addRow([definition.name, rows.length, 'Typed PostgreSQL tables', definition.description]);
  }
  worksheet.columns = [{ width: 30 }, { width: 12 }, { width: 24 }, { width: 74 }];
  worksheet.getColumn(2).numFmt = '#,##0';
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 7 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };
      });
    }
  });
  worksheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function buildDataSheet(
  workbook: ExcelJS.Workbook,
  definition: ExportSheetDefinition,
  rows: ExportRow[],
  input: ExportWorkbookInput
): void {
  const worksheet = workbook.addWorksheet(definition.name, { views: [{ state: 'frozen', ySplit: 5 }] });
  const lastColumn = Math.max(1, definition.columns.length);
  worksheet.mergeCells(1, 1, 1, lastColumn);
  worksheet.getCell(1, 1).value = definition.name.toUpperCase();
  styleTitle(worksheet.getRow(1));
  worksheet.mergeCells(2, 1, 2, lastColumn);
  worksheet.getCell(2, 1).value = definition.description;
  worksheet.getCell(2, 1).font = { italic: true, color: { argb: COLORS.muted } };
  worksheet.mergeCells(3, 1, 3, lastColumn);
  worksheet.getCell(3, 1).value = `Scope: ${EXPORT_SCOPE_LABELS[input.scope]} | Date range: ${rangeLabel(input.range)}`;
  worksheet.getCell(3, 1).font = { color: { argb: COLORS.muted } };
  worksheet.addRow([]);
  const header = worksheet.addRow(definition.columns.map((column) => column.header));
  styleHeader(header);

  for (const source of rows) {
    const row = worksheet.addRow(
      definition.columns.map((column) => normalizeCell(source[column.key], column.format))
    );
    definition.columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      if (column.format === 'currency' || column.format === 'decimal') cell.numFmt = '#,##0.00';
      if (column.format === 'percent') cell.numFmt = '0.00';
      if (column.format === 'integer') cell.numFmt = '#,##0';
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: COLORS.border } } };
    });
    if (row.number % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };
      });
    }
  }

  worksheet.columns = definition.columns.map((column) => ({ width: column.width }));
  worksheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: lastColumn } };
  worksheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

export async function buildWorkbook(input: ExportWorkbookInput): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const generatedAt = input.generatedAt ?? new Date();
  const definitions = getExportSheetDefinitions(input.scope, input);
  workbook.creator = 'StateStreet Ops';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  buildIndexSheet(workbook, input, definitions, generatedAt);
  for (const definition of definitions) {
    buildDataSheet(workbook, definition, input.rows[definition.key] ?? [], input);
  }
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

function dateRangeFilter(column: SQLWrapper, range: ExportDateRange) {
  return and(
    range.from ? sql`${column} >= ${range.from}::date` : undefined,
    range.to ? sql`${column} <= ${range.to}::date` : undefined
  );
}

function timestampRangeFilter(column: SQLWrapper, range: ExportDateRange) {
  return and(
    range.from ? sql`${column} >= ${range.from}::date` : undefined,
    range.to ? sql`${column} < (${range.to}::date + interval '1 day')` : undefined
  );
}

function periodOverlapFilter(start: SQLWrapper, end: SQLWrapper, range: ExportDateRange) {
  return and(
    range.from ? sql`${end} >= ${range.from}::date` : undefined,
    range.to ? sql`${start} <= ${range.to}::date` : undefined
  );
}

function yearRangeFilter(column: SQLWrapper, range: ExportDateRange) {
  return and(
    range.from ? sql`${column} >= extract(year from ${range.from}::date)` : undefined,
    range.to ? sql`${column} <= extract(year from ${range.to}::date)` : undefined
  );
}

const asRows = <T extends object>(rows: T[]): ExportRow[] => rows as ExportRow[];

export async function loadTypedExportRows(
  input: LoadTypedExportInput
): Promise<Partial<Record<ExportSheetKey, ExportRow[]>>> {
  if (input.scope === 'store' && !input.storeId) {
    throw new Error('A resolved store is required for store exports');
  }

  const [{ db }, foundation, operational, identity] = await Promise.all([
    import('./db'),
    import('./db/foundation-schema'),
    import('./db/operational-schema'),
    import('./db/schema'),
  ]);
  const {
    brands,
    budgets,
    categories,
    customerInteractions,
    customers,
    dailyPaymentLines,
    dailyReports,
    dailySalesLines,
    expenseCategories,
    expenses,
    goodsReceiptLines,
    goodsReceipts,
    paymentMethods,
    products,
    replenishmentRequestLines,
    replenishmentRequests,
    stockCountLines,
    stockCounts,
    stockTransferLines,
    stockTransfers,
    stores,
    suppliers,
    weeklyReviewActions,
    weeklyReviews,
  } = foundation;
  const { users } = identity;
  const {
    actionItems,
    brandHealthAssessments,
    brandSentimentSnapshots,
    capitalSnapshots,
    cashAccounts,
    cashTransactions,
    clientelingActivities,
    competitorActivities,
    customerFeedback,
    digitalReputationSnapshots,
    financialForecasts,
    incidents,
    inventoryDispositions,
    inventoryMovements,
    leadMetrics,
    marketingCampaignReports,
    peopleSnapshots,
    performanceTargets,
    productInsights,
    socialMetrics,
    storeStandardReviews,
    workingCapitalItems,
    workingCapitalSettlements,
  } = operational;

  const storeCondition = (column: SQLWrapper) =>
    input.storeId ? sql`${column} = ${input.storeId}` : undefined;
  const transferStoreCondition = input.storeId
    ? or(eq(stockTransfers.fromStoreId, input.storeId), eq(stockTransfers.toStoreId, input.storeId))
    : undefined;

  const loaders: Record<ExportSheetKey, () => Promise<ExportRow[]>> = {
    dailyReports: async () => asRows(await db
      .select({
        businessDate: dailyReports.businessDate,
        storeCode: stores.code,
        storeName: stores.name,
        status: dailyReports.status,
        transactions: dailyReports.transactions,
        footfall: dailyReports.footfall,
        totalCustomers: dailyReports.totalCustomers,
        newCustomers: dailyReports.newCustomers,
        returningCustomers: dailyReports.returningCustomers,
        unitsSold: sql<number>`coalesce((select sum(line.units_sold) from daily_sales_lines line where line.daily_report_id = ${dailyReports.id}), 0)::integer`,
        grossRevenue: sql<number>`coalesce((select sum(line.gross_revenue) from daily_sales_lines line where line.daily_report_id = ${dailyReports.id}), 0)::float8`,
        discounts: sql<number>`coalesce((select sum(line.discounts) from daily_sales_lines line where line.daily_report_id = ${dailyReports.id}), 0)::float8`,
        returns: sql<number>`coalesce((select sum(line.returns) from daily_sales_lines line where line.daily_report_id = ${dailyReports.id}), 0)::float8`,
        netRevenue: sql<number>`coalesce((select sum(line.gross_revenue - line.discounts - line.returns) from daily_sales_lines line where line.daily_report_id = ${dailyReports.id}), 0)::float8`,
        cogs: sql<number>`coalesce((select sum(line.cogs) from daily_sales_lines line where line.daily_report_id = ${dailyReports.id}), 0)::float8`,
        grossProfit: sql<number>`coalesce((select sum(line.gross_revenue - line.discounts - line.returns - line.cogs) from daily_sales_lines line where line.daily_report_id = ${dailyReports.id}), 0)::float8`,
        creditSales: sql<number>`coalesce((select sum(line.credit_sales) from daily_sales_lines line where line.daily_report_id = ${dailyReports.id}), 0)::float8`,
        paymentTotal: sql<number>`coalesce((select sum(payment.amount) from daily_payment_lines payment where payment.daily_report_id = ${dailyReports.id}), 0)::float8`,
        paymentVariance: sql<number>`(
          coalesce((select sum(payment.amount) from daily_payment_lines payment where payment.daily_report_id = ${dailyReports.id}), 0) -
          coalesce((select sum(line.gross_revenue - line.discounts - line.returns - line.credit_sales) from daily_sales_lines line where line.daily_report_id = ${dailyReports.id}), 0)
        )::float8`,
        submittedAt: dailyReports.submittedAt,
        approvedAt: dailyReports.approvedAt,
      })
      .from(dailyReports)
      .innerJoin(stores, eq(dailyReports.storeId, stores.id))
      .where(and(dateRangeFilter(dailyReports.businessDate, input.range), storeCondition(dailyReports.storeId)))
      .orderBy(asc(dailyReports.businessDate), asc(stores.name))),
    payments: async () => asRows(await db
      .select({
        businessDate: dailyReports.businessDate,
        storeCode: stores.code,
        storeName: stores.name,
        reportStatus: dailyReports.status,
        paymentMethod: paymentMethods.name,
        amount: sql<number>`${dailyPaymentLines.amount}::float8`,
      })
      .from(dailyPaymentLines)
      .innerJoin(dailyReports, eq(dailyPaymentLines.dailyReportId, dailyReports.id))
      .innerJoin(stores, eq(dailyReports.storeId, stores.id))
      .innerJoin(paymentMethods, eq(dailyPaymentLines.paymentMethodId, paymentMethods.id))
      .where(and(dateRangeFilter(dailyReports.businessDate, input.range), storeCondition(dailyReports.storeId)))
      .orderBy(asc(dailyReports.businessDate), asc(stores.name), asc(paymentMethods.name))),
    expenses: async () => asRows(await db
      .select({
        businessDate: expenses.businessDate,
        storeName: sql<string>`coalesce(${stores.name}, 'Group')`,
        category: expenseCategories.name,
        categoryGroup: expenseCategories.group,
        amount: sql<number>`${expenses.amount}::float8`,
        vendor: expenses.vendor,
        invoiceReference: expenses.invoiceReference,
        paymentMethod: paymentMethods.name,
        description: expenses.description,
        overspendReason: expenses.overspendReason,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.expenseCategoryId, expenseCategories.id))
      .leftJoin(stores, eq(expenses.storeId, stores.id))
      .leftJoin(paymentMethods, eq(expenses.paymentMethodId, paymentMethods.id))
      .where(dateRangeFilter(expenses.businessDate, input.range))
      .orderBy(asc(expenses.businessDate), asc(expenseCategories.name))),
    budgets: async () => asRows(await db
      .select({
        year: budgets.year,
        storeName: sql<string>`coalesce(${stores.name}, 'Group')`,
        category: expenseCategories.name,
        categoryGroup: expenseCategories.group,
        amount: sql<number>`${budgets.amount}::float8`,
        notes: budgets.notes,
      })
      .from(budgets)
      .innerJoin(expenseCategories, eq(budgets.expenseCategoryId, expenseCategories.id))
      .leftJoin(stores, eq(budgets.storeId, stores.id))
      .where(yearRangeFilter(budgets.year, input.range))
      .orderBy(asc(budgets.year), asc(expenseCategories.name))),
    cashTransactions: async () => asRows(await db
      .select({
        businessDate: cashTransactions.businessDate,
        direction: cashTransactions.direction,
        category: cashTransactions.category,
        expenseCategory: expenseCategories.name,
        cashAccount: cashAccounts.name,
        amount: sql<number>`${cashTransactions.amount}::float8`,
        reference: cashTransactions.reference,
        description: cashTransactions.description,
      })
      .from(cashTransactions)
      .leftJoin(expenseCategories, eq(cashTransactions.expenseCategoryId, expenseCategories.id))
      .leftJoin(cashAccounts, eq(cashTransactions.cashAccountId, cashAccounts.id))
      .where(dateRangeFilter(cashTransactions.businessDate, input.range))
      .orderBy(asc(cashTransactions.businessDate), asc(cashTransactions.direction))),
    workingCapital: async () => asRows(await db
      .select({
        createdAt: workingCapitalItems.createdAt,
        type: workingCapitalItems.type,
        entity: workingCapitalItems.entity,
        originalAmount: sql<number>`${workingCapitalItems.originalAmount}::float8`,
        openAmount: sql<number>`${workingCapitalItems.openAmount}::float8`,
        dueDate: workingCapitalItems.dueDate,
        status: workingCapitalItems.status,
        notes: workingCapitalItems.notes,
      })
      .from(workingCapitalItems)
      .where(timestampRangeFilter(workingCapitalItems.createdAt, input.range))
      .orderBy(asc(workingCapitalItems.createdAt), asc(workingCapitalItems.entity))),
    workingCapitalSettlements: async () => asRows(await db
      .select({
        businessDate: workingCapitalSettlements.businessDate,
        type: workingCapitalItems.type,
        entity: workingCapitalItems.entity,
        amount: sql<number>`${workingCapitalSettlements.amount}::float8`,
        cashAccount: cashAccounts.name,
        reference: workingCapitalSettlements.reference,
      })
      .from(workingCapitalSettlements)
      .innerJoin(workingCapitalItems, eq(workingCapitalSettlements.workingCapitalItemId, workingCapitalItems.id))
      .leftJoin(cashAccounts, eq(workingCapitalSettlements.cashAccountId, cashAccounts.id))
      .where(dateRangeFilter(workingCapitalSettlements.businessDate, input.range))
      .orderBy(asc(workingCapitalSettlements.businessDate), asc(workingCapitalItems.entity))),
    capitalSnapshots: async () => asRows(await db
      .select({
        year: capitalSnapshots.year,
        capitalEmployed: sql<number>`${capitalSnapshots.capitalEmployed}::float8`,
        totalInvestment: sql<number>`${capitalSnapshots.totalInvestment}::float8`,
        notes: capitalSnapshots.notes,
      })
      .from(capitalSnapshots)
      .where(yearRangeFilter(capitalSnapshots.year, input.range))
      .orderBy(asc(capitalSnapshots.year))),
    financialForecasts: async () => asRows(await db
      .select({
        periodStart: financialForecasts.periodStart,
        periodEnd: financialForecasts.periodEnd,
        revenue: sql<number>`${financialForecasts.revenue}::float8`,
        grossProfit: sql<number>`${financialForecasts.grossProfit}::float8`,
        netProfit: sql<number>`${financialForecasts.netProfit}::float8`,
        cashBalance: sql<number>`${financialForecasts.cashBalance}::float8`,
        confidence: financialForecasts.confidence,
        assumptions: financialForecasts.assumptions,
      })
      .from(financialForecasts)
      .where(periodOverlapFilter(financialForecasts.periodStart, financialForecasts.periodEnd, input.range))
      .orderBy(asc(financialForecasts.periodStart))),
    salesByCategory: async () => asRows(await db
      .select({
        businessDate: dailyReports.businessDate,
        storeCode: stores.code,
        storeName: stores.name,
        reportStatus: dailyReports.status,
        category: categories.name,
        openingStock: dailySalesLines.openingStock,
        unitsSold: dailySalesLines.unitsSold,
        grossRevenue: sql<number>`${dailySalesLines.grossRevenue}::float8`,
        discounts: sql<number>`${dailySalesLines.discounts}::float8`,
        returns: sql<number>`${dailySalesLines.returns}::float8`,
        netRevenue: sql<number>`(${dailySalesLines.grossRevenue} - ${dailySalesLines.discounts} - ${dailySalesLines.returns})::float8`,
        cogs: sql<number>`${dailySalesLines.cogs}::float8`,
        grossProfit: sql<number>`(${dailySalesLines.grossRevenue} - ${dailySalesLines.discounts} - ${dailySalesLines.returns} - ${dailySalesLines.cogs})::float8`,
        creditSales: sql<number>`${dailySalesLines.creditSales}::float8`,
      })
      .from(dailySalesLines)
      .innerJoin(dailyReports, eq(dailySalesLines.dailyReportId, dailyReports.id))
      .innerJoin(stores, eq(dailyReports.storeId, stores.id))
      .innerJoin(categories, eq(dailySalesLines.categoryId, categories.id))
      .where(and(dateRangeFilter(dailyReports.businessDate, input.range), storeCondition(dailyReports.storeId)))
      .orderBy(asc(dailyReports.businessDate), asc(stores.name), asc(categories.name))),
    productInsights: async () => asRows(await db
      .select({
        periodStart: productInsights.periodStart,
        periodEnd: productInsights.periodEnd,
        sku: products.sku,
        product: products.name,
        brand: brands.name,
        category: categories.name,
        status: productInsights.status,
        performance: productInsights.performance,
        unitsSold: productInsights.unitsSold,
        currentStock: productInsights.currentStock,
        sellThroughPercent: sql<number | null>`${productInsights.sellThroughPercent}::float8`,
        salesValue: sql<number | null>`${productInsights.salesValue}::float8`,
        daysInStock: productInsights.daysInStock,
        campaign: productInsights.campaign,
        insight: productInsights.insight,
      })
      .from(productInsights)
      .innerJoin(products, eq(productInsights.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(periodOverlapFilter(productInsights.periodStart, productInsights.periodEnd, input.range))
      .orderBy(asc(productInsights.periodStart), asc(products.name))),
    targets: async () => asRows(await db
      .select({
        periodStart: performanceTargets.periodStart,
        periodEnd: performanceTargets.periodEnd,
        periodType: performanceTargets.periodType,
        metric: performanceTargets.metric,
        scopeType: performanceTargets.scopeType,
        scopeName: sql<string>`coalesce(${stores.name}, ${brands.name}, ${categories.name}, 'Group')`,
        value: sql<number>`${performanceTargets.value}::float8`,
        unit: performanceTargets.unit,
      })
      .from(performanceTargets)
      .leftJoin(stores, eq(performanceTargets.storeId, stores.id))
      .leftJoin(brands, eq(performanceTargets.brandId, brands.id))
      .leftJoin(categories, eq(performanceTargets.categoryId, categories.id))
      .where(periodOverlapFilter(performanceTargets.periodStart, performanceTargets.periodEnd, input.range))
      .orderBy(asc(performanceTargets.periodStart), asc(performanceTargets.metric))),
    customerActivity: async () => {
      const selection = {
        businessDate: customerInteractions.businessDate,
        storeName: stores.name,
        lifecycle: customerInteractions.lifecycle,
        source: customerInteractions.source,
        sourceDetail: customerInteractions.sourceDetail,
        sku: products.sku,
        product: products.name,
        interestText: customerInteractions.interestText,
        ...(input.includeCustomerContacts
          ? {
              customerName: customers.name,
              phone: customers.phone,
              occupation: customers.occupation,
              sizePreference: customers.sizePreference,
              notes: customerInteractions.notes,
            }
          : {}),
      };
      return asRows(await db
        .select(selection)
        .from(customerInteractions)
        .innerJoin(customers, eq(customerInteractions.customerId, customers.id))
        .innerJoin(stores, eq(customerInteractions.storeId, stores.id))
        .leftJoin(products, eq(customerInteractions.productId, products.id))
        .where(and(dateRangeFilter(customerInteractions.businessDate, input.range), storeCondition(customerInteractions.storeId)))
        .orderBy(asc(customerInteractions.businessDate), asc(stores.name)));
    },
    campaigns: async () => asRows(await db
      .select({
        businessDate: marketingCampaignReports.businessDate,
        name: marketingCampaignReports.name,
        brand: brands.name,
        platform: marketingCampaignReports.platform,
        status: marketingCampaignReports.status,
        reach: marketingCampaignReports.reach,
        engagement: marketingCampaignReports.engagement,
        storeVisits: marketingCampaignReports.storeVisits,
        revenueInfluenced: sql<number>`${marketingCampaignReports.revenueInfluenced}::float8`,
        spend: sql<number>`${marketingCampaignReports.spend}::float8`,
      })
      .from(marketingCampaignReports)
      .innerJoin(brands, eq(marketingCampaignReports.brandId, brands.id))
      .where(dateRangeFilter(marketingCampaignReports.businessDate, input.range))
      .orderBy(asc(marketingCampaignReports.businessDate), asc(marketingCampaignReports.name))),
    leadMetrics: async () => asRows(await db
      .select({
        businessDate: leadMetrics.businessDate,
        channel: leadMetrics.channel,
        campaign: marketingCampaignReports.name,
        leadCount: leadMetrics.leadCount,
        qualifiedCount: leadMetrics.qualifiedCount,
        convertedCount: leadMetrics.convertedCount,
        averageValue: sql<number>`${leadMetrics.averageValue}::float8`,
        notes: leadMetrics.notes,
      })
      .from(leadMetrics)
      .leftJoin(marketingCampaignReports, eq(leadMetrics.campaignReportId, marketingCampaignReports.id))
      .where(dateRangeFilter(leadMetrics.businessDate, input.range))
      .orderBy(asc(leadMetrics.businessDate), asc(leadMetrics.channel))),
    socialMetrics: async () => asRows(await db
      .select({
        businessDate: socialMetrics.businessDate,
        platform: socialMetrics.platform,
        brand: sql<string>`coalesce(${brands.name}, 'Group')`,
        followers: socialMetrics.followers,
        posts: socialMetrics.posts,
        reels: socialMetrics.reels,
        stories: socialMetrics.stories,
        reach: socialMetrics.reach,
        impressions: socialMetrics.impressions,
        engagement: socialMetrics.engagement,
        clicks: socialMetrics.clicks,
        websiteVisits: socialMetrics.websiteVisits,
      })
      .from(socialMetrics)
      .leftJoin(brands, eq(socialMetrics.brandId, brands.id))
      .where(dateRangeFilter(socialMetrics.businessDate, input.range))
      .orderBy(asc(socialMetrics.businessDate), asc(socialMetrics.platform))),
    clienteling: async () => asRows(await db
      .select({
        businessDate: clientelingActivities.businessDate,
        storeName: sql<string>`coalesce(${stores.name}, 'Group')`,
        type: clientelingActivities.type,
        contacted: clientelingActivities.contacted,
        responses: clientelingActivities.responses,
        appointments: clientelingActivities.appointments,
        estimatedRevenue: sql<number>`${clientelingActivities.estimatedRevenue}::float8`,
        notes: clientelingActivities.notes,
      })
      .from(clientelingActivities)
      .leftJoin(stores, eq(clientelingActivities.storeId, stores.id))
      .where(dateRangeFilter(clientelingActivities.businessDate, input.range))
      .orderBy(asc(clientelingActivities.businessDate), asc(clientelingActivities.type))),
    customerFeedback: async () => {
      const selection = {
        businessDate: customerFeedback.businessDate,
        source: customerFeedback.source,
        type: customerFeedback.type,
        category: customerFeedback.category,
        npsScore: customerFeedback.npsScore,
        recommendation: customerFeedback.recommendation,
        frequency: customerFeedback.frequency,
        storeName: stores.name,
        brand: brands.name,
        detail: customerFeedback.detail,
        ...(input.includeCustomerContacts
          ? {
              contactName: sql<string | null>`case
                when ${customerFeedback.contactConsent} = true
                  and ${customerFeedback.retentionUntil} >= current_date
                then ${customerFeedback.contactName}
              end`,
              contactValue: sql<string | null>`case
                when ${customerFeedback.contactConsent} = true
                  and ${customerFeedback.retentionUntil} >= current_date
                then ${customerFeedback.contactValue}
              end`,
              retentionUntil: sql<string | null>`case
                when ${customerFeedback.contactConsent} = true
                  and ${customerFeedback.retentionUntil} >= current_date
                then ${customerFeedback.retentionUntil}
              end`,
            }
          : {}),
      };
      return asRows(await db
        .select(selection)
        .from(customerFeedback)
        .leftJoin(stores, eq(customerFeedback.storeId, stores.id))
        .leftJoin(brands, eq(customerFeedback.brandId, brands.id))
        .where(dateRangeFilter(customerFeedback.businessDate, input.range))
        .orderBy(asc(customerFeedback.businessDate), asc(customerFeedback.source)));
    },
    products: async () => {
      const selection = {
        sku: products.sku,
        name: products.name,
        brand: brands.name,
        category: categories.name,
        size: products.size,
        color: products.color,
        sellingPrice: sql<number>`${products.sellingPrice}::float8`,
        ...(input.includeUnitCost ? { unitCost: sql<number>`${products.unitCost}::float8` } : {}),
        active: products.active,
      };
      return asRows(await db
        .select(selection)
        .from(products)
        .innerJoin(brands, eq(products.brandId, brands.id))
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .orderBy(asc(products.name), asc(products.sku)));
    },
    inventoryMovements: async () => {
      const selection = {
        businessDate: inventoryMovements.businessDate,
        storeName: stores.name,
        sku: products.sku,
        product: products.name,
        movementType: inventoryMovements.movementType,
        quantity: inventoryMovements.quantity,
        ...(input.includeUnitCost
          ? {
              unitCost: sql<number>`${inventoryMovements.unitCost}::float8`,
              movementValue: sql<number>`(${inventoryMovements.quantity} * coalesce(${inventoryMovements.unitCost}, 0))::float8`,
            }
          : {}),
        sourceType: inventoryMovements.sourceType,
        sourceId: inventoryMovements.sourceId,
      };
      return asRows(await db
        .select(selection)
        .from(inventoryMovements)
        .innerJoin(stores, eq(inventoryMovements.storeId, stores.id))
        .innerJoin(products, eq(inventoryMovements.productId, products.id))
        .where(dateRangeFilter(inventoryMovements.businessDate, input.range))
        .orderBy(asc(inventoryMovements.businessDate), asc(stores.name), asc(products.name)));
    },
    goodsReceipts: async () => {
      const selection = {
        businessDate: goodsReceipts.businessDate,
        poNumber: goodsReceipts.poNumber,
        supplier: suppliers.name,
        storeName: stores.name,
        status: goodsReceipts.status,
        lineCount: sql<number>`count(${goodsReceiptLines.id})::integer`,
        totalUnits: sql<number>`coalesce(sum(${goodsReceiptLines.quantity}), 0)::integer`,
        ...(input.includeUnitCost
          ? { totalValue: sql<number>`coalesce(sum(${goodsReceiptLines.quantity} * coalesce(${goodsReceiptLines.unitCost}, 0)), 0)::float8` }
          : {}),
        notes: goodsReceipts.notes,
      };
      return asRows(await db
        .select(selection)
        .from(goodsReceipts)
        .innerJoin(suppliers, eq(goodsReceipts.supplierId, suppliers.id))
        .innerJoin(stores, eq(goodsReceipts.receivingStoreId, stores.id))
        .leftJoin(goodsReceiptLines, eq(goodsReceiptLines.goodsReceiptId, goodsReceipts.id))
        .where(dateRangeFilter(goodsReceipts.businessDate, input.range))
        .groupBy(goodsReceipts.id, suppliers.name, stores.name)
        .orderBy(asc(goodsReceipts.businessDate), asc(stores.name)));
    },
    stockTransfers: async () => {
      const selection = {
        businessDate: stockTransfers.businessDate,
        fromStore: sql<string>`(select source.name from stores source where source.id = ${stockTransfers.fromStoreId})`,
        toStore: sql<string>`(select destination.name from stores destination where destination.id = ${stockTransfers.toStoreId})`,
        status: stockTransfers.status,
        reason: stockTransfers.reason,
        lineCount: sql<number>`count(${stockTransferLines.id})::integer`,
        totalUnits: sql<number>`coalesce(sum(${stockTransferLines.quantity}), 0)::integer`,
        ...(input.includeUnitCost
          ? { totalValue: sql<number>`coalesce(sum(${stockTransferLines.quantity} * coalesce(${stockTransferLines.unitCost}, 0)), 0)::float8` }
          : {}),
        authorizedAt: stockTransfers.authorizedAt,
        receivedAt: stockTransfers.receivedAt,
        notes: stockTransfers.notes,
      };
      return asRows(await db
        .select(selection)
        .from(stockTransfers)
        .leftJoin(stockTransferLines, eq(stockTransferLines.stockTransferId, stockTransfers.id))
        .where(and(dateRangeFilter(stockTransfers.businessDate, input.range), transferStoreCondition))
        .groupBy(stockTransfers.id)
        .orderBy(asc(stockTransfers.businessDate), asc(stockTransfers.id)));
    },
    stockCounts: async () => {
      const selection = {
        businessDate: stockCounts.businessDate,
        storeName: stores.name,
        status: stockCounts.status,
        lineCount: sql<number>`count(${stockCountLines.id})::integer`,
        systemQuantity: sql<number>`coalesce(sum(${stockCountLines.systemQuantity}), 0)::integer`,
        physicalQuantity: sql<number>`coalesce(sum(${stockCountLines.physicalQuantity}), 0)::integer`,
        variance: sql<number>`coalesce(sum(${stockCountLines.physicalQuantity} - ${stockCountLines.systemQuantity}), 0)::integer`,
        ...(input.includeUnitCost
          ? { varianceValue: sql<number>`coalesce(sum((${stockCountLines.physicalQuantity} - ${stockCountLines.systemQuantity}) * coalesce(${stockCountLines.unitCost}, 0)), 0)::float8` }
          : {}),
        approvedAt: stockCounts.approvedAt,
        notes: stockCounts.notes,
      };
      return asRows(await db
        .select(selection)
        .from(stockCounts)
        .innerJoin(stores, eq(stockCounts.storeId, stores.id))
        .leftJoin(stockCountLines, eq(stockCountLines.stockCountId, stockCounts.id))
        .where(dateRangeFilter(stockCounts.businessDate, input.range))
        .groupBy(stockCounts.id, stores.name)
        .orderBy(asc(stockCounts.businessDate), asc(stores.name)));
    },
    replenishment: async () => asRows(await db
      .select({
        businessDate: replenishmentRequests.businessDate,
        storeName: stores.name,
        supplier: suppliers.name,
        status: replenishmentRequests.status,
        lineCount: sql<number>`count(${replenishmentRequestLines.id})::integer`,
        currentStock: sql<number>`coalesce(sum(${replenishmentRequestLines.currentStock}), 0)::integer`,
        reorderQuantity: sql<number>`coalesce(sum(${replenishmentRequestLines.reorderQuantity}), 0)::integer`,
        highestUrgency: sql<string>`coalesce((array_agg(${replenishmentRequestLines.urgency} order by case ${replenishmentRequestLines.urgency} when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end))[1], '')`,
        reviewedAt: replenishmentRequests.reviewedAt,
        notes: replenishmentRequests.notes,
      })
      .from(replenishmentRequests)
      .innerJoin(stores, eq(replenishmentRequests.storeId, stores.id))
      .leftJoin(suppliers, eq(replenishmentRequests.supplierId, suppliers.id))
      .leftJoin(replenishmentRequestLines, eq(replenishmentRequestLines.replenishmentRequestId, replenishmentRequests.id))
      .where(dateRangeFilter(replenishmentRequests.businessDate, input.range))
      .groupBy(replenishmentRequests.id, stores.name, suppliers.name)
      .orderBy(asc(replenishmentRequests.businessDate), asc(stores.name))),
    inventoryDispositions: async () => asRows(await db
      .select({
        reviewDate: inventoryDispositions.reviewDate,
        storeName: stores.name,
        sku: products.sku,
        product: products.name,
        action: inventoryDispositions.action,
        status: inventoryDispositions.status,
        justification: inventoryDispositions.justification,
      })
      .from(inventoryDispositions)
      .innerJoin(stores, eq(inventoryDispositions.storeId, stores.id))
      .innerJoin(products, eq(inventoryDispositions.productId, products.id))
      .where(dateRangeFilter(inventoryDispositions.reviewDate, input.range))
      .orderBy(asc(inventoryDispositions.reviewDate), asc(stores.name), asc(products.name))),
    brandHealth: async () => asRows(await db
      .select({
        businessDate: brandHealthAssessments.businessDate,
        brand: brands.name,
        type: brandHealthAssessments.type,
        awarenessScore: brandHealthAssessments.awarenessScore,
        considerationScore: brandHealthAssessments.considerationScore,
        preferenceScore: brandHealthAssessments.preferenceScore,
        satisfactionScore: brandHealthAssessments.satisfactionScore,
        loyaltyScore: brandHealthAssessments.loyaltyScore,
        advocacyScore: brandHealthAssessments.advocacyScore,
        momentumScore: brandHealthAssessments.momentumScore,
        overallOverride: brandHealthAssessments.overallOverride,
        overrideReason: brandHealthAssessments.overrideReason,
      })
      .from(brandHealthAssessments)
      .innerJoin(brands, eq(brandHealthAssessments.brandId, brands.id))
      .where(dateRangeFilter(brandHealthAssessments.businessDate, input.range))
      .orderBy(asc(brandHealthAssessments.businessDate), asc(brands.name))),
    brandSentiment: async () => asRows(await db
      .select({
        businessDate: brandSentimentSnapshots.businessDate,
        brand: brands.name,
        source: brandSentimentSnapshots.source,
        positiveMentions: brandSentimentSnapshots.positiveMentions,
        neutralMentions: brandSentimentSnapshots.neutralMentions,
        negativeMentions: brandSentimentSnapshots.negativeMentions,
        positiveTheme: brandSentimentSnapshots.positiveTheme,
        negativeTheme: brandSentimentSnapshots.negativeTheme,
      })
      .from(brandSentimentSnapshots)
      .innerJoin(brands, eq(brandSentimentSnapshots.brandId, brands.id))
      .where(dateRangeFilter(brandSentimentSnapshots.businessDate, input.range))
      .orderBy(asc(brandSentimentSnapshots.businessDate), asc(brands.name))),
    digitalReputation: async () => asRows(await db
      .select({
        businessDate: digitalReputationSnapshots.businessDate,
        brand: sql<string>`coalesce(${brands.name}, 'Group')`,
        googleRating: sql<number>`${digitalReputationSnapshots.googleRating}::float8`,
        googleReviewCount: digitalReputationSnapshots.googleReviewCount,
        instagramSentiment: sql<number>`${digitalReputationSnapshots.instagramSentiment}::float8`,
        instagramFollowers: digitalReputationSnapshots.instagramFollowers,
        responseRate: sql<number>`${digitalReputationSnapshots.responseRate}::float8`,
        averageResponseHours: sql<number>`${digitalReputationSnapshots.averageResponseHours}::float8`,
        nps: digitalReputationSnapshots.nps,
        trustpilotRating: sql<number>`${digitalReputationSnapshots.trustpilotRating}::float8`,
        newReviews: digitalReputationSnapshots.newReviews,
        negativeReviews: digitalReputationSnapshots.negativeReviews,
      })
      .from(digitalReputationSnapshots)
      .leftJoin(brands, eq(digitalReputationSnapshots.brandId, brands.id))
      .where(dateRangeFilter(digitalReputationSnapshots.businessDate, input.range))
      .orderBy(asc(digitalReputationSnapshots.businessDate), asc(brands.name))),
    competitors: async () => asRows(await db
      .select({
        businessDate: competitorActivities.businessDate,
        competitor: competitorActivities.competitor,
        brand: brands.name,
        shareOfVoice: sql<number>`${competitorActivities.shareOfVoice}::float8`,
        activityType: competitorActivities.activityType,
        threatLevel: competitorActivities.threatLevel,
        description: competitorActivities.description,
        recommendedResponse: competitorActivities.recommendedResponse,
      })
      .from(competitorActivities)
      .leftJoin(brands, eq(competitorActivities.brandId, brands.id))
      .where(dateRangeFilter(competitorActivities.businessDate, input.range))
      .orderBy(asc(competitorActivities.businessDate), desc(competitorActivities.threatLevel))),
    weeklyReviews: async () => asRows(await db
      .select({
        weekEnd: weeklyReviews.weekEnd,
        storeName: stores.name,
        status: weeklyReviews.status,
        summary: weeklyReviews.summary,
        risks: weeklyReviews.risks,
        opportunities: weeklyReviews.opportunities,
        amplifyCategory: categories.name,
        differentThisWeek: weeklyReviews.differentThisWeek,
        firstThreeActions: weeklyReviews.firstThreeActions,
        approvedAt: weeklyReviews.approvedAt,
      })
      .from(weeklyReviews)
      .innerJoin(stores, eq(weeklyReviews.storeId, stores.id))
      .leftJoin(categories, eq(weeklyReviews.marketingAmplifyCategoryId, categories.id))
      .where(and(dateRangeFilter(weeklyReviews.weekEnd, input.range), storeCondition(weeklyReviews.storeId)))
      .orderBy(asc(weeklyReviews.weekEnd), asc(stores.name))),
    weeklyReviewActions: async () => asRows(await db
      .select({
        weekEnd: weeklyReviews.weekEnd,
        storeName: stores.name,
        category: categories.name,
        sku: products.sku,
        product: products.name,
        action: weeklyReviewActions.action,
        ownerName: sql<string>`coalesce(${users.name}, ${weeklyReviewActions.ownerName}, 'Unassigned')`,
        targetUnits: weeklyReviewActions.targetUnits,
        targetRevenue: sql<number>`${weeklyReviewActions.targetRevenue}::float8`,
        dueDate: weeklyReviewActions.dueDate,
        status: weeklyReviewActions.status,
        managerComment: weeklyReviewActions.managerComment,
      })
      .from(weeklyReviewActions)
      .innerJoin(weeklyReviews, eq(weeklyReviewActions.weeklyReviewId, weeklyReviews.id))
      .innerJoin(stores, eq(weeklyReviews.storeId, stores.id))
      .leftJoin(categories, eq(weeklyReviewActions.categoryId, categories.id))
      .leftJoin(products, eq(weeklyReviewActions.productId, products.id))
      .leftJoin(users, eq(weeklyReviewActions.ownerUserId, users.id))
      .where(and(dateRangeFilter(weeklyReviews.weekEnd, input.range), storeCondition(weeklyReviews.storeId)))
      .orderBy(asc(weeklyReviews.weekEnd), asc(stores.name), asc(weeklyReviewActions.dueDate))),
    actionItems: async () => asRows(await db
      .select({
        createdAt: actionItems.createdAt,
        department: actionItems.department,
        storeName: stores.name,
        brand: brands.name,
        category: categories.name,
        title: actionItems.title,
        detail: actionItems.detail,
        priority: actionItems.priority,
        ownerName: sql<string>`coalesce(${users.name}, ${actionItems.ownerName}, 'Unassigned')`,
        dueDate: actionItems.dueDate,
        status: actionItems.status,
      })
      .from(actionItems)
      .leftJoin(stores, eq(actionItems.storeId, stores.id))
      .leftJoin(brands, eq(actionItems.brandId, brands.id))
      .leftJoin(categories, eq(actionItems.categoryId, categories.id))
      .leftJoin(users, eq(actionItems.ownerUserId, users.id))
      .where(timestampRangeFilter(actionItems.createdAt, input.range))
      .orderBy(asc(actionItems.createdAt), asc(actionItems.department))),
    storeStandards: async () => asRows(await db
      .select({
        businessDate: storeStandardReviews.businessDate,
        storeName: stores.name,
        operationsScore: storeStandardReviews.operationsScore,
        vmScore: storeStandardReviews.vmScore,
        readinessScore: storeStandardReviews.readinessScore,
        customerExperienceScore: storeStandardReviews.customerExperienceScore,
        cleanlinessScore: storeStandardReviews.cleanlinessScore,
        safetyScore: storeStandardReviews.safetyScore,
        issues: storeStandardReviews.issues,
      })
      .from(storeStandardReviews)
      .innerJoin(stores, eq(storeStandardReviews.storeId, stores.id))
      .where(dateRangeFilter(storeStandardReviews.businessDate, input.range))
      .orderBy(asc(storeStandardReviews.businessDate), asc(stores.name))),
    incidents: async () => asRows(await db
      .select({
        occurredAt: incidents.occurredAt,
        storeName: stores.name,
        type: incidents.type,
        severity: incidents.severity,
        status: incidents.status,
        description: incidents.description,
        immediateAction: incidents.immediateAction,
        followUpRequired: incidents.followUpRequired,
        resolvedAt: incidents.resolvedAt,
      })
      .from(incidents)
      .innerJoin(stores, eq(incidents.storeId, stores.id))
      .where(timestampRangeFilter(incidents.occurredAt, input.range))
      .orderBy(asc(incidents.occurredAt), asc(stores.name))),
    peopleSnapshots: async () => asRows(await db
      .select({
        businessDate: peopleSnapshots.businessDate,
        storeName: stores.name,
        staffTotal: peopleSnapshots.staffTotal,
        staffPresent: peopleSnapshots.staffPresent,
        punctualityScore: peopleSnapshots.punctualityScore,
        trainingCompletionScore: peopleSnapshots.trainingCompletionScore,
        absenceReason: peopleSnapshots.absenceReason,
        notes: peopleSnapshots.notes,
      })
      .from(peopleSnapshots)
      .innerJoin(stores, eq(peopleSnapshots.storeId, stores.id))
      .where(dateRangeFilter(peopleSnapshots.businessDate, input.range))
      .orderBy(asc(peopleSnapshots.businessDate), asc(stores.name))),
  };

  const sheetKeys = SCOPE_SHEETS[input.scope];
  if (sheetKeys.includes('customerFeedback')) {
    const { redactExpiredSurveyContacts } = await import('./survey-retention');
    await redactExpiredSurveyContacts();
  }
  const loaded = await Promise.all(sheetKeys.map(async (key) => [key, await loaders[key]()] as const));
  return Object.fromEntries(loaded) as Partial<Record<ExportSheetKey, ExportRow[]>>;
}
