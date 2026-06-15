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
  };
}

// value -> label maps from a list (mirrors config.ts labelFor usage).
export const toLabelMap = (opts: Option[]): Record<string, string> =>
  Object.fromEntries(opts.map((o) => [o.value, o.label]));
