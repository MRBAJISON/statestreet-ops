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

export const EXPENSE_CATEGORIES: Option[] = [
  { label: 'Rent', value: 'rent' },
  { label: 'Salaries', value: 'salaries' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Utilities', value: 'utilities' },
  { label: 'Logistics', value: 'logistics' },
  { label: 'Admin', value: 'admin' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Other', value: 'other' },
  // Below-the-line items — excluded from operating expenses, used for net profit.
  { label: 'Interest / Finance Cost', value: 'interest' },
  { label: 'Tax', value: 'tax' },
];

// Categories treated as below operating line (for Operating vs Net Profit).
export const BELOW_LINE_CATEGORIES = ['interest', 'tax'];

// value -> label maps (for turning stored form values back into display names)
const toMap = (opts: Option[]) => Object.fromEntries(opts.map((o) => [o.value, o.label]));

export const STORE_LABELS: Record<string, string> = toMap(STORES);
export const BRAND_LABELS: Record<string, string> = toMap(BRANDS);
export const CATEGORY_LABELS: Record<string, string> = toMap(PRODUCT_CATEGORIES);

export const labelFor = (map: Record<string, string>, value: unknown): string => {
  const key = String(value ?? '');
  return map[key] ?? (key || '—');
};
