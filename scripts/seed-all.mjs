// Comprehensive demo seed for ALL dashboards (dev only).
// Wipes the `entries` table and inserts a coherent dataset across every
// department, dated RELATIVE to the current system clock so the default
// MTD view always shows data regardless of the machine's date.
//   node scripts/seed-all.mjs
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const m = env.match(/^DATABASE_URL=(.*)$/m);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
}
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = neon(url);

/* ----------------------------- date helpers ----------------------------- */
const NOW = new Date();
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(NOW); d.setDate(d.getDate() - n); return iso(d); };
const monthsAgo = (n, day = 15) => { const d = new Date(NOW.getFullYear(), NOW.getMonth() - n, day); return iso(d); };
// A weekEnd inside the current month when possible (keeps MTD candlestick populated).
const monthDay = (day) => iso(new Date(NOW.getFullYear(), NOW.getMonth(), Math.min(day, 28)));

/* ------------------------------ static lists ----------------------------- */
const STORES = ['dzorwulu-men', 'east-legon-men', 'labone-men', 'bw-labone', 'bw-dzorwulu', 'dangelo', 'woodpeckers'];
const CATS = ['luxury-suits', 'business-suits', 'formal-shirts', 'sneakers', 'oxford-shoes', 'watches', 'fragrances', 'leather-belts'];
const BRANDS = ['boulevard-men', 'boulevard-women', 'dangelo', 'woodpeckers', 'carbon-shoes'];
const SUPPLIERS = ['Zegna International', 'Hugo Boss GH', 'Clarks West Africa', 'Local Atelier'];

const rows = [];
const add = (department, formType, payload) => rows.push({ department, formType, payload });

/* ================================ FINANCE ================================ */
// Daily revenue by store + category (drives revenueMtd, by-category, by-store, daily trend).
let rIdx = 0;
for (const store of STORES) {
  for (const off of [0, 2, 5, 9]) {
    const cat = CATS[rIdx % CATS.length];
    const gross = 18000 + ((rIdx * 4300) % 60000);
    add('finance', 'revenue', {
      date: daysAgo(off), store, category: cat,
      grossRevenue: gross, cogs: Math.round(gross * 0.58),
      transactions: 30 + (rIdx % 40), footfall: 120 + (rIdx % 90), itemsSold: 45 + (rIdx % 60),
    });
    rIdx++;
  }
}
// Debtors & creditors
const debtorRows = [
  { type: 'debtor', name: 'Corporate Order — MTN GH', amount: 84000, status: 'Current' },
  { type: 'debtor', name: 'Corporate Order — Stanbic', amount: 52000, status: '30 days' },
  { type: 'debtor', name: 'Wedding Party Account', amount: 31000, status: '60 days' },
  { type: 'debtor', name: 'Aged — Embassy Order', amount: 18500, status: '90+ days' },
  { type: 'creditor', name: 'Zegna International', amount: 96000, status: 'Current' },
  { type: 'creditor', name: 'Clarks West Africa', amount: 41000, status: '30 days' },
];
for (const d of debtorRows) add('finance', 'debtors', { date: daysAgo(3), ...d });
// Cash flow across the last several weeks (drives cash trend + position/runway)
for (const off of [2, 9, 16, 23, 30]) {
  add('finance', 'cashflow', { date: daysAgo(off), type: 'inflow', amount: 120000 + (off * 1500), source: 'Store takings' });
  add('finance', 'cashflow', { date: daysAgo(off), type: 'outflow', amount: 88000 + (off * 900), category: 'Operating' });
}
// Expenses (actual + budget per category; one deliberate overspend with reason)
const expenseRows = [
  { category: 'payroll', amount: 145000, budget: 150000 },
  { category: 'rent', amount: 60000, budget: 60000 },
  { category: 'utilities', amount: 22000, budget: 18000, overspendReason: 'Generator fuel during ECG outages' },
  { category: 'marketing-spend', amount: 34000, budget: 40000 },
  { category: 'freight-clearance', amount: 28000, budget: 30000 },
  { category: 'repairs-maintenance', amount: 12500, budget: 15000 },
  { category: 'it-digital', amount: 9000, budget: 10000 },
  { category: 'insurance', amount: 7000, budget: 7000 },
  { category: 'bank-charges', amount: 4200, budget: 5000 },
  { category: 'asset-shop-equipments', amount: 55000, budget: 60000 }, // capex (excluded from opex)
  { category: 'interest', amount: 14000, budget: 14000 }, // below-line
  { category: 'tax', amount: 38000, budget: 40000 }, // below-line
];
expenseRows.forEach((e, i) => add('finance', 'expenses', { date: daysAgo(4 + (i % 6)), store: STORES[i % STORES.length], ...e }));
// Annual budgets (Budget Setup) — drives Budget vs Actual
const budgetRows = [
  ['payroll', 1800000], ['rent', 720000], ['utilities', 240000], ['marketing-spend', 480000],
  ['freight-clearance', 360000], ['repairs-maintenance', 180000], ['it-digital', 120000], ['insurance', 84000],
];
budgetRows.forEach(([item, amount]) => add('finance', 'budget', { item, amount, period: 'annual', year: NOW.getFullYear() }));
// Capital & investment → ROCE / ROI
add('finance', 'capital', { date: daysAgo(6), capitalEmployed: 4200000, investment: 1500000, description: 'Store fit-out + flagship expansion' });
// Forecast (monthly + weekly)
add('finance', 'forecast', { date: daysAgo(1), period: 'monthly', revenueForecast: 2600000, gpForecast: 1090000, npForecast: 420000, cashForecast: 380000 });
add('finance', 'forecast', { date: daysAgo(1), period: 'weekly', revenueForecast: 620000, gpForecast: 262000, npForecast: 98000, cashForecast: 90000 });

/* =============================== COMMERCIAL ============================== */
STORES.forEach((store, i) => {
  const totalSales = 240000 + ((i * 53000) % 320000);
  const tx = 180 + (i * 23);
  add('commercial', 'store-sales', {
    date: daysAgo(i % 7), store, totalSales, transactions: tx,
    unitsSold: tx * 2 + (i * 5), atv: Math.round(totalSales / tx), convRate: 22 + (i % 12),
  });
});
CATS.forEach((cat, i) => add('commercial', 'category-perf', {
  date: daysAgo(i % 5), category: cat, store: STORES[i % STORES.length],
  sales: 60000 + ((i * 21000) % 180000), gm: 38 + (i % 22), sellThrough: 45 + ((i * 7) % 45),
}));
// SKUs: spread across top-selling, low-moving (60-180d), dead (>=180d)
const skuRows = [
  ['ZEG-SUIT-NVY', 'Zegna Navy Luxury Suit', 'luxury-suits', 145000, 38, 22, 24, 'active'],
  ['BOSS-SHRT-WHT', 'Boss White Formal Shirt', 'formal-shirts', 78000, 210, 90, 18, 'active'],
  ['WATCH-CHRON-SS', 'Chrono Steel Watch', 'watches', 132000, 44, 16, 31, 'active'],
  ['FRAG-OUD-100', 'Oud Royale 100ml', 'fragrances', 64000, 160, 48, 27, 'active'],
  ['CLK-OXF-BRN', 'Clarks Oxford Brown', 'oxford-shoes', 41000, 70, 30, 92, 'slow'],
  ['BELT-CROC-BLK', 'Croc Leather Belt Black', 'leather-belts', 22000, 88, 40, 120, 'slow'],
  ['SNK-RETRO-42', 'Retro Sneaker Sz42', 'sneakers', 30000, 95, 26, 75, 'slow'],
  ['BSUIT-GRY-50', 'Business Suit Grey 50', 'business-suits', 12000, 9, 14, 210, 'dead'],
  ['TIE-SILK-RED', 'Silk Tie Red', 'ties', 4000, 6, 60, 240, 'dead'],
];
skuRows.forEach(([sku, name, category, salesValue, unitsSold, stock, daysInStock, status]) =>
  add('commercial', 'sku-entry', { sku, name, category, salesValue, unitsSold, stock, daysInStock, status, store: 'east-legon-men' }));
// New arrivals (deployment by store)
BRANDS.forEach((brand, i) => add('commercial', 'new-arrivals', {
  date: daysAgo(i + 1), brand, category: CATS[i % CATS.length], qty: 40 + i * 15,
  stockValue: 80000 + i * 25000, store: STORES[i % STORES.length], supplier: SUPPLIERS[i % SUPPLIERS.length],
}));
// Accountability
[
  ['A. Mensah', 'Store Manager', 'Sales Target', '250K', '244K', 'On Track'],
  ['K. Owusu', 'Floor Lead', 'Conversion', '28%', '31%', 'Ahead'],
  ['Y. Boateng', 'Visual Merch', 'Sell-Through', '60%', '52%', 'Behind'],
].forEach(([member, role, kpi, target, actual, status]) => add('commercial', 'accountability', { member, role, kpi, target, actual, status }));

// Weekly reviews — multiple weeks & stores (drives Weekly Review + Sales Achievement candlestick)
const CAT_LABEL = { 'luxury-suits': 'Luxury Suits', 'business-suits': 'Business Suits', 'formal-shirts': 'Formal Shirts', sneakers: 'Sneakers', 'oxford-shoes': 'Oxford Shoes', watches: 'Watches', fragrances: 'Fragrances', 'leather-belts': 'Leather Belts' };
function buildCategories(seed) {
  const out = {};
  CATS.forEach((c, i) => {
    const units = 6 + ((seed * 3 + i * 7) % 20);
    const price = 500 + ((i * 137) % 1600);
    const atRisk = (seed + i) % 4 === 0 ? (i + 1) * 1800 : 0;
    out[CAT_LABEL[c]] = {
      openingStock: 30 + i * 5, unitsSold: String(units), revenue: String(units * price),
      currentStock: 20 + i * 4, rating: ['Good', 'Fair', 'Poor'][(seed + i) % 3], comments: '',
      overstocked: atRisk ? 'Y' : 'N', slowMoving: atRisk ? 'Y' : 'N', weeksNoMove: atRisk ? '3' : '0',
      valueAtRisk: String(atRisk), corrective: atRisk ? 'Markdown 20%' : '',
      salesTargetUnits: String(units + 5), revenueTarget: String((units + 5) * price),
      keyActivity: 'Window feature + advisor push', assignedAdvisor: 'A. Mensah',
      weeklyUnitTarget: String(units + 5), actualUnits: String(units),
      achievement: String(Math.round((units / (units + 5)) * 1000) / 10), mgrComments: '',
    };
  });
  return out;
}
const WR_STORES = [
  { store: 'east-legon-men', manager: 'Kwabena Asante', base: 230000 },
  { store: 'dzorwulu-men', manager: 'Yaw Darko', base: 200000 },
];
// weekEnds: 3 inside current month + 3 prior — MTD shows >=2 candles, All shows 6.
const WEEK_ENDS = [monthDay(4), monthDay(11), monthDay(18), monthsAgo(1, 8), monthsAgo(1, 22), monthsAgo(2, 12)];
WR_STORES.forEach((s, si) => {
  WEEK_ENDS.forEach((weekEnd, wi) => {
    const target = s.base + wi * 6000;
    const actual = Math.round(target * (0.82 + ((wi + si) % 5) * 0.06)); // 82%..112%
    add('commercial', 'weekly-review', {
      store: s.store, manager: s.manager, weekEnd,
      weeklySalesTarget: String(target), actualSales: String(actual),
      achievement: Math.round((actual / target) * 1000) / 10,
      categories: buildCategories(wi + si + 1),
      ceo: {
        q1: `Watches, Luxury Suits and Fragrances led revenue for week ending ${weekEnd}.`,
        q2: `Oxford Shoes and Leather Belts are slow-moving and ageing.`,
        q3: `Marketing should amplify Fragrances ahead of the weekend.`,
        q4: `Ageing formal footwear is the biggest commercial risk now.`,
        q5: `Re-merchandise the entrance; brief advisors on suit cross-sell.`,
        q6: `1) Clear ageing shoes 2) Re-train on add-on selling 3) Tighten Watches replenishment.`,
      },
      declaration: { confirmed: ['My category performance', 'My inventory position'], manager: s.manager, signature: s.manager, date: weekEnd },
    });
  });
});

/* =============================== OPERATIONS ============================== */
STORES.forEach((store, i) => add('operations', 'store-audit', {
  date: daysAgo(i % 6), store,
  opsScore: 80 + (i % 15), vmScore: 74 + (i % 18), readinessScore: 78 + (i % 16),
  cxScore: 82 + (i % 12), cleanScore: 85 + (i % 10), safetyScore: 88 + (i % 8),
  issues: i % 3 === 0 ? 'Fitting-room mirror cracked; back-store clutter near fire exit.' : '',
}));
STORES.slice(0, 5).forEach((store, i) => add('operations', 'vm-check', {
  date: daysAgo(i % 5), store, windowDisplay: 80 + (i % 15), mannequin: 76 + (i % 18),
  productPresentation: 82 + (i % 12), signage: 70 + (i % 20), overallVM: 78 + (i % 14),
  improvements: i % 2 === 0 ? 'Refresh window mannequins; add size-run signage on denim wall.' : '',
}));
const maintRows = [
  ['AC unit not cooling — sales floor', 'open', 4200, 'high', 'Facilities Co', 'east-legon-men'],
  ['Broken fitting-room door', 'resolved', 850, 'medium', 'In-house', 'labone-men'],
  ['Storefront signage light out', 'overdue', 1600, 'high', 'SignWorks', 'dzorwulu-men'],
  ['Leaking tap in back-store', 'resolved', 300, 'low', 'In-house', 'bw-labone'],
  ['POS terminal intermittent', 'open', 2200, 'medium', 'IT Vendor', 'woodpeckers'],
];
maintRows.forEach(([description, status, cost, priority, assignedTo, store], i) =>
  add('operations', 'maintenance', { date: daysAgo(i + 2), description, status, cost, priority, assignedTo, store, category: 'Repairs' }));
const incRows = [
  ['security', 'high', 'Attempted shoplifting intercepted at exit', 'east-legon-men', 'open', 'Reviewed CCTV; briefed security.'],
  ['theft', 'high', 'Two belts unaccounted after stock count', 'dzorwulu-men', 'open', 'Filed shrinkage report.'],
  ['safety', 'medium', 'Customer slipped near entrance (wet floor)', 'labone-men', 'resolved', 'Added wet-floor signage.'],
  ['operational', 'low', 'POS downtime 20 mins', 'woodpeckers', 'resolved', 'Switched to backup terminal.'],
  ['fire', 'medium', 'Smoke alarm false trigger', 'bw-dzorwulu', 'resolved', 'Serviced detector.'],
  ['customer', 'low', 'Minor complaint re: alteration delay', 'bw-labone', 'resolved', 'Expedited alteration.'],
  ['staff', 'medium', 'Advisor minor cut in stockroom', 'dangelo', 'resolved', 'First aid administered.'],
];
incRows.forEach(([type, severity, description, store, status, actionTaken], i) =>
  add('operations', 'incident', { date: daysAgo(i + 1), type, severity, description, store, status, actionTaken }));
const sopAreas = ['opening', 'sales-floor', 'cash', 'service', 'closing', 'loss-prev', 'inventory-handling', 'staff-execution', 'discipline-leadership', 'staff-grooming'];
sopAreas.forEach((area, i) => add('operations', 'sop-check', {
  date: daysAgo(i % 6), store: STORES[i % STORES.length], area, compliance: 72 + ((i * 5) % 26),
  deviations: i % 4 === 0 ? 'Opening checklist not signed off two mornings.' : '',
  corrective: i % 4 === 0 ? 'Manager to counter-sign opening log daily.' : '',
}));
const cxRows = [
  [5, 70, 'yes'], [4, 40, 'yes'], [3, 0, 'no'], [5, 80, 'yes'], [4, 30, 'likely'], [2, -20, 'no'],
];
cxRows.forEach(([rating, nps, recommend], i) => add('operations', 'cx-feedback', { date: daysAgo(i + 1), store: STORES[i % STORES.length], rating, nps, recommend, comments: 'Observed at till.' }));
const hrReasons = ['Sick', 'Family emergency', 'Approved leave', 'Transport', 'Sick'];
STORES.slice(0, 5).forEach((store, i) => add('operations', 'hr', {
  date: daysAgo(i % 5), store, employee: `Advisor ${i + 1}`,
  attendance: 90 + (i % 9), punctuality: 86 + (i % 12), training: 70 + (i % 25),
  absences: 1 + (i % 3), reason: hrReasons[i % hrReasons.length],
}));

/* =============================== INVENTORY =============================== */
// Stock counts with varying variance (drives accuracy + distribution)
const scRows = [
  [200, 198, 1500], [150, 142, 2100], [320, 300, 900], [90, 89, 4200], [60, 50, 1200],
  [410, 405, 1800], [75, 60, 3000], [220, 219, 2600], [130, 110, 700], [180, 178, 1500],
];
scRows.forEach(([systemQty, physicalQty, unitValue], i) => add('inventory', 'stock-count', {
  date: daysAgo(i % 7), store: STORES[i % STORES.length], sku: `SKU-${1000 + i}`,
  systemQty, physicalQty, variance: systemQty - physicalQty, unitValue,
}));
// Goods receipts across 3 months (monthly value trend) + by brand + supplier
let grIdx = 0;
for (const mo of [2, 1, 0]) {
  for (let k = 0; k < 3; k++) {
    const brand = BRANDS[grIdx % BRANDS.length];
    add('inventory', 'goods-receipt', {
      date: monthsAgo(mo, 6 + k * 8), brand, supplier: SUPPLIERS[grIdx % SUPPLIERS.length],
      units: 60 + (grIdx * 13) % 140, totalValue: 90000 + ((grIdx * 31000) % 260000),
    });
    grIdx++;
  }
}
[['Dead — old grey suits', 28000, 'east-legon-men'], ['Dead — silk ties', 9000, 'labone-men'], ['Dead — sandals run', 14000, 'woodpeckers']]
  .forEach(([sku, stockValue, store], i) => add('inventory', 'dead-stock', { date: daysAgo(i + 3), sku, description: sku, stockValue, store }));
const repRows = [
  ['SKU-2001', 'Boss White Shirt 16"', 0, 60, 'high', 'east-legon-men'],
  ['SKU-2002', 'Oud Royale 100ml', 4, 40, 'medium', 'dzorwulu-men'],
  ['SKU-2003', 'Chrono Steel Watch', 0, 20, 'high', 'labone-men'],
  ['SKU-2004', 'Retro Sneaker 42', 6, 30, 'low', 'woodpeckers'],
];
repRows.forEach(([sku, description, currentStock, reorderQty, urgency, store]) =>
  add('inventory', 'replenishment', { date: daysAgo(2), sku, description, currentStock, reorderQty, urgency, store }));
// Inventory-team transfers (formType stock-transfer)
const trRows = [
  ['warehouse', 'east-legon-men', 'ZEG-SUIT-NVY', 'Zegna Navy Suit', 12, 9500],
  ['dzorwulu-men', 'labone-men', 'WATCH-CHRON-SS', 'Chrono Watch', 6, 4200],
  ['warehouse', 'woodpeckers', 'SNK-RETRO-42', 'Retro Sneaker', 20, 1100],
];
trRows.forEach(([fromStore, toStore, sku, description, qty, unitValue], i) =>
  add('inventory', 'stock-transfer', { date: daysAgo(i + 1), fromStore, toStore, sku, description, qty, unitValue, reason: 'rebalance', authorizedBy: 'Inventory Manager' }));
// Store-manager transfers (formType store-transfer) — for the Store Manager dashboard
const smTr = [
  ['east-legon-men', 'labone-men', 'BELT-CROC-BLK', 'Croc Belt Black', 8],
  ['east-legon-men', 'dzorwulu-men', 'TIE-SILK-RED', 'Silk Tie Red', 10],
];
smTr.forEach(([fromStore, toStore, sku, description, units], i) =>
  add('inventory', 'store-transfer', { date: daysAgo(i + 1), fromStore, toStore, sku, description, units, reason: 'customer', authorizedBy: 'Kwabena Asante' }));

/* ================================= BRAND ================================= */
BRANDS.forEach((brand, i) => add('brand', 'brand-score', {
  date: daysAgo(i % 5), brand, overall: 72 + (i * 4) % 22, momentum: 60 + (i * 6) % 30,
  awareness: 78 + (i % 16), consideration: 70 + (i % 20), preference: 66 + (i % 22),
  satisfaction: 80 + (i % 14), loyalty: 68 + (i % 24), advocacy: 64 + (i % 26),
}));
for (const mo of [2, 1, 0]) {
  add('brand', 'sentiment', { date: monthsAgo(mo, 10), positive: 1200 + mo * 60, neutral: 380, negative: 160 + mo * 20 });
}
[['Boutique Rivale', 38, 'high', 'Aggressive weekend discounting on suits'], ['Atelier Lux', 24, 'medium', 'New flagship opening in Osu'], ['Urban Threads', 19, 'low', 'Influencer push on sneakers']]
  .forEach(([competitor, sov, threat, activity]) => add('brand', 'competitor', { date: daysAgo(5), competitor, sov, threat, activity }));
add('brand', 'digital', {
  date: daysAgo(2), googleRating: 4.6, googleReviews: 1840, trustpilot: 4.3, responseRate: 88, nps: 56,
  instaFollowers: 48200, instaSentiment: 79, newReviews: 64, negReviews: 7,
});
[
  ['complaint', 'Alteration turnaround too slow at East Legon', 'recurring'],
  ['complaint', 'Limited size runs on premium shirts', 'occasional'],
  ['compliment', 'Outstanding personal styling service', 'frequent'],
  ['request', 'Requests for more sustainable fabrics', 'occasional'],
  ['compliment', 'Loyalty perks appreciated by regulars', 'frequent'],
].forEach(([type, detail, frequency]) => add('brand', 'voice', { date: daysAgo(4), type, detail, frequency }));
[
  ['high', 'Ageing formal footwear stock', 'Margin erosion if not cleared', 'Commercial', 'open'],
  ['medium', 'Competitor flagship opening in Osu', 'Possible footfall dip', 'Brand', 'monitoring'],
  ['high', 'Alteration SLA slipping', 'CX & repeat-purchase risk', 'Operations', 'open'],
].forEach(([priority, issue, impact, owner, status]) => add('brand', 'attention', { date: daysAgo(3), priority, issue, impact, owner, status }));

/* =============================== MARKETING =============================== */
[['Instagram', 1800, 720], ['Walk-in', 1400, 560], ['Referral', 600, 310], ['WhatsApp', 950, 470], ['Google', 1100, 380]]
  .forEach(([channel, count, converted]) => add('marketing', 'leads', { date: daysAgo(3), channel, count, converted }));
const campRows = [
  ['Father’s Day Edit', 'Instagram', 'boulevard-men', 420000, 38000, 640, 310, 540000, 90000, 'active'],
  ['Bridal Season', 'Instagram', 'boulevard-women', 380000, 31000, 520, 260, 470000, 80000, 'active'],
  ['Sneaker Drop', 'TikTok', 'carbon-shoes', 510000, 62000, 880, 410, 360000, 70000, 'completed'],
  ['Fragrance Push', 'Google', 'dangelo', 220000, 14000, 300, 180, 260000, 45000, 'active'],
];
campRows.forEach(([name, platform, brand, reach, engagement, leads, storeVisits, revenue, spend, status]) =>
  add('marketing', 'campaign', { date: daysAgo(4), name, platform, brand, reach, engagement, leads, storeVisits, revenue, spend, status }));
[['Instagram', 48200, 320000, 510000, 42000, 12000, 9000], ['TikTok', 21000, 280000, 460000, 61000, 8000, 0], ['Facebook', 33000, 140000, 210000, 16000, 5200, 4000], ['Google', 0, 90000, 180000, 0, 7400, 14000]]
  .forEach(([platform, followers, reach, impressions, engagement, clicks, webVisits]) =>
    add('marketing', 'social', { date: daysAgo(3), platform, followers, reach, impressions, engagement, clicks, webVisits }));
[[420, 180, 64, 280000], [310, 150, 52, 210000]].forEach(([contacted, responses, appointments, estRevenue], i) =>
  add('marketing', 'clienteling', { date: daysAgo(i + 2), contacted, responses, appointments, estRevenue }));
[
  ['promoter', 'yes', 'service', 'Loved the styling advice', 'frequent', 'east-legon-men', 'survey'],
  ['passive', 'likely', 'product', 'Wanted more size options', 'occasional', 'labone-men', 'survey'],
  ['detractor', 'no', 'service', 'Alteration delay', 'recurring', 'dzorwulu-men', 'survey'],
  ['promoter', 'yes', 'experience', 'Beautiful store ambience', 'frequent', 'bw-labone', 'survey'],
].forEach(([type, recommend, category, detail, frequency, store, source], i) =>
  add('marketing', 'customer-experience', { date: daysAgo(i + 1), type, recommend, category, detail, frequency, store, source, nps: [80, 30, -40, 75][i] }));
[
  ['Launch Father’s Day window', 'Marketing Lead', 'high', 'in-progress', daysAgo(-5)],
  ['Brief advisors on clienteling script', 'CX Lead', 'medium', 'open', daysAgo(-3)],
  ['Negotiate fragrance co-op spend', 'Brand Lead', 'medium', 'open', daysAgo(-7)],
].forEach(([task, owner, priority, status, deadline]) => add('marketing', 'priorities', { task, owner, priority, status, deadline }));

/* ================================= WRITE ================================= */
console.log(`Prepared ${rows.length} entries. Wiping existing entries...`);
await sql`DELETE FROM entries`;
let n = 0;
for (const r of rows) {
  await sql`INSERT INTO entries (department, form_type, payload) VALUES (${r.department}, ${r.formType}, ${JSON.stringify(r.payload)}::jsonb)`;
  n++;
  if (n % 25 === 0) console.log(`  inserted ${n}/${rows.length}`);
}
// Summary by department
const byDept = {};
for (const r of rows) byDept[r.department] = (byDept[r.department] || 0) + 1;
console.log('Done. Inserted by department:', byDept);
