// Business configuration — the only "static" data in the system.
// These are option lists the forms use and label maps for grouping/display.
// No operational figures live here; all metrics come from the database.

export interface Option {
  label: string;
  value: string;
}

export const STORES: Option[] = [
  { label: 'Dzorwulu Men', value: 'dzorwulu-men' },
  { label: 'East Legon Men', value: 'east-legon-men' },
  { label: 'Labone Men', value: 'labone-men' },
  { label: 'Boulevard Women Labone', value: 'bw-labone' },
  { label: 'Boulevard Women Dzorwulu', value: 'bw-dzorwulu' },
  { label: "D'Angelo Palace", value: 'dangelo' },
  { label: 'Woodpeckers', value: 'woodpeckers' },
  { label: 'Head Office', value: 'head-office' },
];

export const BRANDS: Option[] = [
  { label: 'Boulevard Men', value: 'boulevard-men' },
  { label: 'Boulevard Women', value: 'boulevard-women' },
  { label: "D'Angelo", value: 'dangelo' },
  { label: 'Woodpeckers', value: 'woodpeckers' },
  { label: 'Carbon Shoes', value: 'carbon-shoes' },
];

// The 28 SKU categories from the Store Manager Monday Review Worksheet.
export const PRODUCT_CATEGORIES: Option[] = [
  { label: 'Luxury Suits', value: 'luxury-suits' },
  { label: 'Business Suits', value: 'business-suits' },
  { label: 'Casual Blazers', value: 'casual-blazers' },
  { label: 'Formal Shirts', value: 'formal-shirts' },
  { label: 'Casual Shirts', value: 'casual-shirts' },
  { label: 'Premium T-Shirts', value: 'premium-t-shirts' },
  { label: 'Polo Shirts', value: 'polo-shirts' },
  { label: 'Denim Jeans', value: 'denim-jeans' },
  { label: 'Chinos', value: 'chinos' },
  { label: 'Formal Trousers', value: 'formal-trousers' },
  { label: 'Sneakers', value: 'sneakers' },
  { label: 'Oxford Shoes', value: 'oxford-shoes' },
  { label: 'Derby Shoes', value: 'derby-shoes' },
  { label: 'Loafers', value: 'loafers' },
  { label: 'Sandals', value: 'sandals' },
  { label: 'Leather Belts', value: 'leather-belts' },
  { label: 'Premium Belts', value: 'premium-belts' },
  { label: 'Ties', value: 'ties' },
  { label: 'Pocket Squares', value: 'pocket-squares' },
  { label: 'Sunglasses', value: 'sunglasses' },
  { label: 'Leather Bags', value: 'leather-bags' },
  { label: 'Wallets & Purses', value: 'wallets-purses' },
  { label: 'Watches', value: 'watches' },
  { label: 'Fragrances', value: 'fragrances' },
  { label: 'Safari Sets', value: 'safari-sets' },
  { label: 'Knitwear', value: 'knitwear' },
  { label: 'Streetwear Sets', value: 'streetwear-sets' },
  { label: 'Jackets & Outerwear', value: 'jackets-outerwear' },
];

// The single source of truth for budget / expense / cashflow categories.
// group: operating (P&L opex) | capital (capex, excluded from operating profit)
//        | below-line (interest & tax, below the operating line for net profit).
type ExpenseGroup = 'operating' | 'capital' | 'below-line';
export interface ExpenseItem extends Option {
  group: ExpenseGroup;
}

export const EXPENSE_ITEMS: ExpenseItem[] = [
  { label: 'Stock Purchases', value: 'stock-purchases', group: 'operating' },
  { label: 'Freight & Clearance', value: 'freight-clearance', group: 'operating' },
  { label: 'Forex', value: 'forex', group: 'operating' },
  { label: 'Payroll Cost', value: 'payroll', group: 'operating' },
  { label: 'Rent', value: 'rent', group: 'operating' },
  { label: 'Utilities', value: 'utilities', group: 'operating' },
  { label: 'Repairs & Maintenance', value: 'repairs-maintenance', group: 'operating' },
  { label: 'Marketing Spend', value: 'marketing-spend', group: 'operating' },
  { label: 'Delivery & Other Transport Costs', value: 'delivery-transport', group: 'operating' },
  { label: 'Professional Fees', value: 'professional-fees', group: 'operating' },
  { label: 'Statutory Payments', value: 'statutory-payments', group: 'operating' },
  { label: 'Insurance', value: 'insurance', group: 'operating' },
  { label: 'Bank Charges', value: 'bank-charges', group: 'operating' },
  { label: 'Printing & Stationery', value: 'printing-stationery', group: 'operating' },
  { label: 'Voice & Data Charges', value: 'voice-data', group: 'operating' },
  { label: 'Food & Entertainment', value: 'food-entertainment', group: 'operating' },
  { label: 'Foreign Travels', value: 'foreign-travels', group: 'operating' },
  { label: 'IT & Digital Services', value: 'it-digital', group: 'operating' },
  { label: 'Office Expenses', value: 'office-expenses', group: 'operating' },
  { label: 'Fuel & Vehicle Maintenance', value: 'fuel-vehicle', group: 'operating' },
  { label: 'Shop & Store Expenses', value: 'shop-store', group: 'operating' },
  { label: 'MD-Related Expenditure', value: 'md-expenditure', group: 'operating' },
  { label: 'Medical Expenses', value: 'medical', group: 'operating' },
  { label: 'Asset – Motor Vehicle', value: 'asset-motor-vehicle', group: 'capital' },
  { label: 'Asset – Furniture & Fittings', value: 'asset-furniture-fittings', group: 'capital' },
  { label: 'Asset – Shop Equipments', value: 'asset-shop-equipments', group: 'capital' },
  { label: 'Interest / Finance Cost', value: 'interest', group: 'below-line' },
  { label: 'Tax', value: 'tax', group: 'below-line' },
];

const itemsIn = (g: ExpenseGroup): Option[] => EXPENSE_ITEMS.filter((i) => i.group === g).map(({ label, value }) => ({ label, value }));

// Flat list + value sets used by metrics.
export const EXPENSE_CATEGORIES: Option[] = EXPENSE_ITEMS.map(({ label, value }) => ({ label, value }));
export const BELOW_LINE_CATEGORIES = EXPENSE_ITEMS.filter((i) => i.group === 'below-line').map((i) => i.value);
export const CAPITAL_CATEGORIES = EXPENSE_ITEMS.filter((i) => i.group === 'capital').map((i) => i.value);

// Grouped options for <optgroup> dropdowns (Budget / Expense / Cashflow).
export const EXPENSE_GROUPS: { label: string; options: Option[] }[] = [
  { label: 'Operating Expenses', options: itemsIn('operating') },
  { label: 'Capital Expenditure', options: itemsIn('capital') },
  { label: 'Below the Line', options: itemsIn('below-line') },
];

// value -> label maps (for turning stored form values back into display names)
const toMap = (opts: Option[]) => Object.fromEntries(opts.map((o) => [o.value, o.label]));

export const STORE_LABELS: Record<string, string> = toMap(STORES);
export const BRAND_LABELS: Record<string, string> = toMap(BRANDS);
export const CATEGORY_LABELS: Record<string, string> = toMap(PRODUCT_CATEGORIES);
export const EXPENSE_LABELS: Record<string, string> = toMap(EXPENSE_CATEGORIES);

export const labelFor = (map: Record<string, string>, value: unknown): string => {
  const key = String(value ?? '');
  if (map[key]) return map[key];
  if (!key) return '—';
  // Graceful fallback for org-added codes not in the static map: prettify the slug.
  return /[a-z0-9]+(?:[-_][a-z0-9]+)+/i.test(key)
    ? key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : key;
};

// Financial-ratio performance bands → label + RAG tone.
export type RatioTone = 'green' | 'yellow' | 'red';
export function rateRatio(kind: 'netMargin' | 'roce' | 'roi', v: number): { label: string; tone: RatioTone } {
  if (kind === 'netMargin') {
    if (v < 0) return { label: 'Loss Making', tone: 'red' };
    if (v < 1) return { label: 'Poor / Risk', tone: 'red' };
    if (v < 4) return { label: 'Weak', tone: 'red' };
    if (v < 7) return { label: 'Average', tone: 'yellow' };
    if (v < 10) return { label: 'Good', tone: 'green' };
    if (v <= 15) return { label: 'Very Good', tone: 'green' };
    return { label: 'Excellent', tone: 'green' };
  }
  if (kind === 'roce') {
    if (v < 5) return { label: 'Poor', tone: 'red' };
    if (v < 10) return { label: 'Weak', tone: 'red' };
    if (v < 15) return { label: 'Average', tone: 'yellow' };
    if (v < 20) return { label: 'Good', tone: 'green' };
    if (v <= 25) return { label: 'Very Good', tone: 'green' };
    return { label: 'Excellent', tone: 'green' };
  }
  // roi
  if (v < 5) return { label: 'Poor', tone: 'red' };
  if (v < 10) return { label: 'Weak', tone: 'red' };
  if (v < 15) return { label: 'Acceptable', tone: 'yellow' };
  if (v < 20) return { label: 'Good', tone: 'green' };
  if (v <= 30) return { label: 'Very Good', tone: 'green' };
  return { label: 'Excellent', tone: 'green' };
}
