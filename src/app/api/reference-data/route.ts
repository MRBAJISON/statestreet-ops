import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  brandCategories,
  brandStores,
  brands,
  categories,
  expenseCategories,
  paymentMethods,
  stores,
  suppliers,
  subcategories,
} from '@/lib/db/foundation-schema';
import { cashAccounts, organizationSettings } from '@/lib/db/operational-schema';
import { users } from '@/lib/db/schema';

export const runtime = 'nodejs';

const FINANCE_REFERENCE_ROLES = new Set(['owner', 'finance', 'operations']);
const INVENTORY_REFERENCE_ROLES = new Set(['owner', 'inventory', 'operations']);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const includeFinance = FINANCE_REFERENCE_ROLES.has(session.user.role);
  const includeInventory = INVENTORY_REFERENCE_ROLES.has(session.user.role);
  const [
    organizationRows,
    storeRows,
    brandRows,
    categoryRows,
    brandStoreRows,
    brandCategoryRows,
    subcategoryRows,
    paymentRows,
    expenseRows,
    supplierRows,
    cashAccountRows,
    userRows,
  ] = await Promise.all([
    db
      .select({ name: organizationSettings.companyName, currency: organizationSettings.currency, weekStart: organizationSettings.weekStart })
      .from(organizationSettings)
      .where(eq(organizationSettings.id, 1))
      .limit(1),
    db
      .select({ id: stores.id, code: stores.code, name: stores.name, type: stores.type })
      .from(stores)
      .where(eq(stores.active, true))
      .orderBy(asc(stores.type), asc(stores.name)),
    db
      .select({ id: brands.id, code: brands.code, name: brands.name })
      .from(brands)
      .where(eq(brands.active, true))
      .orderBy(asc(brands.name)),
    db
      .select({ id: categories.id, code: categories.code, name: categories.name })
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select({ brandId: brandStores.brandId, storeId: brandStores.storeId }).from(brandStores),
    db.select({ brandId: brandCategories.brandId, categoryId: brandCategories.categoryId }).from(brandCategories),
    db
      .select({ id: subcategories.id, code: subcategories.code, name: subcategories.name, categoryId: subcategories.categoryId })
      .from(subcategories)
      .where(eq(subcategories.active, true))
      .orderBy(asc(subcategories.sortOrder), asc(subcategories.name)),
    db
      .select({ id: paymentMethods.id, code: paymentMethods.code, name: paymentMethods.name })
      .from(paymentMethods)
      .where(eq(paymentMethods.active, true))
      .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name)),
    includeFinance
      ? db
          .select({ id: expenseCategories.id, code: expenseCategories.code, name: expenseCategories.name, group: expenseCategories.group })
          .from(expenseCategories)
          .where(eq(expenseCategories.active, true))
          .orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name))
      : Promise.resolve([]),
    includeInventory
      ? db
          .select({ id: suppliers.id, code: suppliers.code, name: suppliers.name })
          .from(suppliers)
          .where(eq(suppliers.active, true))
          .orderBy(asc(suppliers.name))
      : Promise.resolve([]),
    includeFinance
      ? db
          .select({ id: cashAccounts.id, code: cashAccounts.code, name: cashAccounts.name, type: cashAccounts.type })
          .from(cashAccounts)
          .where(eq(cashAccounts.active, true))
          .orderBy(asc(cashAccounts.name))
      : Promise.resolve([]),
    db
      .select({ id: users.id, name: users.name, role: users.role, store: users.store })
      .from(users)
      .where(and(eq(users.active, true)))
      .orderBy(asc(users.name)),
  ]);

  const assignedStore = session.user.store
    ? storeRows.find((store) => store.code === session.user.store) ?? null
    : null;

  return NextResponse.json(
    {
      organization: organizationRows[0] ?? { name: 'StateStreet', currency: 'GHS', weekStart: 'monday' },
      capabilities: { canDecideWeeklyReviews: session.user.role === 'commercial' },
      stores: storeRows,
      assignedStore,
      brands: brandRows,
      categories: categoryRows,
      brandStores: brandStoreRows,
      brandCategories: brandCategoryRows,
      subcategories: subcategoryRows,
      paymentMethods: paymentRows,
      expenseCategories: expenseRows,
      suppliers: supplierRows,
      cashAccounts: cashAccountRows,
      users: userRows,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
