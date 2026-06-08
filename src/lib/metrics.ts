import type { Entry } from './db/schema';
import { BRAND_LABELS, STORE_LABELS, CATEGORY_LABELS, labelFor } from './config';

const num = (v: unknown) => Number(String(v ?? '').replace(/[, ]/g, '')) || 0;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

type P = Record<string, unknown>;
const payloads = (rows: Entry[], type: string): P[] =>
  rows.filter((r) => r.formType === type).map((r) => r.payload as P);

export type Period = 'day' | 'week' | 'mtd' | 'ytd' | 'all';

// Best-effort date for an entry: a date field in the payload, else its createdAt.
function entryDate(r: Entry): Date {
  const p = r.payload as P;
  const cand = p.date ?? p.datetime ?? p.weekEnd ?? p.dueDate ?? p.deadline;
  const d = cand ? new Date(String(cand)) : new Date(r.createdAt as unknown as string);
  return isNaN(d.getTime()) ? new Date(r.createdAt as unknown as string) : d;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Monday-start week containing `d`.
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// Filter entries to a reporting period, anchored at `anchorISO` (defaults to today).
//  day  -> that calendar day   week -> the Mon–Sun week of the anchor
//  mtd  -> the anchor's month   ytd -> the anchor's year   all -> everything
export function filterByPeriod(rows: Entry[], period: Period, anchorISO?: string): Entry[] {
  if (period === 'all') return rows;
  const anchor = anchorISO ? new Date(anchorISO) : new Date();
  if (isNaN(anchor.getTime())) return rows;
  if (period === 'day') return rows.filter((r) => sameDay(entryDate(r), anchor));
  if (period === 'week') {
    const s = startOfWeek(anchor);
    const e = new Date(s);
    e.setDate(s.getDate() + 7);
    return rows.filter((r) => {
      const d = entryDate(r);
      return d >= s && d < e;
    });
  }
  if (period === 'ytd') return rows.filter((r) => entryDate(r).getFullYear() === anchor.getFullYear());
  return rows.filter((r) => {
    const d = entryDate(r);
    return d.getFullYear() === anchor.getFullYear() && d.getMonth() === anchor.getMonth();
  });
}

// Filter entries to a single store ('' or 'all' = every store).
export function filterByStore(rows: Entry[], store: string): Entry[] {
  if (!store || store === 'all') return rows;
  return rows.filter((r) => {
    const p = r.payload as P;
    return String(p.store ?? p.fromStore ?? p.toStore ?? '') === store;
  });
}

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

  // Expenses (expenses form) — actual + budget per category.
  // 'tax' and 'interest' are below-the-line items, excluded from operating expenses.
  const exp = payloads(rows, 'expenses');
  const expensesTotal = exp.reduce((s, p) => s + num(p.amount), 0);
  const expenseBudgetTotal = exp.reduce((s, p) => s + num(p.budget), 0);
  const taxTotal = exp.filter((p) => String(p.category) === 'tax').reduce((s, p) => s + num(p.amount), 0);
  const interestTotal = exp.filter((p) => String(p.category) === 'interest').reduce((s, p) => s + num(p.amount), 0);
  const belowLine = taxTotal + interestTotal;
  const operatingExpenses = expensesTotal - belowLine;
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

  // Profit & loss — auto-calculated
  const grossProfit = revenueMtd - cogsTotal;
  const grossMargin = revenueMtd ? round1((grossProfit / revenueMtd) * 100) : 0;
  const operatingProfit = grossProfit - operatingExpenses;
  const operatingMargin = revenueMtd ? round1((operatingProfit / revenueMtd) * 100) : 0;
  const netProfit = operatingProfit - belowLine; // less tax & interest
  const netMargin = revenueMtd ? round1((netProfit / revenueMtd) * 100) : 0;

  // Weekly cash-flow trend (net per ISO week) + position/runway
  const weekMap = new Map<string, number>();
  for (const p of cf) {
    const dt = p.date ? new Date(String(p.date)) : null;
    if (!dt || isNaN(dt.getTime())) continue;
    const onejan = new Date(dt.getFullYear(), 0, 1);
    const week = Math.ceil((((dt.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    const key = `${dt.getFullYear()}-W${String(week).padStart(2, '0')}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + (String(p.type) === 'inflow' ? num(p.amount) : -num(p.amount)));
  }
  const cashTrend = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value], i) => ({ name: `W${i + 1}`, value }));
  const cashPosition = cashInflow - cashOutflow; // closing position from recorded flows
  const runwayDays = operatingExpenses > 0 ? Math.max(0, Math.round((cashPosition / operatingExpenses) * 30)) : 0;

  // Forecast (latest forecast entry overall, and latest weekly forecast)
  const fc = payloads(rows, 'forecast');
  const lastFc = fc[fc.length - 1] ?? {};
  const lastWeekly = [...fc].reverse().find((p) => String(p.period) === 'weekly') ?? {};

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
    revenueByStore: groupSum(payloads(rows, 'revenue'), 'store', 'grossRevenue').map((x) => ({
      name: labelFor(STORE_LABELS, x.name),
      value: x.value,
    })),
    expensesByStore: groupSum(exp, 'store', 'amount')
      .filter((x) => x.name !== '—')
      .map((x) => ({ name: labelFor(STORE_LABELS, x.name), value: x.value })),
    debtorAging: groupSum(
      deb.filter((p) => String(p.type) === 'debtor'),
      'status',
      'amount'
    ).map((x) => ({ name: x.name === '—' ? 'Unspecified' : x.name, value: x.value })),
    expensesTotal,
    expenseBudgetTotal,
    operatingExpenses,
    tax: taxTotal,
    interest: interestTotal,
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
    cashTrend,
    cashPosition,
    runwayDays,
    operatingResult: operatingProfit,
    forecast: {
      revenue: num(lastFc.revenueForecast),
      grossProfit: num(lastFc.gpForecast),
      netProfit: num(lastFc.npForecast),
      cash: num(lastFc.cashForecast),
    },
    weeklyForecast: {
      revenue: num(lastWeekly.revenueForecast),
      grossProfit: num(lastWeekly.gpForecast),
      netProfit: num(lastWeekly.npForecast),
      cash: num(lastWeekly.cashForecast),
    },
    entryCount: rows.length,
  };
}

/* ---------------------------- COMMERCIAL --------------------------- */
function commercialMetrics(rows: Entry[]) {
  const ss = payloads(rows, 'store-sales');
  const cp = payloads(rows, 'category-perf');
  const sku = payloads(rows, 'sku-entry');

  const na = payloads(rows, 'new-arrivals');
  const acc = payloads(rows, 'accountability');

  // Store Manager Weekly Review aggregation
  const wr = payloads(rows, 'weekly-review');
  const wrCatRev = new Map<string, number>();
  const wrRatings: Record<string, number> = { Good: 0, Fair: 0, Poor: 0 };
  let wrStockAtRisk = 0;
  let wrAtRiskCats = 0;
  for (const r of wr) {
    const cats = (r.categories ?? {}) as Record<string, Record<string, unknown>>;
    for (const [name, f] of Object.entries(cats)) {
      wrCatRev.set(name, (wrCatRev.get(name) ?? 0) + num(f.revenue));
      const rt = String(f.rating ?? '');
      if (rt in wrRatings) wrRatings[rt] += 1;
      wrStockAtRisk += num(f.valueAtRisk);
      if (String(f.overstocked) === 'Y' || String(f.slowMoving) === 'Y' || num(f.valueAtRisk) > 0) wrAtRiskCats += 1;
    }
  }
  const wrLast = wr[wr.length - 1];
  const weeklyReview = {
    count: wr.length,
    revenueByCategory: [...wrCatRev]
      .map(([name, value]) => ({ name, value }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12),
    ratingCounts: [
      { name: 'Good', value: wrRatings.Good },
      { name: 'Fair', value: wrRatings.Fair },
      { name: 'Poor', value: wrRatings.Poor },
    ],
    stockAtRisk: wrStockAtRisk,
    atRiskCategories: wrAtRiskCats,
    latest: wrLast
      ? {
          store: labelFor(STORE_LABELS, wrLast.store),
          weekEnd: String(wrLast.weekEnd ?? ''),
          manager: String(wrLast.manager ?? ''),
          achievement: num(wrLast.achievement),
          actualSales: num(wrLast.actualSales),
          salesTarget: num(wrLast.weeklySalesTarget),
        }
      : null,
    ceo: (wrLast?.ceo as Record<string, string>) ?? null,
  };

  const groupSales = ss.reduce((s, p) => s + num(p.totalSales), 0);
  const tx = ss.reduce((s, p) => s + num(p.transactions), 0);
  const units = ss.reduce((s, p) => s + num(p.unitsSold), 0);

  // SKU performance
  const skus = sku.map((p) => ({
    sku: String(p.sku ?? ''),
    name: String(p.name ?? p.sku ?? ''),
    category: labelFor(CATEGORY_LABELS, p.category),
    salesValue: num(p.salesValue),
    unitsSold: num(p.unitsSold),
    stock: num(p.stock),
    daysInStock: num(p.daysInStock),
    status: String(p.status ?? ''),
  }));
  const topSelling = [...skus].sort((a, b) => b.salesValue - a.salesValue).slice(0, 6);
  const lowMoving = [...skus]
    .filter((s) => s.daysInStock >= 60 && s.daysInStock < 180)
    .sort((a, b) => b.daysInStock - a.daysInStock)
    .slice(0, 6);
  const deadStock = [...skus]
    .filter((s) => s.daysInStock >= 180 || /dead/i.test(s.status))
    .sort((a, b) => b.daysInStock - a.daysInStock)
    .slice(0, 6);

  // New arrivals
  const newArrivals = na
    .map((p) => ({
      date: String(p.date ?? ''),
      brand: labelFor(BRAND_LABELS, p.brand),
      category: labelFor(CATEGORY_LABELS, p.category),
      qty: num(p.qty),
      stockValue: num(p.stockValue),
      store: labelFor(STORE_LABELS, p.store),
      supplier: String(p.supplier ?? ''),
    }))
    .slice(0, 10);
  const deploymentByStore = groupSum(na, 'store', 'qty').map((x) => ({
    name: labelFor(STORE_LABELS, x.name),
    value: x.value,
  }));

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
    topSelling,
    lowMoving,
    deadStock,
    newArrivals,
    deploymentByStore,
    accountability: acc.map((p) => ({
      member: String(p.member || ''),
      role: String(p.role || ''),
      kpi: String(p.kpi || ''),
      target: String(p.target || ''),
      actual: String(p.actual || ''),
      status: String(p.status || ''),
    })),
    weeklyReview,
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
  const cx = payloads(rows, 'cx-feedback');

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

  // VM compliance breakdown (vm-check sub-scores)
  const vmDim = (k: string) => round1(avg(vm.map((p) => num(p[k])).filter((n) => n > 0)));
  const vmBreakdown = [
    { name: 'Window Display', value: vmDim('windowDisplay') },
    { name: 'Mannequin', value: vmDim('mannequin') },
    { name: 'Presentation', value: vmDim('productPresentation') },
    { name: 'Signage', value: vmDim('signage') },
    { name: 'Cleanliness', value: vmDim('cleanliness') },
  ];

  // Incidents by type
  const typeCount = (t: string) => inc.filter((p) => String(p.type).toLowerCase().includes(t)).length;
  const incidentsByType = { security: typeCount('secur'), safety: typeCount('safet'), operational: typeCount('operat') };

  // Top risks — high-severity incidents
  const topRisks = inc
    .filter((p) => /high|critical/i.test(String(p.severity)))
    .map((p) => ({
      description: String(p.description || p.type || 'Incident'),
      severity: String(p.severity || ''),
      store: labelFor(STORE_LABELS, p.store),
      status: String(p.status || ''),
    }))
    .slice(0, 8);

  // Priority actions — from maintenance requests
  const priorityActions = maint
    .map((p) => ({
      description: String(p.description || p.category || 'Maintenance'),
      priority: String(p.priority || ''),
      owner: String(p.assignedTo || p.reportedBy || ''),
      store: labelFor(STORE_LABELS, p.store),
      status: String(p.status || ''),
    }))
    .sort((a, b) => (/(critical|high)/i.test(b.priority) ? 1 : 0) - (/(critical|high)/i.test(a.priority) ? 1 : 0))
    .slice(0, 8);

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
    incidentsByType,
    vmBreakdown,
    topRisks,
    priorityActions,
    cxFeedback: {
      avgRating: round1(avg(cx.map((p) => num(p.rating)).filter((n) => n > 0))),
      avgNps: Math.round(avg(cx.map((p) => num(p.nps)).filter((n) => n !== 0))),
      recommendRate: cx.length
        ? round1((cx.filter((p) => /yes|recommend|likely/i.test(String(p.recommend))).length / cx.length) * 100)
        : 0,
      count: cx.length,
    },
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

  // Stock movement summary (from the inventory forms)
  const tr = payloads(rows, 'stock-transfer');
  const movement = {
    receivedUnits: gr.reduce((s, p) => s + num(p.units), 0),
    receivedValue,
    transferredUnits: tr.reduce((s, p) => s + num(p.qty), 0),
    transferredValue: tr.reduce((s, p) => s + num(p.qty) * num(p.unitValue), 0),
    deadStockValue: deadValue,
    replenishmentRequests: rep.length,
    countedValue: onHandValue,
  };

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
    movement,
    supplierPerformance: groupSum(gr, 'supplier', 'totalValue').filter((x) => x.name && x.name !== '—'),
    replenishments: rep
      .map((p) => ({
        sku: String(p.sku || ''),
        description: String(p.description || ''),
        currentStock: num(p.currentStock),
        reorderQty: num(p.reorderQty),
        urgency: String(p.urgency || ''),
        store: labelFor(STORE_LABELS, p.store),
      }))
      .slice(0, 10),
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

  // Brand equity dimensions (brand-score form)
  const dim = (k: string) => round1(avg(score.map((p) => num(p[k])).filter((n) => n > 0)));
  const equity = [
    { name: 'Awareness', value: dim('awareness') },
    { name: 'Consideration', value: dim('consideration') },
    { name: 'Preference', value: dim('preference') },
    { name: 'Satisfaction', value: dim('satisfaction') },
    { name: 'Loyalty', value: dim('loyalty') },
    { name: 'Advocacy', value: dim('advocacy') },
  ];

  // Digital reputation (digital form)
  const last = dig[dig.length - 1] ?? {};
  const digitalReputation = {
    googleRating: round1(avg(dig.map((p) => num(p.googleRating)).filter((n) => n > 0))),
    googleReviews: dig.reduce((s, p) => s + num(p.googleReviews), 0),
    trustpilot: round1(avg(dig.map((p) => num(p.trustpilot)).filter((n) => n > 0))),
    responseRate: round1(avg(dig.map((p) => num(p.responseRate)).filter((n) => n > 0))),
    nps: Math.round(avg(dig.map((p) => num(p.nps)).filter((n) => n !== 0))),
  };
  const social = {
    followers: num(last.instaFollowers),
    sentiment: round1(avg(dig.map((p) => num(p.instaSentiment)).filter((n) => n > 0))),
    newReviews: dig.reduce((s, p) => s + num(p.newReviews), 0),
    negReviews: dig.reduce((s, p) => s + num(p.negReviews), 0),
  };

  // Risks & opportunities (customer voice + competitor threats)
  const voice = payloads(rows, 'voice');
  const risks = [
    ...voice
      .filter((p) => /frustrat|complain|negativ|risk/i.test(String(p.type)))
      .map((p) => ({ text: String(p.detail || p.type), tag: String(p.frequency || '') })),
    ...comp
      .filter((p) => /high|critical/i.test(String(p.threat)))
      .map((p) => ({ text: `${p.competitor}: ${p.activity || 'competitor activity'}`, tag: String(p.threat) })),
  ].slice(0, 8);
  const opportunities = voice
    .filter((p) => /complim|positiv|request|opportun/i.test(String(p.type)))
    .map((p) => ({ text: String(p.detail || p.type), tag: String(p.frequency || '') }))
    .slice(0, 8);

  // CEO attention items (attention form)
  const ceoAttention = payloads(rows, 'attention')
    .map((p) => ({
      priority: String(p.priority || ''),
      issue: String(p.issue || ''),
      impact: String(p.impact || ''),
      owner: String(p.owner || ''),
      status: String(p.status || ''),
    }))
    .slice(0, 8);

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
    equity,
    digitalReputation,
    social,
    risks,
    opportunities,
    ceoAttention,
    entryCount: rows.length,
  };
}

/* ---------------------------- MARKETING ---------------------------- */
function marketingMetrics(rows: Entry[]) {
  const leads = payloads(rows, 'leads');
  const camp = payloads(rows, 'campaign');
  const spend = camp.reduce((s, p) => s + num(p.spend), 0);
  const campaignRevenue = camp.reduce((s, p) => s + num(p.revenue), 0);

  // Social — grouped by channel/platform (not combined)
  const social = payloads(rows, 'social');
  const platMap = new Map<string, { followers: number; reach: number; impressions: number; engagement: number; clicks: number }>();
  for (const p of social) {
    const k = String(p.platform || 'Other');
    const e = platMap.get(k) ?? { followers: 0, reach: 0, impressions: 0, engagement: 0, clicks: 0 };
    if (num(p.followers)) e.followers = num(p.followers); // latest reading
    e.reach += num(p.reach);
    e.impressions += num(p.impressions);
    e.engagement += num(p.engagement);
    e.clicks += num(p.clicks);
    platMap.set(k, e);
  }
  const socialByChannel = [...platMap].map(([platform, v]) => ({ platform, ...v }));
  const webVisits = social.reduce((s, p) => s + num(p.webVisits), 0);

  // Campaign ROI by brand
  const brandCampMap = new Map<string, { revenue: number; spend: number }>();
  for (const p of camp) {
    const b = labelFor(BRAND_LABELS, p.brand);
    const e = brandCampMap.get(b) ?? { revenue: 0, spend: 0 };
    e.revenue += num(p.revenue);
    e.spend += num(p.spend);
    brandCampMap.set(b, e);
  }
  const campaignByBrand = [...brandCampMap].map(([brand, v]) => ({
    brand,
    revenue: v.revenue,
    spend: v.spend,
    roas: v.spend ? round1(v.revenue / v.spend) : 0,
  }));

  // Per-campaign performance
  const campaigns = camp
    .map((p) => ({
      name: String(p.name || 'Campaign'),
      platform: String(p.platform || ''),
      reach: num(p.reach),
      engagement: num(p.engagement),
      leads: num(p.leads),
      revenue: num(p.revenue),
      spend: num(p.spend),
      roas: num(p.spend) ? round1(num(p.revenue) / num(p.spend)) : 0,
      status: String(p.status || ''),
    }))
    .slice(0, 12);

  // Clienteling
  const cl = payloads(rows, 'clienteling');
  const contacted = cl.reduce((s, p) => s + num(p.contacted), 0);
  const responses = cl.reduce((s, p) => s + num(p.responses), 0);
  const clienteling = {
    contacted,
    responses,
    appointments: cl.reduce((s, p) => s + num(p.appointments), 0),
    estRevenue: cl.reduce((s, p) => s + num(p.estRevenue), 0),
    responseRate: contacted ? round1((responses / contacted) * 100) : 0,
  };

  // Customer intelligence
  const customerIntel = payloads(rows, 'customer-intel')
    .map((p) => ({
      type: String(p.type || ''),
      detail: String(p.detail || ''),
      frequency: String(p.frequency || ''),
      store: labelFor(STORE_LABELS, p.store),
    }))
    .slice(0, 10);

  // Action tracker (priorities form)
  const actions = payloads(rows, 'priorities')
    .map((p) => ({
      task: String(p.task || ''),
      owner: String(p.owner || ''),
      priority: String(p.priority || ''),
      status: String(p.status || ''),
      deadline: String(p.deadline || ''),
    }))
    .slice(0, 10);

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
    socialByChannel,
    webVisits,
    campaignByBrand,
    campaigns,
    clienteling,
    customerIntel,
    actions,
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
