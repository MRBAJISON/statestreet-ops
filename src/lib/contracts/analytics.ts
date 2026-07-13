import { z } from 'zod';
import { dateSchema, positiveIdSchema } from './shared';

export const analyticsViewSchema = z.enum([
  'executive',
  'finance',
  'commercial',
  'marketing',
  'operations',
  'inventory',
  'brand',
  'store',
]);

export const analyticsPresetSchema = z.enum(['7d', '30d', '90d', 'mtd', 'qtd', 'ytd', 'custom']);

export const analyticsQuerySchema = z
  .object({
    preset: analyticsPresetSchema.default('30d'),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    storeId: z.coerce.number().pipe(positiveIdSchema).optional(),
  })
  .superRefine((query, context) => {
    if (query.preset === 'custom' && (!query.from || !query.to)) {
      context.addIssue({ code: 'custom', path: ['from'], message: 'Custom ranges require from and to dates' });
    }
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({ code: 'custom', path: ['from'], message: 'from cannot be after to' });
    }
  });

export type AnalyticsView = z.infer<typeof analyticsViewSchema>;
export type AnalyticsPreset = z.infer<typeof analyticsPresetSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export interface AnalyticsStoreScope {
  id: number;
  code: string;
  name: string;
}

export interface AnalyticsMeta {
  preset: AnalyticsPreset;
  from: string;
  to: string;
  compareFrom: string;
  compareTo: string;
  currency: string;
  store: AnalyticsStoreScope | null;
  generatedAt: string;
}

export interface TradingSummary {
  netRevenue: number;
  previousNetRevenue: number;
  targetRevenue: number;
  cogs: number;
  grossProfit: number;
  previousGrossProfit: number;
  operatingProfit: number;
  previousOperatingProfit: number;
  netProfit: number;
  grossMargin: number;
  previousGrossMargin: number;
  operatingMargin: number;
  netMargin: number;
  sellThrough: number;
  conversionRate: number;
  previousConversionRate: number;
  averageTransactionValue: number;
  previousAverageTransactionValue: number;
  unitsSold: number;
  transactions: number;
  footfall: number;
  expenses: number;
  netCashFlow: number;
  inventoryValue: number;
  nps: number | null;
  openActions: number;
}

export interface TradingTrendPoint {
  date: string;
  revenue: number;
  target: number;
  grossProfit: number;
}

export interface StorePerformanceRow {
  id: number;
  code: string;
  name: string;
  brandName: string | null;
  revenue: number;
  target: number;
  attainment: number;
  grossMargin: number;
  conversionRate: number;
  transactions: number;
  operationsScore: number;
  visualMerchandisingScore: number;
}

export interface CategoryPerformanceRow {
  id: number;
  name: string;
  revenue: number;
  previousRevenue: number;
  units: number;
  openingStock: number;
  sellThrough: number;
  share: number;
}

export interface NamedValue {
  name: string;
  value: number;
}

export interface AttentionItem {
  id: number;
  department: string;
  title: string;
  detail: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  storeName: string | null;
  ownerName: string;
}

export interface ActivityItem {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  actorName: string;
  createdAt: string;
}

export interface TradingOverview {
  summary: TradingSummary;
  trend: TradingTrendPoint[];
  stores: StorePerformanceRow[];
  categories: CategoryPerformanceRow[];
  brands: NamedValue[];
  payments: NamedValue[];
  attention: AttentionItem[];
  actions: AttentionItem[];
  reportStatus: { draft: number; submitted: number; approved: number };
}

export interface AnalyticsResponse<TDomain = unknown> {
  meta: AnalyticsMeta;
  trading?: TradingOverview;
  domain: TDomain;
}

export interface FinanceDomain {
  budget: { budget: number; actual: number; variance: number; utilization: number };
  expenseCategories: Array<{ id: number; name: string; group: string; budget: number; actual: number }>;
  cashTrend: Array<{ date: string; inflow: number; outflow: number; net: number }>;
  cashAccounts: Array<{ id: number; name: string; type: string; balance: number }>;
  workingCapital: {
    debtors: number;
    creditors: number;
    overdue: number;
    items: Array<{ id: number; type: string; entity: string; amount: number; dueDate: string | null; status: string }>;
  };
  forecasts: Array<{
    id: number;
    periodStart: string;
    periodEnd: string;
    revenue: number;
    grossProfit: number;
    netProfit: number;
    cashBalance: number;
    confidence: string;
  }>;
  profitability: {
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    totalExpenses: number;
    operatingProfit: number;
    netProfit: number;
    grossMargin: number;
    operatingMargin: number;
    netMargin: number;
    capitalEmployed: number;
    investment: number;
    roce: number;
    roi: number;
  };
  cash: { inflow: number; outflow: number; net: number; position: number; runwayDays: number };
  storePnl: Array<{ id: number; name: string; revenue: number; expenses: number; profit: number }>;
  debtorAging: NamedValue[];
  overspend: Array<{ id: number; category: string; amount: number; reason: string; date: string }>;
  dailySalesByStore: Array<{ id: number; name: string; revenue: number; transactions: number; units: number; reports: number }>;
  pendingReports: Array<{ id: number; storeName: string; businessDate: string; updatedAt: string }>;
}

export interface ManagerVoice {
  reviewId: number;
  storeName: string;
  managerName: string;
  weekEnd: string;
  marketingAmplify: string | null;
  differentThisWeek: string | null;
  firstThreeActions: string | null;
}

export interface CommercialReview {
  id: number;
  lockVersion: number;
  storeName: string;
  managerName: string;
  weekEnd: string;
  status: string;
  summary: string | null;
  risks: string | null;
  opportunities: string | null;
  differentThisWeek: string | null;
  firstThreeActions: string | null;
  actionCount: number;
  actualRevenue: number;
  targetRevenue: number;
  achievement: number;
  stockAtRisk: number;
  atRiskCategories: number;
}

export interface CommercialDomain {
  customerFunnel: {
    leads: number;
    buyers: number;
    sources: NamedValue[];
  };
  productVelocity: Array<{
    id: number;
    sku: string;
    name: string;
    brandName: string;
    categoryName: string;
    unitsSold: number;
    stock: number;
    stockValue: number;
    daysSinceMovement: number | null;
    status: string | null;
    performance: string | null;
    campaign: string | null;
    insight: string | null;
  }>;
  weeklyReviews: CommercialReview[];
  managerVoices: ManagerVoice[];
  categoryTargets: Array<{ id: number; name: string; targetRevenue: number; actualRevenue: number; attainment: number }>;
  achievementTrend: Array<{ weekEnd: string; attainment: number }>;
  actions: AttentionItem[];
  newArrivals: Array<{ id: number; date: string; brandName: string; categoryName: string; units: number; value: number; storeName: string; supplierName: string }>;
  deploymentByStore: NamedValue[];
  customers: Array<{ id: number; date: string; name: string; phone: string; lifecycle: string; source: string; interest: string | null; storeName: string; staffName: string }>;
}

export interface MarketingDomain {
  summary: {
    spend: number;
    influencedRevenue: number;
    roas: number;
    leads: number;
    qualified: number;
    converted: number;
    costPerLead: number;
    nps: number | null;
  };
  funnel: { reach: number; engagement: number; leads: number; storeVisits: number; revenueInfluenced: number };
  contentCadence: { posts: number; reels: number; stories: number };
  campaigns: Array<{
    id: number;
    name: string;
    brandName: string;
    platform: string;
    spend: number;
    revenue: number;
    roas: number;
    reach: number;
    engagementRate: number;
    status: string;
  }>;
  leadChannels: Array<{ name: string; leads: number; qualified: number; converted: number }>;
  social: Array<{ platform: string; reach: number; impressions: number; engagement: number; clicks: number; followers: number; websiteVisits: number }>;
  campaignBrands: Array<{ name: string; spend: number; revenue: number; roas: number }>;
  clienteling: Array<{ type: string; contacted: number; responses: number; appointments: number; revenue: number }>;
  feedback: Array<{ type: string; count: number }>;
  feedbackDetail: Array<{ id: number; type: string; detail: string; frequency: string | null; storeName: string | null; source: string }>;
  actions: AttentionItem[];
  customerInsights: {
    captured: number;
    buyers: number;
    sources: NamedValue[];
    interests: NamedValue[];
    sizes: NamedValue[];
  };
}

export interface OperationsDomain {
  summary: {
    storeScore: number;
    operationsScore: number;
    visualMerchandisingScore: number;
    readinessScore: number;
    customerExperienceScore: number;
    maintenanceCompliance: number;
    openMaintenance: number;
    openIncidents: number;
    openIssues: number;
    attendance: number;
    sopCompliance: number;
  };
  stores: Array<{
    id: number;
    name: string;
    overall: number;
    operations: number;
    visualMerchandising: number;
    readiness: number;
    customerExperience: number;
    cleanliness: number;
    safety: number;
    maintenance: number;
    incidents: number;
    attendance: number;
  }>;
  maintenance: Array<{ id: number; storeName: string; category: string; priority: string; status: string; dueDate: string | null; cost: number }>;
  incidents: Array<{ id: number; storeName: string; type: string; severity: string; status: string; occurredAt: string }>;
  riskLevels: NamedValue[];
  incidentTypes: NamedValue[];
  incidentsByStore: NamedValue[];
  visualMerchandising: NamedValue[];
  keyIssues: Array<{ id: number; storeName: string; date: string; issues: string }>;
  customerExperience: { rating: number; nps: number | null; recommendRate: number; responses: number };
  peopleHealth: { score: number; attendance: number; punctuality: number; training: number; absences: number; snapshots: number; reasons: NamedValue[] };
  staffing: { total: number; present: number; absent: number };
  maintenanceSummary: { totalCost: number; openCost: number; overdue: number };
  maintenanceByCategory: Array<{ name: string; count: number; open: number; cost: number; openCost: number }>;
  maintenanceByAssignee: Array<{ name: string; count: number; open: number; openCost: number }>;
  sopByArea: NamedValue[];
  sopDeviations: Array<{ id: number; storeName: string; area: string; deviations: string; correctiveAction: string | null }>;
  correctiveActions: AttentionItem[];
}

export interface InventoryDomain {
  summary: { unitsOnHand: number; inventoryValue: number; stockAccuracy: number; deadStockPercent: number; lowStockProducts: number; openReplenishments: number; inTransitTransfers: number };
  stock: Array<{
    productId: number;
    sku: string;
    productName: string;
    storeName: string;
    units: number;
    value: number;
    lastMovement: string | null;
    risk: string;
  }>;
  receipts: Array<{ id: number; date: string; poNumber: string | null; supplierName: string; storeName: string; units: number; value: number; status: string }>;
  transfers: Array<{ id: number; date: string; fromStore: string; toStore: string; units: number; status: string }>;
  replenishments: Array<{ id: number; date: string; storeName: string; lines: number; units: number; status: string }>;
  valueByBrand: NamedValue[];
  receiptValueTrend: Array<{ date: string; value: number }>;
  accuracyDistribution: NamedValue[];
  movement: { receivedUnits: number; receivedValue: number; transferredUnits: number; transferredValue: number; deadStockValue: number; countedValue: number };
  supplierPerformance: NamedValue[];
  replenishmentLines: Array<{ id: number; sku: string; productName: string; currentStock: number; reorderQuantity: number; urgency: string; storeName: string }>;
  dispositions: Array<{ id: number; productName: string; categoryName: string; action: string; justification: string; value: number; storeName: string; status: string }>;
  dispositionActions: NamedValue[];
  receiptQuality: NamedValue[];
  receiptIssues: Array<{ id: number; supplierName: string; condition: string; discrepancy: string; date: string; storeName: string }>;
}

export interface BrandDomain {
  summary: { healthIndex: number; momentum: number; positiveSentiment: number; googleRating: number | null; nps: number | null; highThreats: number };
  brands: Array<{
    id: number;
    name: string;
    health: number;
    awareness: number;
    consideration: number;
    preference: number;
    satisfaction: number;
    loyalty: number;
    advocacy: number;
    momentum: number;
    positiveSentiment: number;
    googleRating: number | null;
  }>;
  competitors: Array<{ id: number; competitor: string; brandName: string | null; threatLevel: string; shareOfVoice: number | null; description: string; recommendedResponse: string | null }>;
  feedback: Array<{ type: string; count: number }>;
  equity: NamedValue[];
  sentiment: { positive: number; neutral: number; negative: number };
  sentimentTrend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  shareOfConversation: NamedValue[];
  digitalReputation: { googleRating: number | null; googleReviews: number; trustpilotRating: number | null; responseRate: number | null; nps: number | null; followers: number; newReviews: number; negativeReviews: number };
  risks: Array<{ text: string; tag: string }>;
  opportunities: Array<{ text: string; tag: string }>;
  attention: AttentionItem[];
}

export interface StoreDomain {
  recentReports: Array<{ id: number; businessDate: string; status: string; revenue: number; paymentVariance: number }>;
  weeklyReview: {
    id: number;
    weekEnd: string;
    status: string;
    risks: string | null;
    opportunities: string | null;
    differentThisWeek: string | null;
    actions: Array<{ id: number; action: string; owner: string; dueDate: string | null; status: string }>;
  } | null;
  lowStock: Array<{ productId: number; sku: string; name: string; units: number }>;
  customerSources: NamedValue[];
  customerHealth: { total: number; new: number; returning: number; repeatRate: number };
  transfers: Array<{ id: number; date: string; direction: 'incoming' | 'outgoing'; otherStore: string; units: number; status: string }>;
}

export interface ExecutiveDomain {
  finance: FinanceDomain['budget'] & FinanceDomain['profitability'] & FinanceDomain['cash'] & { workingCapitalOverdue: number };
  marketing: MarketingDomain['summary'];
  operations: OperationsDomain['summary'];
  peopleHealth: OperationsDomain['peopleHealth'];
  staffing: OperationsDomain['staffing'];
  inventory: InventoryDomain['summary'];
  brand: BrandDomain['summary'];
  managerVoices: ManagerVoice[];
  weeklyReviews: CommercialReview[];
  activity: ActivityItem[];
}
