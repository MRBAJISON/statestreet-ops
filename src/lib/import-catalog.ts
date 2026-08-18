// Excel parsing and atomic SQL for the product catalogue import.
//
// Two sheets, because they are two different things. "Products" describes an item
// once for the whole group — one row per SKU, since a SKU identifies the same
// garment wherever it is sold and duplicating it per store would split every
// group-level report in two. "Store Stock" is the per-store part: which store
// carries the item and how many it opened with. That sheet is what makes a
// product belong to a store.
import ExcelJS from 'exceljs';
import { sql, type SQL } from 'drizzle-orm';

export interface CatalogReference {
  id: number;
  code: string;
  name: string;
}

export interface CatalogImportReferences {
  brands: CatalogReference[];
  categories: CatalogReference[];
  subcategories: Array<CatalogReference & { categoryId: number }>;
  stores: CatalogReference[];
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
  sku: string;
  name: string;
  barcode: string | null;
  brandId: number;
  categoryId: number;
  subcategoryId: number | null;
  size: string | null;
  color: string | null;
  unitCost: string | null;
  sellingPrice: string | null;
}

export interface ParsedCatalogStock {
  storeId: number;
  sku: string;
  quantity: number;
}

export interface CatalogParseResult {
  products: ParsedCatalogProduct[];
  stock: ParsedCatalogStock[];
  errors: CatalogRowError[];
  totalRows: number;
}

const MAX_ROWS = 20_000;

export async function loadCatalogImportReferences(): Promise<CatalogImportReferences> {
  const [{ db }, schema] = await Promise.all([import('./db'), import('./db/foundation-schema')]);
  const { asc, eq } = await import('drizzle-orm');
  const [brandRows, categoryRows, subcategoryRows, storeRows] = await Promise.all([
    db
      .select({ id: schema.brands.id, code: schema.brands.code, name: schema.brands.name })
      .from(schema.brands)
      .where(eq(schema.brands.active, true))
      .orderBy(asc(schema.brands.name)),
    db
      .select({ id: schema.categories.id, code: schema.categories.code, name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.active, true))
      .orderBy(asc(schema.categories.name)),
    db
      .select({
        id: schema.subcategories.id,
        code: schema.subcategories.code,
        name: schema.subcategories.name,
        categoryId: schema.subcategories.categoryId,
      })
      .from(schema.subcategories)
      .where(eq(schema.subcategories.active, true))
      .orderBy(asc(schema.subcategories.name)),
    db
      .select({ id: schema.stores.id, code: schema.stores.code, name: schema.stores.name })
      .from(schema.stores)
      .where(eq(schema.stores.active, true))
      .orderBy(asc(schema.stores.name)),
  ]);
  return { brands: brandRows, categories: categoryRows, subcategories: subcategoryRows, stores: storeRows };
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

/** Matches a reference by code or name, case-insensitively. */
function matchReference<T extends CatalogReference>(rows: T[], value: string): T | undefined {
  const needle = value.trim().toLowerCase();
  if (!needle) return undefined;
  return rows.find((row) => row.code.toLowerCase() === needle || row.name.toLowerCase() === needle);
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
  const stockSheet = workbook.getWorksheet('Store Stock');

  const errors: CatalogRowError[] = [];
  const products: ParsedCatalogProduct[] = [];
  const stock: ParsedCatalogStock[] = [];
  const seenSkus = new Set<string>();
  let totalRows = 0;

  if (productSheet.rowCount > MAX_ROWS) {
    throw new CatalogImportFileError(`The Products sheet has more than ${MAX_ROWS} rows`);
  }

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

    const brand = matchReference(references.brands, cellStr(row.getCell(4).value));
    if (!brand) rowErrors.push('Brand was not recognised');
    const category = matchReference(references.categories, cellStr(row.getCell(5).value));
    if (!category) rowErrors.push('Category was not recognised');

    const subcategoryValue = cellStr(row.getCell(6).value);
    let subcategoryId: number | null = null;
    if (subcategoryValue) {
      const subcategory = matchReference(references.subcategories, subcategoryValue);
      if (!subcategory) rowErrors.push('Subcategory was not recognised');
      else if (category && subcategory.categoryId !== category.id) {
        rowErrors.push('Subcategory does not belong to that category');
      } else subcategoryId = subcategory.id;
    }

    const unitCost = money(cellStr(row.getCell(9).value), 'Unit cost', rowErrors);
    const sellingPrice = money(cellStr(row.getCell(10).value), 'Selling price', rowErrors);

    if (rowErrors.length) {
      errors.push({ sheet: 'Products', row: rowNumber, message: rowErrors.join('; ') });
      return;
    }
    seenSkus.add(sku.toLowerCase());
    products.push({
      sku,
      name,
      barcode: cellStr(row.getCell(3).value) || null,
      brandId: brand!.id,
      categoryId: category!.id,
      subcategoryId,
      size: cellStr(row.getCell(7).value) || null,
      color: cellStr(row.getCell(8).value) || null,
      unitCost,
      sellingPrice,
    });
  });

  if (stockSheet) {
    if (stockSheet.rowCount > MAX_ROWS) {
      throw new CatalogImportFileError(`The Store Stock sheet has more than ${MAX_ROWS} rows`);
    }
    stockSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const storeValue = cellStr(row.getCell(1).value);
      const sku = cellStr(row.getCell(2).value);
      if (!storeValue && !sku) return;
      totalRows += 1;
      const rowErrors: string[] = [];

      const store = matchReference(references.stores, storeValue);
      if (!store) rowErrors.push('Store was not recognised');
      if (!sku) rowErrors.push('SKU is required');
      // The SKU may already exist in the catalogue rather than in this file, so an
      // unknown one is only rejected at commit time, where the join can see both.

      const quantityValue = cellStr(row.getCell(3).value);
      const quantity = Number(quantityValue.replace(/,/g, '') || '0');
      if (!Number.isInteger(quantity) || quantity < 0) rowErrors.push('Quantity must be a whole number of zero or more');

      if (rowErrors.length) {
        errors.push({ sheet: 'Store Stock', row: rowNumber, message: rowErrors.join('; ') });
        return;
      }
      stock.push({ storeId: store!.id, sku, quantity });
    });
  }

  return { products, stock, errors, totalRows };
}

export interface CatalogCommitInput {
  filename: string;
  actorUserId: number;
  asOfDate: string;
  products: ParsedCatalogProduct[];
  stock: ParsedCatalogStock[];
  totalRows: number;
  errorRows: number;
}

/**
 * Applies the whole import in one statement so a partial catalogue can never be
 * left behind. Products are matched on SKU, so re-uploading a corrected file
 * updates rather than duplicating. Stock rows whose SKU is unknown are counted and
 * reported rather than silently dropped.
 */
export function buildCommitCatalogImportQuery(input: CatalogCommitInput): SQL {
  const products = JSON.stringify(input.products);
  const stock = JSON.stringify(input.stock);
  return sql`
    with batch as (
      insert into import_batches (
        type, filename, status, total_rows, imported_rows, error_rows, created_by_user_id, started_at, completed_at
      )
      values (
        'catalog', ${input.filename}, 'completed', ${input.totalRows},
        ${input.products.length + input.stock.length}, ${input.errorRows}, ${input.actorUserId}, now(), now()
      )
      returning id
    ), upserted_products as (
      insert into products (
        sku, name, barcode, brand_id, category_id, subcategory_id, size, color,
        unit_cost, selling_price, active, created_by_user_id, updated_by_user_id
      )
      select
        row."sku", row."name", nullif(row."barcode", ''), row."brandId", row."categoryId",
        row."subcategoryId", nullif(row."size", ''), nullif(row."color", ''),
        row."unitCost", row."sellingPrice", true, ${input.actorUserId}, ${input.actorUserId}
      from jsonb_to_recordset(${products}::jsonb) as row(
        "sku" text, "name" text, "barcode" text, "brandId" bigint, "categoryId" bigint,
        "subcategoryId" bigint, "size" text, "color" text, "unitCost" numeric(14, 2),
        "sellingPrice" numeric(14, 2)
      )
      on conflict (lower(sku)) do update set
        name = excluded.name,
        barcode = excluded.barcode,
        brand_id = excluded.brand_id,
        category_id = excluded.category_id,
        subcategory_id = excluded.subcategory_id,
        size = excluded.size,
        color = excluded.color,
        unit_cost = excluded.unit_cost,
        selling_price = excluded.selling_price,
        active = true,
        updated_by_user_id = ${input.actorUserId},
        updated_at = now()
      returning id, sku
    ), stock_rows as (
      select row."storeId" as store_id, row."sku" as sku, row."quantity" as quantity
      from jsonb_to_recordset(${stock}::jsonb) as row("storeId" bigint, "sku" text, "quantity" integer)
    ), matched_stock as (
      select s.store_id, p.id as product_id, s.quantity
      from stock_rows s
      join products p on lower(p.sku) = lower(s.sku)
    ), upserted_stock as (
      insert into store_stock_levels (store_id, product_id, quantity, as_of_date)
      select store_id, product_id, quantity, ${input.asOfDate}::date
      from matched_stock
      on conflict (store_id, product_id) do update set
        quantity = excluded.quantity,
        as_of_date = excluded.as_of_date,
        updated_at = now()
      returning id
    ), unmatched as (
      select count(*)::integer as value
      from stock_rows s
      where not exists (select 1 from products p where lower(p.sku) = lower(s.sku))
    )
    select
      (select id from batch) as batch_id,
      (select count(*)::integer from upserted_products) as products_written,
      (select count(*)::integer from upserted_stock) as stock_written,
      (select value from unmatched) as unmatched_stock_rows
  `;
}

const PRODUCT_COLUMNS = [
  { header: 'SKU', width: 18 },
  { header: 'Product Name', width: 32 },
  { header: 'Barcode', width: 18 },
  { header: 'Brand', width: 20 },
  { header: 'Category', width: 22 },
  { header: 'Subcategory', width: 22 },
  { header: 'Size', width: 10 },
  { header: 'Colour', width: 14 },
  { header: 'Unit Cost', width: 14 },
  { header: 'Selling Price', width: 14 },
];

const STOCK_COLUMNS = [
  { header: 'Store', width: 24 },
  { header: 'SKU', width: 18 },
  { header: 'Opening Quantity', width: 18 },
];

export async function buildCatalogTemplate(references: CatalogImportReferences): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const products = workbook.addWorksheet('Products');
  products.columns = PRODUCT_COLUMNS.map((column) => ({ header: column.header, width: column.width }));
  products.getRow(1).font = { bold: true };

  const stock = workbook.addWorksheet('Store Stock');
  stock.columns = STOCK_COLUMNS.map((column) => ({ header: column.header, width: column.width }));
  stock.getRow(1).font = { bold: true };

  // Reference sheet so the person filling the file can see the exact accepted
  // spellings rather than guessing and getting a row rejected.
  const reference = workbook.addWorksheet('Reference');
  reference.columns = [
    { header: 'Type', width: 16 },
    { header: 'Code', width: 24 },
    { header: 'Name', width: 32 },
  ];
  reference.getRow(1).font = { bold: true };
  for (const brand of references.brands) reference.addRow(['Brand', brand.code, brand.name]);
  for (const category of references.categories) reference.addRow(['Category', category.code, category.name]);
  for (const subcategory of references.subcategories) {
    reference.addRow(['Subcategory', subcategory.code, subcategory.name]);
  }
  for (const store of references.stores) reference.addRow(['Store', store.code, store.name]);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
