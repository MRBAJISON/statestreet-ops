import type { Entry } from './db/schema';
import { BRAND_LABELS, STORE_LABELS, CATEGORY_LABELS, labelFor } from './config';

const num = (v: unknown) => Number(String(v ?? '').replace(/[, ]/g, '')) || 0;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

type P = Record<string, unknown>;
const payloads = (rows: Entry[], type: string): P[] =>
  rows.filter((r) => r.formType === type).map((r) => r.payload as P);

// Sum `valKey` grouped by `key` -> [{name, value}]
function groupSum(items: P[], key: string, valKey: string) {
  const m = new Map<string, number>();
  for (const p of items) {
    const k = String(p[key] ?? '—');
    m.set(k, (m.get(k) ?? 0) + num(p[valKey]));
  }
  return [...m].map(([name, value]) => ({ name, value }));
}

// Average `valKey` grouped by `key` -> [{name, value}]
function groupAvg(items: P[], key: string, valKey: string) {
  const m = new Map<string, number[]>();
  for (const p of items) {
    const k = String(p[key] ?? '—');
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(num(p[valKey]));
  }
  return [...m].map(([name, vals]) => ({ name, value: round1(avg(vals)) }));
}

/* ----------------------------- FINANCE ----------------------------- */
function financeMetrics(rows: Entry[]) {
  const labels = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const daily = new Array(31).fill(0);
  const brandMap = new Map<string, number>();
  let revenueMtd = 0;
  let cogsTotal = 0;
  let transactions = 0;
  let footfall = 0;
  let itemsSold = 0;

  for (const p of payloads(rows, 'revenue')) {
    const gross = num(p.grossRevenue);
    revenueMtd += gross;
    cogsTotal += num(p.cogs);
    transactions += num(p.transactions);
    footfall += num(p.footfall);
    itemsSold += num(p.itemsSold);
    const brandKey = String(p.brand ?? '');
    const brand = BRAND_LABELS[brandKey] ?? (brandKey || 'Others');
    brandMap.set(brand, (brandMap.get(brand) ?? 0) + gross);
    const d = p.date ? new Date(String(p.date)) : null;
    const day = d && !isNaN(d.getTime()) ? d.getDate() : 0;
    if (day >= 1 && day <= 31) daily[day - 1] += gross;
  }

  // Debtors / creditors (debtors form)
  const deb = payloads(rows, 'debtors');
  const debtors = deb
    .filter((p) => String(p.type) === 'debtor')
    .reduce((s, p) => s + num(p.amount), 0);
  const creditors = deb
    .filter((p) => String(p.type) === 'creditor')
    .reduce((s, p) => s + num(p.amount), 0);

  // Cash flow (cashflow form)
  const cf = payloads(rows, 'cashflow');
  const cashInflow = cf
    .filter((p) => String(p.type) === 'inflow')
    .reduce((s, p) => s + num(p.amount), 0);
  const cashOutflow = cf
    .filter((p) => String(p.type) === 'outflow')
    .reduce((s, p) => s + num(p.amount), 0);

  // Expenses (expenses form) — actual + budget per category
  const exp = payloads(rows, 'expenses');
  const expensesTotal = exp.reduce((s, p) => s + num(p.amount), 0);
  const expenseBudgetTotal = exp.reduce((s, p) => s + num(p.budget), 0);
  const expCatMap = new Map<string, { actual: number; budget: number }>();
  for (const p of exp) {
    const cat = String(p.category ?? 'other');
    const e = expCatMap.get(cat) ?? { actual: 0, budget: 0 };
    e.actual += num(p.amount);
    e.budget += num(p.budget);
    expCatMap.set(cat, e);
  }
  const expensesByCategory = [...expCatMap].map(([name, v]) => ({
    name,
    actual: v.actual,
    budget: v.budget,
  }));

  // Profit & loss (now that COGS is captured)
  const grossProfit = revenueMtd - cogsTotal;
  const grossMargin = revenueMtd ? round1((grossProfit / revenueMtd) * 100) : 0;
  const operatingProfit = grossProfit - expensesTotal;
  const operatingMargin = revenueMtd ? round1((operatingProfit / revenueMtd) * 100) : 0;
  const netProfit = operatingProfit; // before tax/interest (not captured)
  const netMargin = revenueMtd ? round1((netProfit / revenueMtd) * 100) : 0;

  // Forecast (latest forecast entry)
  const fc = payloads(rows, 'forecast');
  const lastFc = fc[fc.length - 1] ?? {};

  return {
    revenueMtd,
    cogs: cogsTotal,
    revenueByBrand: [...brandMap].map(([name, value]) => ({ name, value })),
    daily,
    labels,
    transactions,
    footfall,
    itemsSold,
    expensesByCategory,
    expensesTotal,
    expenseBudgetTotal,
    grossProfit,
    grossMargin,
    operatingProfit,
    operatingMargin,
    netProfit,
    netMargin,
    debtors,
    creditors,
    cashInflow,
    cashOutflow,
    cashNet: cashInflow - cashOutflow,
    operatingResult: operatingProfit,
    forecast: {
      revenue: num(lastFc.revenueForecast),
      grossProfit: num(lastFc.gpForecast),
      netProfit: num(lastFc.npForecast),
      cash: num(lastFc.cashForecast),
    },
    entryCount: rows.length,
  };
}

/* ---------------------------- COMMERCIAL --------------------------- */
function commercialMetrics(rows: Entry[]) {
  const ss = payloads(rows, 'store-sales');
  const cp = payloads(rows, 'category-perf');
  const sku = payloads(rows, 'sku-entry');

  const groupSales = ss.reduce((s, p) => s + num(p.totalSales), 0);
  const tx = ss.reduce((s, p) => s + num(p.transactions), 0);
  const units = ss.reduce((s, p) => s + num(p.unitsSold), 0);

  return {
    groupSales,
    atv: tx ? Math.round(groupSales / tx) : Math.round(avg(ss.map((p) => num(p.atv)))),
    upt: tx ? round1(units / tx) : 0,
    convRate: round1(avg(ss.map((p) => num(p.convRate)).filter((n) => n > 0))),
    grossMargin: round1(avg(cp.map((p) => num(p.gm)).filter((n) => n > 0))),
    sellThrough: round1(avg(cp.map((p) => num(p.sellThrough)).filter((n) => n > 0))),
    activeSku: new Set(sku.map((p) => String(p.sku)).filter(Boolean)).size,
    categorySales: groupSum(cp, 'category', 'sales').map((x) => ({
      name: labelFor(CATEGORY_LABELS, x.name),
      value: x.value,
    })),
    sellThroughByCategory: groupAvg(cp, 'category', 'sellThrough').map((x) => ({
      name: labelFor(CATEGORY_LABELS, x.name),
      value: x.value,
    })),
    salesByStore: groupSum(ss, 'store', 'totalSales').map((x) => ({
      name: labelFor(STORE_LABELS, x.name),
      value: x.value,
    })),
    entryCount: rows.length,
  };
}

/* ---------------------------- OPERATIONS --------------------------- */
function operationsMetrics(rows: Entry[]) {
  const audit = payloads(rows, 'store-audit');
  const vm = payloads(rows, 'vm-check');
  const maint = payloads(rows, 'maintenance');
  const inc = payloads(rows, 'incident');
  const sop = payloads(rows, 'sop-check');

  const closed = (s: unknown) => /resolv|close|complete|done/i.test(String(s));
  const maintDone = maint.filter((p) => closed(p.status)).length;
  const sev = (lvl: string) =>
    inc.filter((p) => String(p.severity).toLowerCase().includes(lvl)).length;

  // Per-store audit scores
  const storeMap = new Map<string, { ops: number[]; vm: number[]; readiness: number[]; cx: number[] }>();
  for (const p of audit) {
    const k = labelFor(STORE_LABELS, p.store);
    if (!storeMap.has(k)) storeMap.set(k, { ops: [], vm: [], readiness: [], cx: [] });
    const e = storeMap.get(k)!;
    e.ops.push(num(p.opsScore));
    e.vm.push(num(p.vmScore));
    e.readiness.push(num(p.readinessScore));
    e.cx.push(num(p.cxScore));
  }
  const storeScores = [...storeMap].map(([store, v]) => ({
    store,
    ops: round1(avg(v.ops)),
    vm: round1(avg(v.vm)),
    readiness: round1(avg(v.readiness)),
    cx: round1(avg(v.cx)),
  }));

  return {
    opsScore: round1(avg(audit.map((p) => num(p.opsScore)).filter((n) => n > 0))),
    vmScore: round1(
      avg(
        [...vm.map((p) => num(p.overallVM)), ...audit.map((p) => num(p.vmScore))].filter((n) => n > 0)
      )
    ),
    readiness: round1(avg(audit.map((p) => num(p.readinessScore)).filter((n) => n > 0))),
    sopCompliance: round1(avg(sop.map((p) => num(p.compliance)).filter((n) => n > 0))),
    cxScore: round1(avg(audit.map((p) => num(p.cxScore)).filter((n) => n > 0))),
    maintenanceCompliance: maint.length ? round1((maintDone / maint.length) * 100) : 0,
    openIssues:
      inc.filter((p) => !closed(p.status)).length + maint.filter((p) => !closed(p.status)).length,
    incidentsTotal: inc.length,
    vmByStore: (vm.length ? groupAvg(vm, 'store', 'overallVM') : groupAvg(audit, 'store', 'vmScore')).map(
      (x) => ({ name: labelFor(STORE_LABELS, x.name), value: x.value })
    ),
    storeScores,
    risk: { high: sev('high'), medium: sev('med'), low: sev('low') },
    entryCount: rows.length,
  };
}

/* ----------------------------- INVENTORY --------------------------- */
function inventoryMetrics(rows: Entry[]) {
  const sc = payloads(rows, 'stock-count');
  const gr = payloads(rows, 'goods-receipt');
  const ds = payloads(rows, 'dead-stock');
  const rep = payloads(rows, 'replenishment');

  const onHandValue = sc.reduce((s, p) => s + num(p.physicalQty) * num(p.unitValue), 0);
  const receivedValue = gr.reduce((s, p) => s + num(p.totalValue), 0);
  const inventoryValue = onHandValue || receivedValue;
  const sysTotal = sc.reduce((s, p) => s + num(p.systemQty), 0);
  const varTotal = sc.reduce(
    (s, p) => s + Math.abs(num(p.variance) || num(p.systemQty) - num(p.physicalQty)),
    0
  );
  const deadValue = ds.reduce((s, p) => s + num(p.stockValue), 0);

  // Accuracy distribution buckets (share of stock-count lines by variance %)
  const buckets = { within2: 0, b2_5: 0, b5_10: 0, over10: 0 };
  for (const p of sc) {
    const sys = num(p.systemQty);
    const variance = Math.abs(num(p.variance) || sys - num(p.physicalQty));
    const vp = sys ? (variance / sys) * 100 : 0;
    if (vp <= 2) buckets.within2++;
    else if (vp <= 5) buckets.b2_5++;
    else if (vp <= 10) buckets.b5_10++;
    else buckets.over10++;
  }
  const scTotal = sc.length || 1;
  const accuracyDistribution = [
    { name: 'Accurate (≤2%)', value: round1((buckets.within2 / scTotal) * 100) },
    { name: 'Variance (2-5%)', value: round1((buckets.b2_5 / scTotal) * 100) },
    { name: 'Variance (5-10%)', value: round1((buckets.b5_10 / scTotal) * 100) },
    { name: 'Variance (>10%)', value: round1((buckets.over10 / scTotal) * 100) },
  ];

  // Monthly received-value trend (goods receipts grouped by month)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trendMap = new Map<string, number>();
  for (const p of gr) {
    const dt = p.date ? new Date(String(p.date)) : null;
    if (!dt || isNaN(dt.getTime())) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    trendMap.set(key, (trendMap.get(key) ?? 0) + num(p.totalValue));
  }
  const valueTrend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, value]) => ({ name: MONTHS[parseInt(k.slice(5), 10) - 1] ?? k, value }));

  return {
    inventoryValue,
    accuracy: sysTotal ? round1(Math.max(0, 100 - (varTotal / sysTotal) * 100)) : 0,
    deadPct: inventoryValue ? round1((deadValue / inventoryValue) * 100) : 0,
    outOfStock: rep.filter((p) => num(p.currentStock) === 0).length || rep.length,
    byBrand: groupSum(gr, 'brand', 'totalValue').map((x) => ({
      name: labelFor(BRAND_LABELS, x.name),
      value: x.value,
    })),
    accuracyDistribution,
    valueTrend,
    entryCount: rows.length,
  };
}

/* --------------------------- BRAND HEALTH -------------------------- */
function brandMetrics(rows: Entry[]) {
  const score = payloads(rows, 'brand-score');
  const sent = payloads(rows, 'sentiment');
  const comp = payloads(rows, 'competitor');
  const dig = payloads(rows, 'digital');

  const positive = sent.reduce((s, p) => s + num(p.positive), 0);
  const neutral = sent.reduce((s, p) => s + num(p.neutral), 0);
  const negative = sent.reduce((s, p) => s + num(p.negative), 0);
  const total = positive + neutral + negative;

  // Monthly positive-sentiment trend
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trendMap = new Map<string, { pos: number; total: number }>();
  for (const p of sent) {
    const dt = p.date ? new Date(String(p.date)) : null;
    if (!dt || isNaN(dt.getTime())) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const e = trendMap.get(key) ?? { pos: 0, total: 0 };
    e.pos += num(p.positive);
    e.total += num(p.positive) + num(p.neutral) + num(p.negative);
    trendMap.set(key, e);
  }
  const sentimentTrend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({
      name: MONTHS[parseInt(k.slice(5), 10) - 1] ?? k,
      value: v.total ? Math.round((v.pos / v.total) * 100) : 0,
    }));

  // Portfolio health from brand-score (avg overall per brand)
  const portMap = new Map<string, number[]>();
  for (const p of score) {
    const b = BRAND_LABELS[String(p.brand)] ?? String(p.brand || '—');
    if (!portMap.has(b)) portMap.set(b, []);
    portMap.get(b)!.push(num(p.overall));
  }
  const portfolio = [...portMap].map(([brand, vals]) => {
    const s = Math.round(avg(vals));
    return { brand, score: s, status: s >= 80 ? 'STRONG' : s >= 70 ? 'STABLE' : 'AT RISK', trend: 'stable' };
  });
  const healthIndex = portfolio.length ? Math.round(avg(portfolio.map((p) => p.score))) : 0;

  return {
    sentiment: {
      positive: total ? Math.round((positive / total) * 100) : 0,
      neutral: total ? Math.round((neutral / total) * 100) : 0,
      negative: total ? Math.round((negative / total) * 100) : 0,
    },
    nps: Math.round(avg(dig.map((p) => num(p.nps)).filter((n) => n !== 0))),
    momentum: Math.round(avg(score.map((p) => num(p.momentum)).filter((n) => n > 0))),
    shareOfConversation: groupAvg(comp, 'competitor', 'sov'),
    sentimentTrend,
    portfolio,
    healthIndex,
    entryCount: rows.length,
  };
}

/* ---------------------------- MARKETING ---------------------------- */
function marketingMetrics(rows: Entry[]) {
  const leads = payloads(rows, 'leads');
  const camp = payloads(rows, 'campaign');
  const spend = camp.reduce((s, p) => s + num(p.spend), 0);
  const campaignRevenue = camp.reduce((s, p) => s + num(p.revenue), 0);

  const social = payloads(rows, 'social');

  return {
    leadChannelMix: groupSum(leads, 'channel', 'count'),
    totalLeads: leads.reduce((s, p) => s + num(p.count), 0),
    converted: leads.reduce((s, p) => s + num(p.converted), 0),
    totalReach: camp.reduce((s, p) => s + num(p.reach), 0),
    campaignRevenue,
    spend,
    roas: spend ? round1(campaignRevenue / spend) : 0,
    funnel: {
      reach: camp.reduce((s, p) => s + num(p.reach), 0),
      engagement: camp.reduce((s, p) => s + num(p.engagement), 0),
      leads: camp.reduce((s, p) => s + num(p.leads), 0),
      storeVisits: camp.reduce((s, p) => s + num(p.storeVisits), 0),
      revenueInfluenced: campaignRevenue,
    },
    social: {
      followers: social.reduce((s, p) => s + num(p.followers), 0),
      reach: social.reduce((s, p) => s + num(p.reach), 0),
      impressions: social.reduce((s, p) => s + num(p.impressions), 0),
      engagement: social.reduce((s, p) => s + num(p.engagement), 0),
      clicks: social.reduce((s, p) => s + num(p.clicks), 0),
    },
    entryCount: rows.length,
  };
}

export function computeMetrics(department: string, rows: Entry[]) {
  switch (department) {
    case 'finance':
      return { department, ...financeMetrics(rows) };
    case 'commercial':
      return { department, ...commercialMetrics(rows) };
    case 'operations':
      return { department, ...operationsMetrics(rows) };
    case 'inventory':
      return { department, ...inventoryMetrics(rows) };
    case 'brand':
      return { department, ...brandMetrics(rows) };
    case 'marketing':
      return { department, ...marketingMetrics(rows) };
    default:
      return { department, entryCount: rows.length };
  }
}

export type Metrics = ReturnType<typeof computeMetrics>;
