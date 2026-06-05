export type Department = 'executive' | 'finance' | 'commercial' | 'marketing' | 'operations' | 'inventory' | 'brand';

export type UserRole = 'owner' | 'finance' | 'commercial' | 'marketing' | 'operations' | 'inventory' | 'brand';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: Department;
}

export interface KPI {
  label: string;
  value: string | number;
  target?: string | number;
  change?: number;
  changeLabel?: string;
  status?: 'green' | 'yellow' | 'red';
  prefix?: string;
  suffix?: string;
}

export interface StoreData {
  rank: number;
  name: string;
  sales: number;
  target: number;
  achievement: number;
  vsLastMonth?: number;
}

export interface FinanceData {
  revenue: { mtd: number; target: number; daily: number[]; labels: string[] };
  grossProfit: { mtd: number; margin: number };
  operatingProfit: { mtd: number; margin: number };
  netProfit: { mtd: number; change: number };
  cashBalance: { current: number; change: number };
  debtors: { total: number; change: number };
  creditors: { total: number; change: number };
  inventoryValue: { total: number; turnRatio: number };
  cashFlow: { inflow: number; outflow: number; net: number; trend: number[] };
  expenses: { categories: { name: string; actual: number; budget: number }[] };
  revenueByBrand: { name: string; value: number }[];
  profitability: {
    metrics: { name: string; mtd: number; ytd: number; change: number }[];
  };
  workingCapital: { inventory: number; debtors: number; creditors: number; ratio: number };
  cashRunway: number;
  forecast: { revenue: number; grossProfit: number; netProfit: number };
  healthCheck: { profitability: string; liquidity: string; solvency: string; efficiency: string; cashFlow: string };
}

export interface CommercialData {
  groupSales: { mtd: number; target: number };
  grossMargin: { pct: number; target: number };
  atv: { value: number; target: number };
  upt: { value: number; target: number };
  conversionRate: { pct: number; target: number };
  sellThrough: { pct: number; target: number };
  activeSku: number;
  stores: StoreData[];
  categories: { name: string; sales: number; achievement: number; mix: number }[];
  topSelling: { rank: number; sku: string; name: string; sales: number; qty: number }[];
  lowMoving: { sku: string; description: string; category: string; days: number; value: number }[];
  deadStock: { sku: string; description: string; category: string; days: number; value: number }[];
  newArrivals: { brand: string; qty: number; stockValue: number; sellThrough: number }[];
  focusProducts: { name: string; action: string; owner: string; deadline: string; status: string }[];
  accountability: { role: string; name: string; kpi: string; target: string; actual: string; achievement: number; status: string }[];
}

export interface MarketingData {
  brandHealth: { brand: string; awareness: number; preference: number; sentiment: number; score: number }[];
  campaigns: { name: string; brand: string; image?: string; reach: number; engagement: number; leads: number; revenue: number }[];
  acquisition: {
    whatsappLeads: number; instagramLeads: number; websiteLeads: number; walkInLeads: number; corporateLeads: number;
    totalLeads: number; costPerLead: number; newCustomers: number; clientDatabase: number;
  };
  newVsRepeat: { new: number; repeat: number };
  topChannel: string;
  clienteling: { vipEvents: number; lookbooks: number; broadcasts: number; invitations: number; rsvpRate: number; appointments: number };
  customerIntelligence: {
    topObjections: { reason: string; pct: number }[];
    competitorMentions: { brand: string; pct: number }[];
    topProductRequests: string[];
  };
  priorities: { task: string; keyAction: string; owner: string; deadline: string; status: string }[];
  teamPerformance: { metric: string; value: number; status: string }[];
}

export interface OperationsData {
  storeOpsScore: { pct: number; target: number };
  vmCompliance: { pct: number; target: number };
  storeReadiness: { pct: number; target: number };
  maintenanceCompliance: { pct: number; target: number };
  sopCompliance: { pct: number; target: number };
  cxScore: { pct: number; target: number };
  openIssues: number;
  storeOverview: { rank: number; name: string; opsScore: number; vmScore: number; readiness: number; cxScore: number }[];
  vmByStore: { store: string; compliance: number }[];
  maintenanceOrders: { open: number; completed: number; overdue: number; critical: number };
  deployment: { completion: number; categories: { name: string; planned: number; completed: number }[] };
  readinessIssues: { store: string; issue: string; impact: string; status: string }[];
  cxFeedbackThemes: { theme: string; count: number }[];
  sopAreas: { area: string; compliance: number }[];
  incidents: { total: number; security: number; safety: number; operational: number };
  riskLevel: { high: number; medium: number; low: number };
  actions: { action: string; owner: string; deadline: string; priority: string; status: string }[];
}

export interface InventoryData {
  totalValue: { current: number; change: number };
  turnRate: { value: number; target: number };
  sellThrough: { pct: number; target: number };
  gmroi: { value: number; target: number };
  weeksCover: { value: number; target: string };
  deadStockPct: { pct: number; target: string };
  outOfStock: number;
  accuracy: { pct: number; target: number };
  valueTrend: { month: string; value: number }[];
  byBrand: { name: string; value: number }[];
  healthByAge: { range: string; pct: number }[];
  byCategory: { name: string; value: number; pctTotal: number; weeksCover: number; sellThrough: number }[];
  slowMoving: { rank: number; sku: string; description: string; category: string; value: number; days: number }[];
  deadStockItems: { rank: number; sku: string; description: string; category: string; value: number; days: number }[];
  storeAccuracy: { store: string; accuracy: number }[];
  movement: { opening: number; received: number; sold: number; returns: number; transfers: number; closing: number };
  replenishment: { status: string; pos: number; value: number }[];
  optimizationActions: { action: string; priority: string; owner: string; deadline: string; status: string }[];
}

export interface BrandData {
  healthIndex: { score: number; vsLastMonth: number; vsLastYear: number };
  portfolio: { brand: string; score: number; status: string; trend: string }[];
  equity: { awareness: number; consideration: number; preference: number; loyalty: number; advocacy: number };
  shareOfConversation: { brand: string; pct: number }[];
  sentiment: { positive: number; neutral: number; negative: number; trend: { month: string; score: number }[] };
  marketPosition: { brand: string; pricePosition: number; perceivedQuality: number; isCompetitor?: boolean }[];
  momentumDrivers: { driver: string; score: number }[];
  merchandiseBrandHealth: { brand: string; awareness: number; consideration: number; preference: number; satisfaction: number; momentum: number; score: number }[];
  customerVoice: { compliments: string[]; frustrations: string[]; emergingThemes: string[] };
  categoryHealth: { category: string; health: number; trend: string }[];
  digitalReputation: { googleRating: number; instaSentiment: number; responseRate: number; nps: number };
  socialMedia: { reach: number; engagement: number; webVisits: number; leadsGenerated: number };
  brandWeather: { brand: string; weather: string; impact: string; driver: string }[];
  risks: string[];
  opportunities: string[];
  ceoAttention: { priority: string; issue: string; impact: string; owner: string; dueDate: string; status: string }[];
}

export interface DashboardData {
  finance: FinanceData;
  commercial: CommercialData;
  marketing: MarketingData;
  operations: OperationsData;
  inventory: InventoryData;
  brand: BrandData;
}
