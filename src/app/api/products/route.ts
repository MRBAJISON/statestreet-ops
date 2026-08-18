import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { createProductSchema } from '@/lib/contracts/product';
import { formatContractError } from '@/lib/contracts/shared';
import { db } from '@/lib/db';
import {
  auditEvents,
  brandCategories,
  brands,
  categories,
  products,
  storeStockLevels,
  stores,
} from '@/lib/db/foundation-schema';
import { databaseErrorCode, sessionUserId } from '@/lib/server-errors';

const PRODUCT_EDITORS = new Set(['owner', 'commercial', 'operations', 'inventory']);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const rawBrandIds = req.nextUrl.searchParams.get('brandIds')?.trim() ?? '';
  const requestedBrandIds = rawBrandIds
    ? rawBrandIds.split(',').map((value) => Number(value))
    : [];
  if (
    requestedBrandIds.length > 20 ||
    requestedBrandIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
  ) {
    return NextResponse.json({ error: 'brandIds must contain valid catalog identifiers' }, { status: 400 });
  }
  const requestedStatus = req.nextUrl.searchParams.get('status');
  const status = requestedStatus === 'all' || requestedStatus === 'inactive'
    ? requestedStatus
    : req.nextUrl.searchParams.get('includeInactive') === 'true' ? 'all' : 'active';
  if (status !== 'active' && !PRODUCT_EDITORS.has(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const requestedPageSize = Number(req.nextUrl.searchParams.get('pageSize') ?? req.nextUrl.searchParams.get('limit') ?? 50);
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 100) : 50;
  const requestedPage = Number(req.nextUrl.searchParams.get('page') ?? 1);
  const page = Number.isInteger(requestedPage) ? Math.max(requestedPage, 1) : 1;
  // Staff type part of a barcode — typically the last few digits — rather than
  // scanning a whole one, so a digit query matches the end of the barcode as well
  // as anywhere inside it. A hardware scanner sends the full digits and lands on
  // the same path.
  const isDigitQuery = q.length > 0 && /^\d+$/.test(q);
  const conditions = [];
  if (status === 'active') conditions.push(eq(products.active, true));
  if (status === 'inactive') conditions.push(eq(products.active, false));
  if (q) {
    conditions.push(
      or(ilike(products.sku, `%${q}%`), ilike(products.name, `%${q}%`), ilike(products.barcode, `%${q}%`))!
    );
  }
  if (requestedBrandIds.length) conditions.push(inArray(products.brandId, requestedBrandIds));
  const where = conditions.length ? and(...conditions) : undefined;

  // A store's own products rank first. "Its own" means the products that store
  // actually carries — the stock rows loaded for it by the catalogue import — not
  // whatever its brand happens to sell group-wide.
  //
  // Ranked rather than filtered: a store can legitimately sell something it has no
  // stock row for, and hiding it would push a real sale into the untracked "Other"
  // line, which is worse than showing one extra result.
  const storeIdParam = Number(req.nextUrl.searchParams.get('storeId') ?? '');
  const storeId = Number.isSafeInteger(storeIdParam) && storeIdParam > 0 ? storeIdParam : null;
  const storeRank = storeId
    ? sql<number>`case when exists (
        select 1 from ${storeStockLevels} level
        where level.product_id = ${products.id} and level.store_id = ${storeId}
      ) then 0 else 1 end`
    : sql<number>`0`;
  // Exact barcode beats a partial one, and any barcode hit beats a name hit.
  const matchRank = q
    ? sql<number>`case
        when lower(${products.barcode}) = lower(${q}) then 0
        when ${isDigitQuery} and ${products.barcode} like ${`%${q}`} then 1
        when ${products.barcode} is not null and lower(${products.barcode}) like lower(${`%${q}%`}) then 2
        when lower(${products.sku}) like lower(${`%${q}%`}) then 3
        else 4
      end`
    : sql<number>`0`;
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        brandId: products.brandId,
        brandName: brands.name,
        categoryId: products.categoryId,
        categoryName: categories.name,
        barcode: products.barcode,
        sellingPrice: products.sellingPrice,
        active: products.active,
        updatedAt: products.updatedAt,
        // Stock held across every store, so the catalogue list shows what exists
        // without needing a second request per row.
        quantity: sql<number>`(
          select coalesce(sum(level.quantity), 0)::integer
          from ${storeStockLevels} level
          where level.product_id = ${products.id}
        )`,
      })
      .from(products)
      .innerJoin(brands, eq(products.brandId, brands.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(where)
      .orderBy(storeRank, matchRank, desc(products.updatedAt), products.sku)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: sql<number>`count(*)::integer` }).from(products).where(where),
  ]);
  return NextResponse.json({
    // Unit cost is no longer part of the catalogue, so there is nothing left here
    // to redact by role.
    products: rows,
    pagination: {
      page,
      pageSize,
      total: totals[0]?.value ?? 0,
      totalPages: Math.max(1, Math.ceil((totals[0]?.value ?? 0) / pageSize)),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!PRODUCT_EDITORS.has(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
    }
    const input = parsed.data;
    const [brandRows, categoryRows, storeRows, brandCategoryRows] = await Promise.all([
      db.select({ id: brands.id }).from(brands).where(and(eq(brands.id, input.brandId), eq(brands.active, true))).limit(1),
      db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, input.categoryId), eq(categories.active, true)))
        .limit(1),
      input.storeId
        ? db
            .select({ id: stores.id })
            .from(stores)
            .where(and(eq(stores.id, input.storeId), eq(stores.active, true), eq(stores.type, 'store')))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({ categoryId: brandCategories.categoryId })
        .from(brandCategories)
        .where(eq(brandCategories.brandId, input.brandId)),
    ]);
    if (!brandRows.length) return NextResponse.json({ error: 'Brand was not found or is inactive' }, { status: 400 });
    if (!categoryRows.length) return NextResponse.json({ error: 'Category was not found or is inactive' }, { status: 400 });
    if (brandCategoryRows.length && !brandCategoryRows.some((row) => row.categoryId === input.categoryId)) {
      return NextResponse.json({ error: 'Category is not configured for the selected brand' }, { status: 400 });
    }
    if (input.storeId && !storeRows.length) {
      return NextResponse.json({ error: 'Store was not found or is inactive' }, { status: 400 });
    }
    if (input.quantity != null && !input.storeId) {
      return NextResponse.json({ error: 'Choose the store this quantity is held in' }, { status: 400 });
    }
    const userId = sessionUserId(session.user.id);
    const stocked = input.storeId != null && input.quantity != null;
    const result = await db.execute(sql`
      with new_product as (
        insert into products (
          sku, barcode, name, description, brand_id, category_id, selling_price,
          created_by_user_id, updated_by_user_id
        ) values (
          ${input.sku}, ${input.sku}, ${input.name}, ${input.description ?? null}, ${input.brandId},
          ${input.categoryId}, ${input.sellingPrice ?? null}, ${userId}, ${userId}
        )
        returning *
      ), new_stock as (
        insert into store_stock_levels (store_id, product_id, quantity, as_of_date)
        select ${input.storeId ?? null}, product.id, ${input.quantity ?? 0}, current_date
        from new_product product
        where ${stocked}
        on conflict (store_id, product_id) do update set
          quantity = excluded.quantity, as_of_date = excluded.as_of_date, updated_at = now()
        returning id
      ), new_audit as (
        insert into ${auditEvents} (entity_type, entity_id, action, actor_user_id, after)
        select 'product', product.id, 'create', ${userId}, to_jsonb(product)
        from new_product product
        returning id
      )
      select id from new_product
    `);
    const id = Number((result.rows as { id: number | string }[])[0]?.id);
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return NextResponse.json({ ok: true, product }, { status: 201 });
  } catch (error) {
    if (databaseErrorCode(error) === '23505') {
      return NextResponse.json({ error: 'A product with this SKU already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
