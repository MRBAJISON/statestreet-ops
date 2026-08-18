import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { updateProductSchema } from '@/lib/contracts/product';
import { formatContractError } from '@/lib/contracts/shared';
import { db } from '@/lib/db';
import { auditEvents, brandCategories, brands, categories, products } from '@/lib/db/foundation-schema';
import { databaseErrorCode, sessionUserId } from '@/lib/server-errors';

const PRODUCT_EDITORS = new Set(['owner', 'commercial', 'operations', 'inventory']);

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!PRODUCT_EDITORS.has(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const productId = Number((await context.params).id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }
    const parsed = updateProductSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });

    const [existing] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const input = parsed.data;
    const brandId = input.brandId ?? existing.brandId;
    const categoryId = input.categoryId ?? existing.categoryId;
    const [brandRows, categoryRows, brandCategoryRows] = await Promise.all([
      db.select({ id: brands.id }).from(brands).where(and(eq(brands.id, brandId), eq(brands.active, true))).limit(1),
      db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.active, true))).limit(1),
      db.select({ categoryId: brandCategories.categoryId }).from(brandCategories).where(eq(brandCategories.brandId, brandId)),
    ]);
    if (!brandRows.length) return NextResponse.json({ error: 'Brand was not found or is inactive' }, { status: 400 });
    if (!categoryRows.length) return NextResponse.json({ error: 'Category was not found or is inactive' }, { status: 400 });
    if (brandCategoryRows.length && !brandCategoryRows.some((row) => row.categoryId === categoryId)) {
      return NextResponse.json({ error: 'Category is not configured for the selected brand' }, { status: 400 });
    }

    const userId = sessionUserId(session.user.id);
    const result = await db.execute(sql`
      with before_product as materialized (
        select * from products where id = ${productId} for update
      ), updated as (
        update products product
        set sku = case when ${input.sku !== undefined} then ${input.sku ?? existing.sku} else before.sku end,
            -- The SKU is the barcode, so they move together and can never drift.
            barcode = case when ${input.sku !== undefined} then ${input.sku ?? existing.sku} else before.sku end,
            name = case when ${input.name !== undefined} then ${input.name ?? existing.name} else before.name end,
            description = case when ${input.description !== undefined} then ${input.description ?? null} else before.description end,
            brand_id = case when ${input.brandId !== undefined} then ${input.brandId ?? existing.brandId} else before.brand_id end,
            category_id = case when ${input.categoryId !== undefined} then ${input.categoryId ?? existing.categoryId} else before.category_id end,
            selling_price = case when ${input.sellingPrice !== undefined} then ${input.sellingPrice ?? null} else before.selling_price end,
            active = case when ${input.active !== undefined} then ${input.active ?? true} else before.active end,
            updated_by_user_id = ${userId},
            updated_at = now()
        from before_product before
        where product.id = before.id
          and date_trunc('milliseconds', before.updated_at) = date_trunc('milliseconds', ${input.expectedUpdatedAt}::timestamptz)
        returning product.*
      ), audit as (
        insert into ${auditEvents} (entity_type, entity_id, action, actor_user_id, before, after)
        select 'product', updated.id, 'update', ${userId}, to_jsonb(before_product), to_jsonb(updated)
        from updated join before_product on before_product.id = updated.id
        returning id
      )
      select id from updated
    `);
    if (!result.rows.length) {
      return NextResponse.json({ error: 'This product changed after you opened it. Refresh and try again.' }, { status: 409 });
    }
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    if (databaseErrorCode(error) === '23505') {
      return NextResponse.json({ error: 'A product with this SKU already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
