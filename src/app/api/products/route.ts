import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { createProductSchema } from '@/lib/contracts/product';
import { formatContractError } from '@/lib/contracts/shared';
import { db } from '@/lib/db';
import { auditEvents, brandCategories, brands, categories, products, subcategories } from '@/lib/db/foundation-schema';
import { databaseErrorCode, sessionUserId } from '@/lib/server-errors';

const PRODUCT_EDITORS = new Set(['owner', 'commercial', 'operations', 'inventory']);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';
  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const conditions = [];
  if (!includeInactive) conditions.push(eq(products.active, true));
  if (q) conditions.push(or(ilike(products.sku, `%${q}%`), ilike(products.name, `%${q}%`))!);
  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      description: products.description,
      brandId: products.brandId,
      brandName: brands.name,
      categoryId: products.categoryId,
      categoryName: categories.name,
      subcategoryId: products.subcategoryId,
      subcategoryName: subcategories.name,
      size: products.size,
      color: products.color,
      unitCost: products.unitCost,
      sellingPrice: products.sellingPrice,
      active: products.active,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(subcategories, eq(products.subcategoryId, subcategories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(products.updatedAt), products.sku)
    .limit(limit);
  return NextResponse.json({ products: rows });
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
    const [brandRows, categoryRows, subcategoryRows, brandCategoryRows] = await Promise.all([
      db.select({ id: brands.id }).from(brands).where(and(eq(brands.id, input.brandId), eq(brands.active, true))).limit(1),
      db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, input.categoryId), eq(categories.active, true)))
        .limit(1),
      input.subcategoryId
        ? db
            .select({ id: subcategories.id, categoryId: subcategories.categoryId })
            .from(subcategories)
            .where(and(eq(subcategories.id, input.subcategoryId), eq(subcategories.active, true)))
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
    if (input.subcategoryId && subcategoryRows[0]?.categoryId !== input.categoryId) {
      return NextResponse.json({ error: 'Subcategory does not belong to the selected category' }, { status: 400 });
    }
    const userId = sessionUserId(session.user.id);
    const result = await db.execute(sql`
      with new_product as (
        insert into products (
          sku, name, description, brand_id, category_id, subcategory_id, size, color,
          unit_cost, selling_price, created_by_user_id, updated_by_user_id
        ) values (
          ${input.sku}, ${input.name}, ${input.description ?? null}, ${input.brandId}, ${input.categoryId},
          ${input.subcategoryId ?? null}, ${input.size ?? null}, ${input.color ?? null}, ${input.unitCost ?? null},
          ${input.sellingPrice ?? null}, ${userId}, ${userId}
        )
        returning *
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
