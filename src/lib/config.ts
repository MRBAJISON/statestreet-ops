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

export const PRODUCT_CATEGORIES: Option[] = [
  { label: 'Suits', value: 'suits' },
  { label: 'Shoes', value: 'shoes' },
  { label: 'Shirts', value: 'shirts' },
  { label: 'Blazers', value: 'blazers' },
  { label: 'Bags', value: 'bags' },
  { label: 'Trousers', value: 'trousers' },
  { label: 'Accessories', value: 'accessories' },
  { label: 'Others', value: 'others' },
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
];

// value -> label maps (for turning stored form values back into display names)
const toMap = (opts: Option[]) => Object.fromEntries(opts.map((o) => [o.value, o.label]));

export const STORE_LABELS: Record<string, string> = toMap(STORES);
export const BRAND_LABELS: Record<string, string> = toMap(BRANDS);
export const CATEGORY_LABELS: Record<string, string> = toMap(PRODUCT_CATEGORIES);

export const labelFor = (map: Record<string, string>, value: unknown): string => {
  const key = String(value ?? '');
  return map[key] ?? (key || '—');
};
