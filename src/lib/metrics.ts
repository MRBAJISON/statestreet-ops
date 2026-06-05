import type { Entry } from './db/schema';

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

const BRAND_LABELS: Record<string, string> = {
  'boulevard-men': 'Boulevard Men',
  'boulevard-women': 'Boulevard Women',
  dangelo: "D'Angelo",
  woodpeckers: 'Woodpeckers',
  'carbon-shoes': 'Carbon Shoes',
};

/* ----------------------------- FINANCE ----------------------------- */
function financeMetrics(rows: Entry[]) {
  const labels = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const daily = new Array(31).fill(0);
  const brandMap = new Map<string, number>();
  let revenueMtd = 0;
  let transactions = 0;
  let footfall = 0;
  let itemsSold = 0;

  for (const p of payloads(rows, 'revenue')) {
    const gross = num(p.grossRevenue);
    revenueMtd += gross;
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

  return {
    revenueMtd,
    revenueByBrand: [...brandMap].map(([name, value]) => ({ name, value })),
    daily,
    labels,
    transactions,
    footfall,
    itemsSold,
    expensesByCategory: groupSum(payloads(rows, 'expenses'), 'category', 'amount').map((x) => ({
      name: x.name,
      actual: x.value,
    })),
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
    categorySales: groupSum(cp, 'category', 'sales'),
    sellThroughByCategory: groupAvg(cp, 'category', 'sellThrough'),
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
    vmByStore: vm.length ? groupAvg(vm, 'store', 'overallVM') : groupAvg(audit, 'store', 'vmScore'),
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

  return {
    inventoryValue,
    accuracy: sysTotal ? round1(Math.max(0, 100 - (varTotal / sysTotal) * 100)) : 0,
    deadPct: inventoryValue ? round1((deadValue / inventoryValue) * 100) : 0,
    outOfStock: rep.filter((p) => num(p.currentStock) === 0).length || rep.length,
    byBrand: groupSum(gr, 'brand', 'totalValue'),
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

  return {
    sentiment: {
      positive: total ? Math.round((positive / total) * 100) : 0,
      neutral: total ? Math.round((neutral / total) * 100) : 0,
      negative: total ? Math.round((negative / total) * 100) : 0,
    },
    nps: Math.round(avg(dig.map((p) => num(p.nps)).filter((n) => n !== 0))),
    momentum: Math.round(avg(score.map((p) => num(p.momentum)).filter((n) => n > 0))),
    shareOfConversation: groupAvg(comp, 'competitor', 'sov'),
    entryCount: rows.length,
  };
}

/* ---------------------------- MARKETING ---------------------------- */
function marketingMetrics(rows: Entry[]) {
  const leads = payloads(rows, 'leads');
  const camp = payloads(rows, 'campaign');
  const spend = camp.reduce((s, p) => s + num(p.spend), 0);
  const campaignRevenue = camp.reduce((s, p) => s + num(p.revenue), 0);

  return {
    leadChannelMix: groupSum(leads, 'channel', 'count'),
    totalLeads: leads.reduce((s, p) => s + num(p.count), 0),
    converted: leads.reduce((s, p) => s + num(p.converted), 0),
    totalReach: camp.reduce((s, p) => s + num(p.reach), 0),
    campaignRevenue,
    spend,
    roas: spend ? round1(campaignRevenue / spend) : 0,
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
