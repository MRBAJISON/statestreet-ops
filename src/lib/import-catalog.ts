// Excel parsing and atomic SQL for the product catalogue import.
//
// One sheet, one store. Inventory picks the store in the app rather than naming
// it in every row, and the brand is derived from that store's mapping — a store
// carries one brand, so asking for it again in the file only creates a way to get
// it wrong. Each row is therefore just the product and how many that store holds.
import ExcelJS from 'exceljs';
import { sql, type SQL } from 'drizzle-orm';

export interface CatalogReference {
  id: number;
  code: string;
  name: string;
}

export interface CatalogStoreReference extends CatalogReference {
  brandId: number | null;
  brandName: string | null;
}

export interface CatalogImportReferences {
  categories: CatalogReference[];
  stores: CatalogStoreReference[];
}

export class CatalogImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogImportFileError';
  }
}

export interface CatalogRowError {
  sheet: string;
  row: number;
  message: string;
}

export interface ParsedCatalogProduct {
  // One number: the SKU is also the barcode.
  sku: string;
  name: string;
  categoryId: number;
  sellingPrice: string | null;
  quantity: number;
}

export interface CatalogParseResult {
  products: ParsedCatalogProduct[];
  errors: CatalogRowError[];
  totalRows: number;
}

const MAX_ROWS = 20_000;

export async function loadCatalogImportReferences(): Promise<CatalogImportReferences> {
  const [{ db }, schema] = await Promise.all([import('./db'), import('./db/foundation-schema')]);
  const { and, asc, eq } = await import('drizzle-orm');
  const [categoryRows, storeRows] = await Promise.all([
    db
      .select({ id: schema.categories.id, code: schema.categories.code, name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.active, true))
      .orderBy(asc(schema.categories.name)),
    // Left joined: a store with no brand mapping still appears, so the person
    // importing sees why it cannot be used instead of it silently missing.
    db
      .select({
        id: schema.stores.id,
        code: schema.stores.code,
        name: schema.stores.name,
        brandId: schema.brands.id,
        brandName: schema.brands.name,
      })
      .from(schema.stores)
      .leftJoin(schema.brandStores, eq(schema.brandStores.storeId, schema.stores.id))
      .leftJoin(schema.brands, eq(schema.brands.id, schema.brandStores.brandId))
      .where(and(eq(schema.stores.active, true), eq(schema.stores.type, 'store')))
      .orderBy(asc(schema.stores.name)),
  ]);

  // A store mapped to more than one brand yields more than one row. Keeping only
  // the first would silently pick a brand, so ambiguity is preserved by nulling
  // the brand and letting the import refuse the store with an explanation.
  const byStore = new Map<number, CatalogStoreReference>();
  for (const row of storeRows) {
    const existing = byStore.get(row.id);
    if (!existing) {
      byStore.set(row.id, { id: row.id, code: row.code, name: row.name, brandId: row.brandId, brandName: row.brandName });
    } else if (existing.brandId !== row.brandId) {
      existing.brandId = null;
      existing.brandName = null;
    }
  }
  return { categories: categoryRows, stores: [...byStore.values()] };
}

function cellStr(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if (typeof object.text === 'string') return object.text;
    if (object.result != null) return String(object.result);
    if (Array.isArray(object.richText)) {
      return (object.richText as { text?: string }[]).map((part) => part.text ?? '').join('');
    }
    return '';
  }
  return String(value).trim();
}

/**
 * Reduces a name to its words so spelling variants that mean the same thing match.
 *
 * "Bags & Wallets", "Bags and Wallets" and the code "bags-wallets" all land on
 * "bags wallets". Without this, a file rejects rows over an ampersand or a hyphen,
 * which tells the person filling it nothing useful.
 */
export function normaliseReferenceName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word && word !== 'and')
    .join(' ');
}

/** Matches a reference by code or name, ignoring case, punctuation and "and". */
export function matchReference<T extends CatalogReference>(rows: T[], value: string): T | undefined {
  const needle = normaliseReferenceName(value);
  if (!needle) return undefined;
  return rows.find(
    (row) => normaliseReferenceName(row.code) === needle || normaliseReferenceName(row.name) === needle
  );
}

function money(value: string, label: string, errors: string[]): string | null {
  if (!value) return null;
  const amount = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount < 0) {
    errors.push(`${label} must be a number of zero or more`);
    return null;
  }
  return amount.toFixed(2);
}

export async function parseCatalogFile(
  buffer: Buffer,
  references: CatalogImportReferences
): Promise<CatalogParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new CatalogImportFileError('That file could not be read as a spreadsheet');
  }

  const productSheet = workbook.getWorksheet('Products');
  if (!productSheet) throw new CatalogImportFileError('The workbook needs a sheet named "Products"');
  if (productSheet.rowCount > MAX_ROWS) {
    throw new CatalogImportFileError(`The Products sheet has more than ${MAX_ROWS} rows`);
  }

  const errors: CatalogRowError[] = [];
  const products: ParsedCatalogProduct[] = [];
  const seenSkus = new Set<string>();
  let totalRows = 0;

  productSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const sku = cellStr(row.getCell(1).value);
    const name = cellStr(row.getCell(2).value);
    if (!sku && !name) return;
    totalRows += 1;
    const rowErrors: string[] = [];

    if (!sku) rowErrors.push('SKU is required');
    if (!name) rowErrors.push('Product name is required');
    if (sku && seenSkus.has(sku.toLowerCase())) rowErrors.push(`SKU ${sku} appears more than once in the file`);

    // Naming the value that failed matters more than saying it failed: without it
    // the person has to guess which of five columns the importer disliked.
    const categoryValue = cellStr(row.getCell(3).value);
    const category = matchReference(references.categories, categoryValue);
    if (!category) {
      rowErrors.push(
        categoryValue
          ? `Category "${categoryValue}" was not recognised`
          : 'Category is required'
      );
    }

    const sellingPrice = money(cellStr(row.getCell(4).value), 'Selling price', rowErrors);

    const quantityValue = cellStr(row.getCell(5).value).replace(/,/g, '');
    const quantity = Number(quantityValue || '0');
    if (!Number.isInteger(quantity) || quantity < 0) {
      rowErrors.push('Quantity must be a whole number of zero or more');
    }

    if (rowErrors.length) {
      errors.push({ sheet: 'Products', row: rowNumber, message: rowErrors.join('; ') });
      return;
    }
    seenSkus.add(sku.toLowerCase());
    products.push({ sku, name, categoryId: category!.id, sellingPrice, quantity });
  });

  return { products, errors, totalRows };
}

export interface CatalogCommitInput {
  filename: string;
  actorUserId: number;
  storeId: number;
  brandId: number;
  asOfDate: string;
  products: ParsedCatalogProduct[];
  totalRows: number;
  errorRows: number;
}

/**
 * Applies the whole import in one statement so a partial catalogue can never be
 * left behind. Products are matched on SKU, so re-uploading a corrected file
 * updates rather than duplicating, and the quantity is written against the one
 * store this import was run for.
 */
export function buildCommitCatalogImportQuery(input: CatalogCommitInput): SQL {
  const products = JSON.stringify(input.products);
  return sql`
    with batch as (
      insert into import_batches (
        type, filename, status, total_rows, imported_rows, error_rows, created_by_user_id, started_at, completed_at
      )
      values (
        'catalog', ${input.filename}, 'completed', ${input.totalRows},
        ${input.products.length}, ${input.errorRows}, ${input.actorUserId}, now(), now()
      )
      returning id
    ), upserted_products as (
      insert into products (
        sku, barcode, name, brand_id, category_id, selling_price, active,
        created_by_user_id, updated_by_user_id
      )
      select
        row."sku", row."sku", row."name", ${input.brandId}, row."categoryId",
        row."sellingPrice", true, ${input.actorUserId}, ${input.actorUserId}
      from jsonb_to_recordset(${products}::jsonb) as row(
        "sku" text, "name" text, "categoryId" bigint, "sellingPrice" numeric(14, 2), "quantity" integer
      )
      on conflict (lower(sku)) do update set
        barcode = excluded.barcode,
        name = excluded.name,
        brand_id = excluded.brand_id,
        category_id = excluded.category_id,
        selling_price = excluded.selling_price,
        active = true,
        updated_by_user_id = ${input.actorUserId},
        updated_at = now()
      returning id, sku
    ), upserted_stock as (
      insert into store_stock_levels (store_id, product_id, quantity, as_of_date)
      select ${input.storeId}, written.id, row."quantity", ${input.asOfDate}::date
      from jsonb_to_recordset(${products}::jsonb) as row("sku" text, "quantity" integer)
      -- Joined against the CTE, not the products table. Every CTE in a statement
      -- sees the snapshot from before the statement ran, so a plain products
      -- reference cannot see the rows just inserted above — which silently wrote
      -- no stock at all for a first import, where every SKU is new.
      join upserted_products written on lower(written.sku) = lower(row."sku")
      on conflict (store_id, product_id) do update set
        quantity = excluded.quantity,
        as_of_date = excluded.as_of_date,
        updated_at = now()
      returning id
    )
    select
      (select id from batch) as batch_id,
      (select count(*)::integer from upserted_products) as products_written,
      (select count(*)::integer from upserted_stock) as stock_written
  `;
}

const PRODUCT_COLUMNS = [
  { header: 'SKU / Barcode', width: 20 },
  { header: 'Product Name', width: 32 },
  { header: 'Category', width: 22 },
  { header: 'Selling Price', width: 14 },
  { header: 'Quantity', width: 12 },
];

export async function buildCatalogTemplate(
  references: CatalogImportReferences,
  categories: CatalogReference[] = references.categories
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const products = workbook.addWorksheet('Products');
  products.columns = PRODUCT_COLUMNS.map((column) => ({ header: column.header, width: column.width }));
  products.getRow(1).font = { bold: true };

  // Reference sheet so the person filling the file can see the exact accepted
  // category names rather than guessing and getting a row rejected. Scoped to the
  // chosen store where one is known: listing every category in the group invites
  // someone to pick one this store does not sell.
  const reference = workbook.addWorksheet('Categories');
  reference.columns = [{ header: 'Category', width: 32 }];
  reference.getRow(1).font = { bold: true };
  for (const category of categories) reference.addRow([category.name]);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

/** The categories a store's brand actually sells, for the template and for guidance. */
export async function categoriesForStore(storeId: number): Promise<CatalogReference[]> {
  const [{ db }, schema] = await Promise.all([import('./db'), import('./db/foundation-schema')]);
  const { and, asc, eq } = await import('drizzle-orm');
  return db
    .selectDistinct({
      id: schema.categories.id,
      code: schema.categories.code,
      name: schema.categories.name,
    })
    .from(schema.categories)
    .innerJoin(schema.brandCategories, eq(schema.brandCategories.categoryId, schema.categories.id))
    .innerJoin(schema.brandStores, eq(schema.brandStores.brandId, schema.brandCategories.brandId))
    .where(and(eq(schema.brandStores.storeId, storeId), eq(schema.categories.active, true)))
    .orderBy(asc(schema.categories.name));
}
