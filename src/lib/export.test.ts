import ExcelJS from 'exceljs';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  buildWorkbook,
  canExportScope,
  canIncludeCustomerContacts,
  getExportSheetDefinitions,
  getExportScopeConfig,
  parseExportDateRange,
} from './export';
import { testDatabaseUrl } from './test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const databaseIt = databaseUrl ? it : it.skip;

describe('export authorization and date range', () => {
  it('keeps each role on its server-approved scope and gives owner the all scope', () => {
    expect(getExportScopeConfig('owner')?.scope).toBe('all');
    expect(canExportScope('owner', 'all')).toBe(true);
    expect(canExportScope('owner', 'finance')).toBe(false);
    expect(canExportScope('finance', 'finance')).toBe(true);
    expect(canExportScope('finance', 'all')).toBe(false);
    expect(canExportScope('store-manager', 'store')).toBe(true);
  });

  it('authorizes contact fields only for follow-up and assigned-store workflows', () => {
    expect(canIncludeCustomerContacts('commercial', 'commercial')).toBe(true);
    expect(canIncludeCustomerContacts('marketing', 'marketing')).toBe(true);
    expect(canIncludeCustomerContacts('store-manager', 'store')).toBe(true);
    expect(canIncludeCustomerContacts('owner', 'all')).toBe(false);
    expect(canIncludeCustomerContacts('operations', 'all')).toBe(false);
  });

  it('parses valid inclusive bounds and rejects impossible or reversed dates', () => {
    expect(parseExportDateRange(new URLSearchParams('from=2026-07-01&to=2026-07-31'))).toEqual({
      range: { from: '2026-07-01', to: '2026-07-31' },
    });
    expect(parseExportDateRange(new URLSearchParams('from=2024-02-29'))).toEqual({
      range: { from: '2024-02-29', to: undefined },
    });
    expect(parseExportDateRange(new URLSearchParams('from=2026-02-29'))).toEqual({
      error: 'from must be a valid YYYY-MM-DD date',
    });
    expect(parseExportDateRange(new URLSearchParams('from=2026-08-01&to=2026-07-31'))).toEqual({
      error: 'from cannot be after to',
    });
  });
});

describe('typed workbook', () => {
  it('keeps contact headers out of broad exports and exposes them only when authorized', () => {
    const broad = getExportSheetDefinitions('all', {
      includeCustomerContacts: false,
      includeUnitCost: true,
    }).find((sheet) => sheet.key === 'customerActivity');
    const commercial = getExportSheetDefinitions('commercial', {
      includeCustomerContacts: true,
      includeUnitCost: true,
    }).find((sheet) => sheet.key === 'customerActivity');
    const marketingFeedback = getExportSheetDefinitions('marketing', {
      includeCustomerContacts: true,
      includeUnitCost: false,
    }).find((sheet) => sheet.key === 'customerFeedback');
    const broadFeedback = getExportSheetDefinitions('all', {
      includeCustomerContacts: false,
      includeUnitCost: true,
    }).find((sheet) => sheet.key === 'customerFeedback');

    expect(broad?.name).toBe('Customer Activity');
    expect(broad?.columns.map((column) => column.header)).not.toEqual(
      expect.arrayContaining(['Customer Name', 'Phone', 'Occupation', 'Size Preference', 'Notes'])
    );
    expect(commercial?.name).toBe('Customer Capture');
    expect(commercial?.columns.map((column) => column.header)).toEqual(
      expect.arrayContaining(['Customer Name', 'Phone', 'Occupation', 'Size Preference', 'Notes'])
    );
    expect(marketingFeedback?.columns.map((column) => column.header)).toEqual(
      expect.arrayContaining(['Contact Name', 'Phone or Email', 'Follow-up Until'])
    );
    expect(broadFeedback?.columns.map((column) => column.header)).not.toEqual(
      expect.arrayContaining(['Contact Name', 'Phone or Email', 'Follow-up Until'])
    );
  });

  it('builds the all-scope workbook with stable typed sheets and headers', async () => {
    const buffer = await buildWorkbook({
      scope: 'all',
      range: { from: '2026-07-01', to: '2026-07-31' },
      includeCustomerContacts: false,
      includeUnitCost: true,
      generatedAt: new Date('2026-07-11T12:00:00.000Z'),
      rows: {
        dailyReports: [
          {
            businessDate: '2026-07-10',
            storeCode: 'labone-men',
            storeName: 'Labone Men',
            status: 'approved',
            transactions: 18,
            netRevenue: 4200,
          },
        ],
      },
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(
      expect.arrayContaining([
        'Export Index',
        'Daily Reports',
        'Payments',
        'Expenses',
        'Sales by Category',
        'Campaigns',
        'Product Catalog',
        'Inventory Movements',
        'Brand Health',
        'Weekly Reviews',
        'Action Items',
        'Incidents',
      ])
    );
    expect(workbook.worksheets).toHaveLength(36);

    const reportSheet = workbook.getWorksheet('Daily Reports');
    const reportHeaders = (reportSheet?.getRow(5).values as unknown[]).slice(1);
    expect(reportHeaders).toEqual(
      expect.arrayContaining([
        'Business Date',
        'Store Code',
        'Status',
        'Net Revenue',
        'Payments',
        'Payment Variance',
      ])
    );
    expect(reportSheet?.getCell('A6').value).toBe('2026-07-10');

    const customerHeaders = (workbook.getWorksheet('Customer Activity')?.getRow(5).values as unknown[]).slice(1);
    expect(customerHeaders).not.toEqual(expect.arrayContaining(['Customer Name', 'Phone']));
    expect(workbook.getWorksheet('Export Index')?.getCell('B8').value).toBe(1);
  });

  databaseIt('executes broad, contact-authorized, and assigned-store relational loaders', async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_DRIVER = 'node-postgres';
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query('truncate table users, stores, brands, categories restart identity cascade');
    const ownerId = Number(
      (
        await client.query(
          `insert into users (name, email, password_hash, role, department)
           values ('Export Owner', 'export-owner@example.com', 'not-used', 'owner', 'executive')
           returning id`
        )
      ).rows[0].id
    );
    const storeId = Number(
      (
        await client.query(
          `insert into stores (code, name) values ('labone-men', 'Labone Men') returning id`
        )
      ).rows[0].id
    );
    const brandId = Number(
      (await client.query(`insert into brands (code, name) values ('state', 'StateStreet') returning id`)).rows[0].id
    );
    const categoryId = Number(
      (await client.query(`insert into categories (code, name) values ('menswear', 'Menswear') returning id`)).rows[0].id
    );
    const productId = Number(
      (
        await client.query(
          `insert into products (sku, name, brand_id, category_id, created_by_user_id, updated_by_user_id)
           values ('EXPORT-001', 'Export Fixture', $1, $2, $3, $3)
           returning id`,
          [brandId, categoryId, ownerId]
        )
      ).rows[0].id
    );
    const reportId = Number(
      (
        await client.query(
          `insert into daily_reports (
             store_id, business_date, status, transactions, footfall, total_customers,
             new_customers, returning_customers, created_by_user_id, updated_by_user_id
           ) values ($1, '2026-07-10', 'approved', 1, 2, 1, 1, 0, $2, $2)
           returning id`,
          [storeId, ownerId]
        )
      ).rows[0].id
    );
    await client.query(
      `insert into daily_sales_lines (
         daily_report_id, category_id, opening_stock, units_sold, gross_revenue, cogs
       ) values ($1, $2, 2, 1, 100, 40)`,
      [reportId, categoryId]
    );
    const customerId = Number(
      (
        await client.query(
          `insert into customers (name, phone, phone_normalized, created_by_user_id, updated_by_user_id)
           values ('Export Customer', '0240000000', '233240000000', $1, $1)
           returning id`,
          [ownerId]
        )
      ).rows[0].id
    );
    await client.query(
      `insert into customer_interactions (
         customer_id, store_id, business_date, lifecycle, source, product_id, captured_by_user_id
       ) values ($1, $2, '2026-07-10', 'buyer', 'walk-in', $3, $4)`,
      [customerId, storeId, productId, ownerId]
    );
    await client.query(
      `insert into customer_feedback (
         business_date, source, type, detail, store_id, contact_name, contact_value,
         contact_consent, retention_until
       ) values
         ('2026-07-10', 'active-follow-up', 'customer-experience', 'Please call me', $1,
          'Active Contact', 'active@example.com', true, '2099-12-31'),
         ('2026-07-10', 'expired-follow-up', 'customer-experience', 'Old follow-up', $1,
          'Expired Contact', 'expired@example.com', true, '2000-01-01')`,
      [storeId]
    );
    await client.query(
      `insert into action_items (
         department, store_id, title, owner_user_id, created_by_user_id, updated_by_user_id
       ) values ('operations', $1, 'Owner export fixture', $2, $2, $2)`,
      [storeId, ownerId]
    );
    const reviewId = Number(
      (
        await client.query(
          `insert into weekly_reviews (store_id, week_end, status, submitted_by_user_id)
           values ($1, '2026-07-12', 'submitted', $2)
           returning id`,
          [storeId, ownerId]
        )
      ).rows[0].id
    );
    await client.query(
      `insert into weekly_review_actions (weekly_review_id, action, owner_user_id)
       values ($1, 'Linked owner fixture', $2)`,
      [reviewId, ownerId]
    );
    await client.end();

    const [{ db }, { stores }, { eq }, { loadTypedExportRows }] = await Promise.all([
      import('./db'),
      import('./db/foundation-schema'),
      import('drizzle-orm'),
      import('./export'),
    ]);
    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.code, 'labone-men'))
      .limit(1);
    expect(store).toBeTruthy();

    const range = { from: '2026-01-01', to: '2026-12-31' };
    const broad = await loadTypedExportRows({
      scope: 'all',
      range,
      includeCustomerContacts: false,
      includeUnitCost: true,
    });
    const commercial = await loadTypedExportRows({
      scope: 'commercial',
      range,
      includeCustomerContacts: true,
      includeUnitCost: true,
    });
    const marketing = await loadTypedExportRows({
      scope: 'marketing',
      range,
      includeCustomerContacts: true,
      includeUnitCost: false,
    });
    const assignedStore = await loadTypedExportRows({
      scope: 'store',
      range,
      storeId: store?.id,
      includeCustomerContacts: true,
      includeUnitCost: false,
    });

    expect(Object.keys(broad)).toHaveLength(35);
    expect(broad.dailyReports?.length).toBeGreaterThan(0);
    expect(broad.actionItems?.[0]?.ownerName).toBe('Export Owner');
    expect(broad.weeklyReviewActions?.[0]?.ownerName).toBe('Export Owner');
    expect(commercial.customerActivity?.[0]).toHaveProperty('customerName');
    expect(marketing.customerFeedback?.find((row) => row.source === 'active-follow-up')).toMatchObject({
      contactName: 'Active Contact',
      contactValue: 'active@example.com',
      retentionUntil: '2099-12-31',
    });
    expect(marketing.customerFeedback?.find((row) => row.source === 'expired-follow-up')).toMatchObject({
      contactName: null,
      contactValue: null,
      retentionUntil: null,
    });
    expect(assignedStore.dailyReports?.every((row) => row.storeCode === 'labone-men')).toBe(true);
    expect(assignedStore.stockTransfers?.every((row) => !Object.hasOwn(row, 'totalValue'))).toBe(true);

    const verificationClient = new Client({ connectionString: databaseUrl });
    await verificationClient.connect();
    const expired = await verificationClient.query(
      `select contact_name, contact_value, contact_consent, contact_redacted_at
       from customer_feedback where source = 'expired-follow-up'`
    );
    await verificationClient.end();
    expect(expired.rows[0]).toMatchObject({
      contact_name: null,
      contact_value: null,
      contact_consent: false,
    });
    expect(expired.rows[0].contact_redacted_at).toBeTruthy();
  });
});
