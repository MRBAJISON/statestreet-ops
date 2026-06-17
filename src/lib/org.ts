// Organization settings — company identity, currency, security, and the editable
// option lists. Stored as a single row in `entries` (department 'admin',
// formType 'org-settings'). config.ts values are the defaults / seed until the
// owner customises them.
import { STORES, BRANDS, PRODUCT_CATEGORIES, EXPENSE_ITEMS, type Option, type ExpenseItem } from './config';

export interface OrgSettings {
  companyName: string;
  tagline: string;
  currency: string; // ISO-ish code shown as a prefix, e.g. "GHS"
  logo: string; // data URL ('' = use the built-in mark)
  weekStart: 'monday' | 'sunday';
  security: { minPasswordLen: number; sessionDays: number };
  stores: Option[];
  brands: Option[];
  categories: Option[];
  expenseItems: ExpenseItem[];
  // Relationships (owner/commercial/operations-editable in Settings):
  brandCategories: Record<string, string[]>; // brandValue -> [categoryValue,...]
  brandStores: Record<string, string[]>;     // brandValue -> [storeValue,...]
}

export const DEFAULT_ORG: OrgSettings = {
  companyName: 'StateStreet',
  tagline: 'Retail Group',
  currency: 'GHS',
  logo: '',
  weekStart: 'monday',
  security: { minPasswordLen: 6, sessionDays: 7 },
  stores: STORES,
  brands: BRANDS,
  categories: PRODUCT_CATEGORIES,
  expenseItems: EXPENSE_ITEMS,
  brandCategories: {},
  brandStores: {},
};

// Merge a stored (possibly partial) record over the defaults.
export function mergeOrg(raw: Partial<OrgSettings> | null | undefined): OrgSettings {
  const r = raw ?? {};
  return {
    companyName: r.companyName || DEFAULT_ORG.companyName,
    tagline: r.tagline ?? DEFAULT_ORG.tagline,
    currency: r.currency || DEFAULT_ORG.currency,
    logo: r.logo ?? '',
    weekStart: r.weekStart === 'sunday' ? 'sunday' : 'monday',
    security: {
      minPasswordLen: Number(r.security?.minPasswordLen) || DEFAULT_ORG.security.minPasswordLen,
      sessionDays: Number(r.security?.sessionDays) || DEFAULT_ORG.security.sessionDays,
    },
    stores: r.stores?.length ? r.stores : DEFAULT_ORG.stores,
    brands: r.brands?.length ? r.brands : DEFAULT_ORG.brands,
    categories: r.categories?.length ? r.categories : DEFAULT_ORG.categories,
    expenseItems: r.expenseItems?.length ? r.expenseItems : DEFAULT_ORG.expenseItems,
    brandCategories: r.brandCategories ?? {},
    brandStores: r.brandStores ?? {},
  };
}

// value -> label maps from a list (mirrors config.ts labelFor usage).
export const toLabelMap = (opts: Option[]): Record<string, string> =>
  Object.fromEntries(opts.map((o) => [o.value, o.label]));

// Grouped <optgroup> structure for the Budget / Expense / Cashflow dropdowns.
export function expenseGroups(items: ExpenseItem[]): { label: string; options: Option[] }[] {
  const inG = (g: ExpenseItem['group']) => items.filter((i) => i.group === g).map(({ label, value }) => ({ label, value }));
  return [
    { label: 'Operating Expenses', options: inG('operating') },
    { label: 'Capital Expenditure', options: inG('capital') },
    { label: 'Below the Line', options: inG('below-line') },
  ];
}
export const capitalValues = (items: ExpenseItem[]): string[] => items.filter((i) => i.group === 'capital').map((i) => i.value);

// Categories available for a brand. If the brand has a mapping, return only the
// mapped categories (in the org's category order); otherwise return all categories.
export function categoriesForBrand(org: OrgSettings, brandValue: string): Option[] {
  const allowed = org.brandCategories?.[brandValue];
  if (!brandValue || !allowed?.length) return org.categories;
  const set = new Set(allowed);
  return org.categories.filter((c) => set.has(c.value));
}

// Categories available at a store = the categories of the store's brand. Falls
// back to all categories if the store isn't mapped to a brand.
export function categoriesForStore(org: OrgSettings, storeValue: string): Option[] {
  const brand = brandOfStore(org, storeValue);
  return brand ? categoriesForBrand(org, brand) : org.categories;
}

// The brand a store belongs to (first brand whose store list includes it), or null.
export function brandOfStore(org: OrgSettings, storeValue: string): string | null {
  for (const [brand, stores] of Object.entries(org.brandStores ?? {})) {
    if (stores.includes(storeValue)) return brand;
  }
  return null;
}

// Valid stock-transfer destinations for a store. Head Office reaches every other
// store; otherwise only other stores sharing the same brand. Empty = no transfer
// (single-store brand or unmapped store).
export function transferTargets(org: OrgSettings, fromStore: string): Option[] {
  if (fromStore === 'head-office') {
    return org.stores.filter((s) => s.value !== fromStore);
  }
  const brand = brandOfStore(org, fromStore);
  if (!brand) return [];
  const peers = new Set((org.brandStores?.[brand] ?? []).filter((v) => v !== fromStore));
  return org.stores.filter((s) => peers.has(s.value));
}
