import { asc, eq } from 'drizzle-orm';
import { db } from './db';
import {
  brandCategories,
  brandStores,
  brands,
  categories,
  expenseCategories,
  stores,
  subcategories,
} from './db/foundation-schema';
import { entries } from './db/schema';
import { organizationSettings } from './db/operational-schema';
import { and, desc } from 'drizzle-orm';
import type { ExpenseItem, Option } from './config';
import type { OrgSettings } from './org';

// Transitional helper retained only for legacy migration/admin routes.
export async function getOrgRow() {
  const [row] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.department, 'admin'), eq(entries.formType, 'org-settings')))
    .orderBy(desc(entries.id))
    .limit(1);
  return row ?? null;
}

function option(id: number, code: string, name: string): Option {
  return { value: code, label: name, id } as Option;
}

export async function getOrgSettings(): Promise<OrgSettings> {
  const [
    settingsRows,
    storeRows,
    brandRows,
    categoryRows,
    expenseRows,
    subcategoryRows,
    brandStoreRows,
    brandCategoryRows,
  ] = await Promise.all([
    db.select().from(organizationSettings).where(eq(organizationSettings.id, 1)).limit(1),
    db.select().from(stores).orderBy(asc(stores.name)),
    db.select().from(brands).orderBy(asc(brands.name)),
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select().from(expenseCategories).orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name)),
    db.select().from(subcategories).orderBy(asc(subcategories.sortOrder), asc(subcategories.name)),
    db.select().from(brandStores),
    db.select().from(brandCategories),
  ]);
  const settings = settingsRows[0];
  const storeOptions = storeRows.filter((store) => store.active && store.type === 'store').map((store) => option(store.id, store.code, store.name));
  const brandOptions = brandRows.filter((brand) => brand.active).map((brand) => option(brand.id, brand.code, brand.name));
  const categoryOptions = categoryRows.filter((category) => category.active).map((category) => option(category.id, category.code, category.name));
  const expenseItems = expenseRows
    .filter((item) => item.active)
    .map((item) => ({ value: item.code, label: item.name, group: item.group })) as ExpenseItem[];
  const subcategoryOptions = subcategoryRows
    .filter((subcategory) => subcategory.active)
    .map((subcategory) => option(subcategory.id, subcategory.code, subcategory.name));
  const storeCode = new Map(storeRows.map((store) => [store.id, store.code]));
  const brandCode = new Map(brandRows.map((brand) => [brand.id, brand.code]));
  const categoryCode = new Map(categoryRows.map((category) => [category.id, category.code]));
  const subcategoryCode = new Map(subcategoryRows.map((subcategory) => [subcategory.id, subcategory.code]));

  const mappedValues = <T extends { [key: string]: number }>(
    rows: T[],
    leftKey: keyof T,
    rightKey: keyof T,
    leftCodes: Map<number, string>,
    rightCodes: Map<number, string>
  ) => {
    const result: Record<string, string[]> = {};
    for (const row of rows) {
      const left = leftCodes.get(Number(row[leftKey]));
      const right = rightCodes.get(Number(row[rightKey]));
      if (left && right) result[left] = [...(result[left] ?? []), right];
    }
    return result;
  };

  return {
    companyName: settings?.companyName ?? 'StateStreet',
    tagline: settings?.tagline ?? 'Retail Group',
    currency: settings?.currency ?? 'GHS',
    logo: settings?.logo ?? '',
    weekStart: settings?.weekStart === 'sunday' ? 'sunday' : 'monday',
    security: {
      minPasswordLen: settings?.minimumPasswordLength ?? 8,
      sessionDays: settings?.sessionDays ?? 7,
    },
    stores: storeOptions,
    brands: brandOptions,
    categories: categoryOptions,
    expenseItems,
    subCategories: subcategoryOptions,
    brandStores: mappedValues(brandStoreRows, 'brandId', 'storeId', brandCode, storeCode),
    brandCategories: mappedValues(brandCategoryRows, 'brandId', 'categoryId', brandCode, categoryCode),
    categorySubcategories: subcategoryRows.reduce<Record<string, string[]>>((result, subcategory) => {
      const category = categoryCode.get(subcategory.categoryId);
      const child = subcategoryCode.get(subcategory.id);
      if (category && child) result[category] = [...(result[category] ?? []), child];
      return result;
    }, {}),
    closedStores: storeRows.filter((store) => store.type === 'store' && !store.active).map((store) => store.code),
  };
}
