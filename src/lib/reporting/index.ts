import type {
  AnalyticsResponse,
  AnalyticsView,
  BrandDomain,
  CommercialDomain,
  ExecutiveDomain,
  FinanceDomain,
  InventoryDomain,
  MarketingDomain,
  OperationsDomain,
  StoreDomain,
} from '../contracts/analytics';
import { getActivityFeed } from './activity';
import { getBrandDomain } from './brand';
import { getCommercialDomain } from './commercial';
import { getFinanceDomain } from './finance';
import { getInventoryDomain } from './inventory';
import { getMarketingDomain } from './marketing';
import { getOperationsDomain } from './operations';
import { analyticsMeta, type AnalyticsScope } from './shared';
import { getStoreDomain } from './store';
import { getTradingOverview } from './trading';

async function getExecutiveDomain(scope: AnalyticsScope): Promise<ExecutiveDomain> {
  const [finance, commercial, marketing, operations, inventory, brand, activity] = await Promise.all([
    getFinanceDomain(scope),
    getCommercialDomain(scope),
    getMarketingDomain(scope),
    getOperationsDomain(scope),
    getInventoryDomain(scope),
    getBrandDomain(scope),
    getActivityFeed(scope),
  ]);
  return {
    finance: {
      ...finance.budget,
      ...finance.profitability,
      ...finance.cash,
      workingCapitalOverdue: finance.workingCapital.overdue,
    },
    marketing: marketing.summary,
    operations: operations.summary,
    peopleHealth: operations.peopleHealth,
    staffing: operations.staffing,
    inventory: inventory.summary,
    brand: brand.summary,
    managerVoices: commercial.managerVoices,
    weeklyReviews: commercial.weeklyReviews,
    activity,
  };
}

export async function getAnalyticsResponse(
  view: AnalyticsView,
  scope: AnalyticsScope
): Promise<AnalyticsResponse> {
  const metaPromise = analyticsMeta(scope);

  if (view === 'executive') {
    const [meta, trading, domain] = await Promise.all([
      metaPromise,
      getTradingOverview(scope),
      getExecutiveDomain(scope),
    ]);
    return { meta, trading, domain };
  }
  if (view === 'finance') {
    const [meta, trading, domain] = await Promise.all([metaPromise, getTradingOverview(scope), getFinanceDomain(scope)]);
    return { meta, trading, domain: domain satisfies FinanceDomain };
  }
  if (view === 'commercial') {
    const [meta, trading, domain] = await Promise.all([
      metaPromise,
      getTradingOverview(scope),
      getCommercialDomain(scope),
    ]);
    return { meta, trading, domain: domain satisfies CommercialDomain };
  }
  if (view === 'operations') {
    const [meta, trading, domain] = await Promise.all([
      metaPromise,
      getTradingOverview(scope),
      getOperationsDomain(scope),
    ]);
    return { meta, trading, domain: domain satisfies OperationsDomain };
  }
  if (view === 'marketing') {
    const [meta, domain] = await Promise.all([metaPromise, getMarketingDomain(scope)]);
    return { meta, domain: domain satisfies MarketingDomain };
  }
  if (view === 'inventory') {
    const [meta, domain] = await Promise.all([metaPromise, getInventoryDomain(scope)]);
    return { meta, domain: domain satisfies InventoryDomain };
  }
  if (view === 'brand') {
    const [meta, domain] = await Promise.all([metaPromise, getBrandDomain(scope)]);
    return { meta, domain: domain satisfies BrandDomain };
  }
  const [meta, trading, domain] = await Promise.all([metaPromise, getTradingOverview(scope), getStoreDomain(scope)]);
  return { meta, trading, domain: domain satisfies StoreDomain };
}
