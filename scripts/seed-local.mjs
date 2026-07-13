#!/usr/bin/env node
import pg from 'pg';
import { LOCAL_DATABASE_NAME, LOCAL_DATABASE_URL, assertLocalDatabaseUrl } from './local-config.mjs';

assertLocalDatabaseUrl(LOCAL_DATABASE_URL);

let randomState = 0x5eed2026;
const random = () => {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 0x100000000;
};
const between = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const choice = (values) => values[between(0, values.length - 1)];
const roundMoney = (value) => Math.round(value * 100) / 100;

const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const daysAgo = (days) => {
  const value = new Date(today);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
};
const monthStart = (offset = 0) =>
  new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1)).toISOString().slice(0, 10);
const monthEnd = (offset = 0) =>
  new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset + 1, 0)).toISOString().slice(0, 10);

const stores = [
  ['dzorwulu-men', 'Dzorwulu Men', 'store'],
  ['east-legon-men', 'East Legon Men', 'store'],
  ['labone-men', 'Labone Men', 'store'],
  ['bw-labone', 'Boulevard Women Labone', 'store'],
  ['bw-dzorwulu', 'Boulevard Women Dzorwulu', 'store'],
  ['dangelo', "D'Angelo Palace", 'store'],
  ['woodpeckers', 'Woodpeckers', 'store'],
  ['head-office', 'Head Office', 'office'],
  ['warehouse', 'Main Warehouse', 'warehouse'],
];

const brands = [
  ['boulevard-men', 'Boulevard Men'],
  ['boulevard-women', 'Boulevard Women'],
  ['dangelo', "D'Angelo"],
  ['woodpeckers', 'Woodpeckers'],
  ['carbon-shoes', 'Carbon Shoes'],
];

const categories = [
  ['luxury-suits', 'Luxury Suits'],
  ['business-suits', 'Business Suits'],
  ['casual-blazers', 'Casual Blazers'],
  ['formal-shirts', 'Formal Shirts'],
  ['casual-shirts', 'Casual Shirts'],
  ['premium-t-shirts', 'Premium T-Shirts'],
  ['polo-shirts', 'Polo Shirts'],
  ['denim-jeans', 'Denim Jeans'],
  ['chinos', 'Chinos'],
  ['formal-trousers', 'Formal Trousers'],
  ['sneakers', 'Sneakers'],
  ['oxford-shoes', 'Oxford Shoes'],
  ['derby-shoes', 'Derby Shoes'],
  ['loafers', 'Loafers'],
  ['sandals', 'Sandals'],
  ['leather-belts', 'Leather Belts'],
  ['premium-belts', 'Premium Belts'],
  ['ties', 'Ties'],
  ['pocket-squares', 'Pocket Squares'],
  ['sunglasses', 'Sunglasses'],
  ['leather-bags', 'Leather Bags'],
  ['wallets-purses', 'Wallets & Purses'],
  ['watches', 'Watches'],
  ['fragrances', 'Fragrances'],
  ['safari-sets', 'Safari Sets'],
  ['knitwear', 'Knitwear'],
  ['streetwear-sets', 'Streetwear Sets'],
  ['jackets-outerwear', 'Jackets & Outerwear'],
];

const expenseCategories = [
  ['stock-purchases', 'Stock Purchases', 'operating'],
  ['freight-clearance', 'Freight & Clearance', 'operating'],
  ['forex', 'Forex', 'operating'],
  ['payroll', 'Payroll Cost', 'operating'],
  ['rent', 'Rent', 'operating'],
  ['utilities', 'Utilities', 'operating'],
  ['repairs-maintenance', 'Repairs & Maintenance', 'operating'],
  ['marketing-spend', 'Marketing Spend', 'operating'],
  ['delivery-transport', 'Delivery & Other Transport Costs', 'operating'],
  ['professional-fees', 'Professional Fees', 'operating'],
  ['statutory-payments', 'Statutory Payments', 'operating'],
  ['insurance', 'Insurance', 'operating'],
  ['bank-charges', 'Bank Charges', 'operating'],
  ['printing-stationery', 'Printing & Stationery', 'operating'],
  ['voice-data', 'Voice & Data Charges', 'operating'],
  ['food-entertainment', 'Food & Entertainment', 'operating'],
  ['foreign-travels', 'Foreign Travels', 'operating'],
  ['it-digital', 'IT & Digital Services', 'operating'],
  ['office-expenses', 'Office Expenses', 'operating'],
  ['fuel-vehicle', 'Fuel & Vehicle Maintenance', 'operating'],
  ['shop-store', 'Shop & Store Expenses', 'operating'],
  ['medical', 'Medical Expenses', 'operating'],
  ['asset-motor-vehicle', 'Asset - Motor Vehicle', 'capital'],
  ['asset-furniture-fittings', 'Asset - Furniture & Fittings', 'capital'],
  ['asset-shop-equipments', 'Asset - Shop Equipment', 'capital'],
  ['interest', 'Interest / Finance Cost', 'below-line'],
  ['tax', 'Tax', 'below-line'],
];

const paymentMethods = [
  ['bank-transfer', 'Bank Transfer'],
  ['cheque', 'Cheque'],
  ['cash', 'Cash'],
  ['mobile-money', 'Mobile Money'],
  ['pos-umb', 'POS UMB'],
  ['pos-omnibsic', 'POS OmniBSIC'],
];

const brandStoreCodes = {
  'boulevard-men': ['dzorwulu-men', 'east-legon-men', 'labone-men'],
  'boulevard-women': ['bw-labone', 'bw-dzorwulu'],
  dangelo: ['dangelo'],
  woodpeckers: ['woodpeckers'],
  'carbon-shoes': ['woodpeckers'],
};

const brandCategoryCodes = {
  'boulevard-men': [
    'luxury-suits', 'business-suits', 'casual-blazers', 'formal-shirts', 'casual-shirts',
    'premium-t-shirts', 'polo-shirts', 'denim-jeans', 'chinos', 'formal-trousers',
    'leather-belts', 'premium-belts', 'ties', 'pocket-squares', 'sunglasses', 'watches',
    'fragrances', 'safari-sets', 'knitwear', 'jackets-outerwear',
  ],
  'boulevard-women': [
    'casual-blazers', 'formal-shirts', 'casual-shirts', 'premium-t-shirts', 'denim-jeans',
    'sandals', 'sunglasses', 'leather-bags', 'wallets-purses', 'watches', 'fragrances',
    'knitwear', 'jackets-outerwear',
  ],
  dangelo: ['fragrances', 'watches', 'leather-bags', 'wallets-purses', 'sunglasses'],
  woodpeckers: [
    'casual-shirts', 'premium-t-shirts', 'polo-shirts', 'denim-jeans', 'chinos',
    'safari-sets', 'streetwear-sets', 'jackets-outerwear',
  ],
  'carbon-shoes': ['sneakers', 'oxford-shoes', 'derby-shoes', 'loafers', 'sandals'],
};

const users = [
  ['CEO / Owner', 'owner@statestreet.local', 'owner', 'executive', null],
  ['Finance Manager', 'finance@statestreet.local', 'finance', 'finance', null],
  ['Commercial Director', 'commercial@statestreet.local', 'commercial', 'commercial', null],
  ['Marketing Director', 'marketing@statestreet.local', 'marketing', 'marketing', null],
  ['Operations Manager', 'operations@statestreet.local', 'operations', 'operations', null],
  ['Inventory Manager', 'inventory@statestreet.local', 'inventory', 'inventory', null],
  ['Brand Manager', 'brand@statestreet.local', 'brand', 'brand', null],
  ...stores
    .filter(([, , type]) => type === 'store')
    .map(([code, name]) => [`${name} Manager`, `${code}.manager@statestreet.local`, 'store-manager', 'commercial', code]),
];

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  );
  const hex = (bytes) => [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex(salt)}:${hex(bits)}`;
}

const client = new pg.Client({ connectionString: LOCAL_DATABASE_URL });
await client.connect();

try {
  const identity = await client.query('select current_database() as database');
  if (identity.rows[0]?.database !== LOCAL_DATABASE_NAME) {
    throw new Error(`Refusing to seed database ${identity.rows[0]?.database ?? 'unknown'}.`);
  }

  await client.query('begin');
  const tableResult = await client.query(`
    select tablename
    from pg_tables
    where schemaname = 'public' and tablename <> 'local_schema_migrations'
    order by tablename
  `);
  const tableNames = tableResult.rows.map(({ tablename }) => `"${String(tablename).replaceAll('"', '""')}"`);
  if (tableNames.length) {
    await client.query(`truncate table ${tableNames.join(', ')} restart identity cascade`);
  }

  const userIds = new Map();
  const passwordHash = await hashPassword('demo1234');
  for (const [name, email, role, department, store] of users) {
    const result = await client.query(
      `insert into users (name, email, password_hash, role, department, store)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [name, email, passwordHash, role, department, store]
    );
    userIds.set(email, result.rows[0].id);
  }

  const ownerId = userIds.get('owner@statestreet.local');
  const financeId = userIds.get('finance@statestreet.local');
  const commercialId = userIds.get('commercial@statestreet.local');
  const marketingId = userIds.get('marketing@statestreet.local');
  const operationsId = userIds.get('operations@statestreet.local');
  const inventoryId = userIds.get('inventory@statestreet.local');
  const brandManagerId = userIds.get('brand@statestreet.local');

  await client.query(
    `insert into organization_settings
      (id, company_name, tagline, currency, week_start, minimum_password_length, session_days, updated_by_user_id)
     values (1, 'StateStreet', 'Retail Group', 'GHS', 'monday', 8, 7, $1)`,
    [ownerId]
  );

  const storeIds = new Map();
  for (const [code, name, type] of stores) {
    const result = await client.query(
      'insert into stores (code, name, type) values ($1, $2, $3) returning id',
      [code, name, type]
    );
    storeIds.set(code, Number(result.rows[0].id));
  }

  const brandIds = new Map();
  for (const [code, name] of brands) {
    const result = await client.query('insert into brands (code, name) values ($1, $2) returning id', [code, name]);
    brandIds.set(code, Number(result.rows[0].id));
  }

  const categoryIds = new Map();
  for (const [sortOrder, [code, name]] of categories.entries()) {
    const result = await client.query(
      'insert into categories (code, name, sort_order) values ($1, $2, $3) returning id',
      [code, name, sortOrder]
    );
    categoryIds.set(code, Number(result.rows[0].id));
  }

  for (const [brandCode, codes] of Object.entries(brandStoreCodes)) {
    for (const storeCode of codes) {
      await client.query('insert into brand_stores (brand_id, store_id) values ($1, $2)', [
        brandIds.get(brandCode),
        storeIds.get(storeCode),
      ]);
    }
  }
  for (const [brandCode, codes] of Object.entries(brandCategoryCodes)) {
    for (const categoryCode of codes) {
      await client.query('insert into brand_categories (brand_id, category_id) values ($1, $2)', [
        brandIds.get(brandCode),
        categoryIds.get(categoryCode),
      ]);
    }
  }

  const paymentMethodIds = new Map();
  for (const [sortOrder, [code, name]] of paymentMethods.entries()) {
    const result = await client.query(
      'insert into payment_methods (code, name, sort_order) values ($1, $2, $3) returning id',
      [code, name, sortOrder]
    );
    paymentMethodIds.set(code, Number(result.rows[0].id));
  }

  const expenseCategoryIds = new Map();
  for (const [sortOrder, [code, name, group]] of expenseCategories.entries()) {
    const result = await client.query(
      'insert into expense_categories (code, name, "group", sort_order) values ($1, $2, $3, $4) returning id',
      [code, name, group, sortOrder]
    );
    expenseCategoryIds.set(code, Number(result.rows[0].id));
  }

  const supplierIds = new Map();
  for (const [code, name] of [
    ['atlas-textiles', 'Atlas Textiles'],
    ['carbon-footwear', 'Carbon Footwear Works'],
    ['milano-trading', 'Milano Trading'],
    ['accra-packaging', 'Accra Packaging Co.'],
    ['global-fragrance', 'Global Fragrance House'],
  ]) {
    const result = await client.query('insert into suppliers (code, name) values ($1, $2) returning id', [code, name]);
    supplierIds.set(code, Number(result.rows[0].id));
  }

  const cashAccountIds = new Map();
  for (const [code, name, type] of [
    ['operating-bank', 'Operating Bank Account', 'bank'],
    ['collections-bank', 'Collections Bank Account', 'bank'],
    ['head-office-cash', 'Head Office Cash', 'cash'],
    ['mobile-money', 'Mobile Money Wallet', 'mobile-money'],
  ]) {
    const result = await client.query(
      'insert into cash_accounts (code, name, type) values ($1, $2, $3) returning id',
      [code, name, type]
    );
    cashAccountIds.set(code, Number(result.rows[0].id));
  }

  const categoryLabels = new Map(categories);
  const brandLabels = new Map(brands);
  const brandSkuCodes = new Map(
    brands.map(([code], index) => [code, `B${String(index + 1).padStart(2, '0')}`])
  );
  const categorySkuCodes = new Map(
    categories.map(([code], index) => [code, `C${String(index + 1).padStart(2, '0')}`])
  );
  const productRows = [];
  for (const [brandCode, categoryCodes] of Object.entries(brandCategoryCodes)) {
    for (const categoryCode of categoryCodes) {
      const footwear = ['sneakers', 'oxford-shoes', 'derby-shoes', 'loafers', 'sandals'].includes(categoryCode);
      const variants = footwear ? [['40', 'Black'], ['42', 'Tan']] : [['M', 'Navy'], ['L', 'Stone']];
      for (const [size, color] of variants) {
        const priceBand = footwear ? between(950, 2200) : between(650, 3800);
        const sku = `${brandSkuCodes.get(brandCode)}-${categorySkuCodes.get(categoryCode)}-${size}-${color.slice(0, 2).toUpperCase()}`;
        const result = await client.query(
          `insert into products
            (sku, name, description, brand_id, category_id, size, color, unit_cost, selling_price, created_by_user_id, updated_by_user_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) returning id`,
          [
            sku,
            `${brandLabels.get(brandCode)} ${categoryLabels.get(categoryCode)} ${size}`,
            `Synthetic local demo variant for ${categoryLabels.get(categoryCode)}.`,
            brandIds.get(brandCode),
            categoryIds.get(categoryCode),
            size,
            color,
            roundMoney(priceBand * 0.54),
            priceBand,
            commercialId,
          ]
        );
        productRows.push({
          id: Number(result.rows[0].id),
          brandCode,
          categoryCode,
          unitCost: roundMoney(priceBand * 0.54),
          sellingPrice: priceBand,
        });
      }
    }
  }

  const retailStoreCodes = stores.filter(([, , type]) => type === 'store').map(([code]) => code);
  const storeCategories = new Map();
  for (const storeCode of retailStoreCodes) {
    const mappedBrands = Object.entries(brandStoreCodes)
      .filter(([, storeCodes]) => storeCodes.includes(storeCode))
      .map(([brandCode]) => brandCode);
    storeCategories.set(
      storeCode,
      [...new Set(mappedBrands.flatMap((brandCode) => brandCategoryCodes[brandCode]))]
    );
  }

  const reportSummary = new Map();
  const reportAuditRows = [];
  const monthlyRevenueByStore = new Map(retailStoreCodes.map((code) => [code, 0]));
  for (const [storeIndex, storeCode] of retailStoreCodes.entries()) {
    const availableCategories = storeCategories.get(storeCode);
    const managerId = userIds.get(`${storeCode}.manager@statestreet.local`);
    const storeFactor = 0.78 + storeIndex * 0.075;

    for (let age = 89; age >= 0; age -= 1) {
      const businessDate = daysAgo(age);
      const status = age === 0 ? 'draft' : age === 1 ? 'submitted' : 'approved';
      const selectedCategories = [];
      const lineCount = Math.min(5, availableCategories.length);
      for (let offset = 0; offset < lineCount; offset += 1) {
        selectedCategories.push(availableCategories[(age + storeIndex + offset * 3) % availableCategories.length]);
      }

      const lines = selectedCategories.map((categoryCode, lineIndex) => {
        const premium = ['luxury-suits', 'business-suits', 'watches', 'fragrances'].includes(categoryCode);
        const unitsSold = between(premium ? 1 : 2, premium ? 5 : 11);
        const unitPrice = premium ? between(1800, 4400) : between(480, 1850);
        const grossRevenue = roundMoney(unitsSold * unitPrice * storeFactor * (0.88 + random() * 0.24));
        const discounts = random() < 0.35 ? roundMoney(grossRevenue * (0.02 + random() * 0.04)) : 0;
        const returns = random() < 0.08 ? roundMoney(grossRevenue * 0.03) : 0;
        const creditSales = random() < 0.12 ? roundMoney((grossRevenue - discounts - returns) * 0.08) : 0;
        return {
          categoryCode,
          openingStock: between(45 + lineIndex * 4, 170),
          unitsSold,
          grossRevenue,
          cogs: roundMoney(grossRevenue * (0.5 + random() * 0.1)),
          discounts,
          returns,
          creditSales,
        };
      });

      const totals = lines.reduce(
        (sum, line) => ({
          gross: sum.gross + line.grossRevenue,
          net: sum.net + line.grossRevenue - line.discounts - line.returns,
          credit: sum.credit + line.creditSales,
          units: sum.units + line.unitsSold,
        }),
        { gross: 0, net: 0, credit: 0, units: 0 }
      );
      totals.gross = roundMoney(totals.gross);
      totals.net = roundMoney(totals.net);
      totals.credit = roundMoney(totals.credit);
      const transactions = Math.max(1, Math.round(totals.units / (1.25 + random() * 0.8)));
      const footfall = transactions + between(8, 42);
      const totalCustomers = Math.max(transactions, transactions + between(-2, 4));
      const newCustomers = Math.round(totalCustomers * (0.34 + random() * 0.2));
      const returningCustomers = totalCustomers - newCustomers;
      const submittedAt = status === 'draft' ? null : `${businessDate}T19:00:00.000Z`;
      const approvedAt = status === 'approved' ? `${businessDate}T21:00:00.000Z` : null;

      const reportResult = await client.query(
        `insert into daily_reports
          (store_id, business_date, status, transactions, footfall, total_customers, new_customers,
           returning_customers, notes, created_by_user_id, updated_by_user_id, submitted_by_user_id,
           submitted_at, approved_by_user_id, approved_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13,$14) returning id`,
        [
          storeIds.get(storeCode), businessDate, status, transactions, footfall, totalCustomers,
          newCustomers, returningCustomers, age % 17 === 0 ? 'Strong styling appointments this day.' : null,
          managerId, status === 'draft' ? null : managerId, submittedAt,
          status === 'approved' ? financeId : null, approvedAt,
        ]
      );
      const reportId = Number(reportResult.rows[0].id);
      reportAuditRows.push({
        entityId: reportId,
        action: 'create',
        actorUserId: managerId,
        createdAt: `${businessDate}T18:30:00.000Z`,
      });
      if (status !== 'draft') {
        reportAuditRows.push({
          entityId: reportId,
          action: 'submit',
          actorUserId: managerId,
          createdAt: submittedAt,
        });
      }
      if (status === 'approved') {
        reportAuditRows.push({
          entityId: reportId,
          action: 'approve',
          actorUserId: financeId,
          createdAt: approvedAt,
        });
      }

      for (const line of lines) {
        await client.query(
          `insert into daily_sales_lines
            (daily_report_id, category_id, opening_stock, units_sold, gross_revenue, cogs, discounts, returns, credit_sales)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            reportId, categoryIds.get(line.categoryCode), line.openingStock, line.unitsSold,
            line.grossRevenue, line.cogs, line.discounts, line.returns, line.creditSales,
          ]
        );
      }

      const takings = roundMoney(totals.net - totals.credit);
      const weights = [0.14, 0.02, 0.17, 0.24, 0.2];
      let allocated = 0;
      for (const [index, [methodCode]] of paymentMethods.entries()) {
        const amount = index === paymentMethods.length - 1
          ? roundMoney(takings - allocated)
          : roundMoney(takings * weights[index]);
        allocated = roundMoney(allocated + amount);
        await client.query(
          'insert into daily_payment_lines (daily_report_id, payment_method_id, amount) values ($1, $2, $3)',
          [reportId, paymentMethodIds.get(methodCode), Math.max(0, amount)]
        );
      }

      reportSummary.set(`${storeCode}:${businessDate}`, { reportId, ...totals, transactions, footfall });
      if (businessDate >= monthStart()) {
        monthlyRevenueByStore.set(storeCode, roundMoney(monthlyRevenueByStore.get(storeCode) + totals.net));
      }
    }
  }

  await client.query(
    `insert into audit_events (entity_type, entity_id, action, actor_user_id, created_at)
     select 'daily-report', row."entityId", row.action, row."actorUserId", row."createdAt"
     from jsonb_to_recordset($1::jsonb) as row(
       "entityId" bigint,
       action text,
       "actorUserId" integer,
       "createdAt" timestamptz
     )`,
    [JSON.stringify(reportAuditRows)]
  );

  const productsByCategory = new Map();
  for (const product of productRows) {
    productsByCategory.set(product.categoryCode, [...(productsByCategory.get(product.categoryCode) ?? []), product]);
  }

  for (const product of productRows) {
    await client.query(
      `insert into inventory_movements
        (business_date, product_id, store_id, movement_type, quantity, unit_cost, source_type, created_by_user_id)
       values ($1,$2,$3,'opening-balance',$4,$5,'local-seed',$6)`,
      [daysAgo(120), product.id, storeIds.get('warehouse'), between(42, 96), product.unitCost, inventoryId]
    );
    for (const storeCode of brandStoreCodes[product.brandCode]) {
      const openingQuantity = between(55, 130);
      await client.query(
        `insert into inventory_movements
          (business_date, product_id, store_id, movement_type, quantity, unit_cost, source_type, created_by_user_id)
         values ($1,$2,$3,'opening-balance',$4,$5,'local-seed',$6)`,
        [daysAgo(120), product.id, storeIds.get(storeCode), openingQuantity, product.unitCost, inventoryId]
      );
      for (const movementAge of [75, 42, 18]) {
        await client.query(
          `insert into inventory_movements
            (business_date, product_id, store_id, movement_type, quantity, unit_cost, source_type, created_by_user_id)
           values ($1,$2,$3,'sale',$4,$5,'local-seed',$6)`,
          [daysAgo(movementAge + between(-3, 3)), product.id, storeIds.get(storeCode), -between(2, 8), product.unitCost, inventoryId]
        );
      }
    }
  }

  for (let index = 0; index < 8; index += 1) {
    const receiptDate = daysAgo(70 - index * 8);
    const receiptResult = await client.query(
      `insert into goods_receipts
        (business_date, po_number, supplier_id, receiving_store_id, status, notes, created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,'received',$5,$6,$6) returning id`,
      [
        receiptDate, `PO-LOCAL-${String(index + 1).padStart(3, '0')}`,
        choice([...supplierIds.values()]), storeIds.get('warehouse'),
        index === 3 ? 'One carton arrived with minor packaging damage.' : null, inventoryId,
      ]
    );
    const receiptId = Number(receiptResult.rows[0].id);
    for (const product of productRows.slice(index * 3, index * 3 + 3)) {
      const quantity = between(12, 34);
      const lineResult = await client.query(
        `insert into goods_receipt_lines
          (goods_receipt_id, product_id, quantity, unit_cost, condition, discrepancy)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [receiptId, product.id, quantity, product.unitCost, index === 3 ? 'partial' : 'good', index === 3 ? 'Packaging only' : null]
      );
      await client.query(
        `insert into inventory_movements
          (business_date, product_id, store_id, movement_type, quantity, unit_cost, source_type, source_id, source_line_id, created_by_user_id)
         values ($1,$2,$3,'receipt',$4,$5,'goods-receipt',$6,$7,$8)`,
        [receiptDate, product.id, storeIds.get('warehouse'), quantity, product.unitCost, receiptId, lineResult.rows[0].id, inventoryId]
      );
    }
  }

  for (let index = 0; index < 10; index += 1) {
    const product = productRows[(index * 7) % productRows.length];
    const destination = choice(brandStoreCodes[product.brandCode]);
    const transferDate = daysAgo(55 - index * 4);
    const transferResult = await client.query(
      `insert into stock_transfers
        (business_date, from_store_id, to_store_id, status, reason, requested_by_user_id,
         authorized_by_user_id, authorized_at, received_by_user_id, received_at, notes)
       values ($1,$2,$3,'received','replenishment',$4,$5,$6,$7,$6,$8) returning id`,
      [
        transferDate, storeIds.get('warehouse'), storeIds.get(destination), inventoryId,
        operationsId, `${transferDate}T10:00:00.000Z`, userIds.get(`${destination}.manager@statestreet.local`),
        index === 6 ? 'Priority size run for customer demand.' : null,
      ]
    );
    const transferId = Number(transferResult.rows[0].id);
    const quantity = between(6, 16);
    const lineResult = await client.query(
      `insert into stock_transfer_lines (stock_transfer_id, product_id, quantity, unit_cost)
       values ($1,$2,$3,$4) returning id`,
      [transferId, product.id, quantity, product.unitCost]
    );
    for (const [storeCode, movementType, signedQuantity] of [
      ['warehouse', 'transfer-out', -quantity],
      [destination, 'transfer-in', quantity],
    ]) {
      await client.query(
        `insert into inventory_movements
          (business_date, product_id, store_id, movement_type, quantity, unit_cost, source_type, source_id, source_line_id, created_by_user_id)
         values ($1,$2,$3,$4,$5,$6,'stock-transfer',$7,$8,$9)`,
        [transferDate, product.id, storeIds.get(storeCode), movementType, signedQuantity, product.unitCost, transferId, lineResult.rows[0].id, inventoryId]
      );
    }
  }

  for (const [storeIndex, storeCode] of retailStoreCodes.entries()) {
    const countResult = await client.query(
      `insert into stock_counts
        (business_date, store_id, status, counted_by_user_id, approved_by_user_id, approved_at, notes)
       values ($1,$2,'approved',$3,$4,$5,$6) returning id`,
      [
        daysAgo(14 + storeIndex), storeIds.get(storeCode), userIds.get(`${storeCode}.manager@statestreet.local`),
        inventoryId, `${daysAgo(13 + storeIndex)}T12:00:00.000Z`, storeIndex === 4 ? 'Two units reconciled.' : null,
      ]
    );
    const countId = Number(countResult.rows[0].id);
    const storeProducts = productRows.filter((product) => brandStoreCodes[product.brandCode].includes(storeCode)).slice(0, 8);
    for (const product of storeProducts) {
      const systemQuantity = between(28, 75);
      const physicalQuantity = Math.max(0, systemQuantity + between(-2, 2));
      await client.query(
        `insert into stock_count_lines
          (stock_count_id, product_id, system_quantity, physical_quantity, unit_cost)
         values ($1,$2,$3,$4,$5)`,
        [countId, product.id, systemQuantity, physicalQuantity, product.unitCost]
      );
    }
  }

  for (let index = 0; index < 12; index += 1) {
    const storeCode = retailStoreCodes[index % retailStoreCodes.length];
    const available = productRows.filter((product) => brandStoreCodes[product.brandCode].includes(storeCode));
    const product = available[index % available.length];
    const requestResult = await client.query(
      `insert into replenishment_requests
        (business_date, store_id, supplier_id, status, requested_by_user_id, reviewed_by_user_id, reviewed_at, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        daysAgo(index + 2), storeIds.get(storeCode), choice([...supplierIds.values()]),
        index < 4 ? 'requested' : index < 9 ? 'approved' : 'ordered',
        userIds.get(`${storeCode}.manager@statestreet.local`), inventoryId,
        index < 4 ? null : `${daysAgo(index + 1)}T11:00:00.000Z`,
        index % 3 === 0 ? 'Prioritize core sizes.' : null,
      ]
    );
    await client.query(
      `insert into replenishment_request_lines
        (replenishment_request_id, product_id, current_stock, reorder_quantity, urgency)
       values ($1,$2,$3,$4,$5)`,
      [requestResult.rows[0].id, product.id, between(0, 8), between(8, 24), index < 3 ? 'critical' : 'high']
    );
  }

  for (let index = 1; index <= 84; index += 1) {
    const customerResult = await client.query(
      `insert into customers
        (name, phone, phone_normalized, occupation, size_preference, created_by_user_id, updated_by_user_id)
       values ($1,$2,$2,$3,$4,$5,$5) returning id`,
      [
        `Demo Customer ${String(index).padStart(3, '0')}`,
        `+23320000${String(index).padStart(3, '0')}`,
        choice(['Professional', 'Entrepreneur', 'Creative', 'Student', 'Hospitality']),
        choice(['M', 'L', '40', '42', '44']),
        userIds.get(`${retailStoreCodes[index % retailStoreCodes.length]}.manager@statestreet.local`),
      ]
    );
    const storeCode = retailStoreCodes[index % retailStoreCodes.length];
    const interestedProducts = productRows.filter((product) => brandStoreCodes[product.brandCode].includes(storeCode));
    await client.query(
      `insert into customer_interactions
        (customer_id, store_id, business_date, lifecycle, source, source_detail, product_id, interest_text, notes, captured_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        customerResult.rows[0].id, storeIds.get(storeCode), daysAgo(index % 58), index % 3 === 0 ? 'buyer' : 'lead',
        choice(['instagram', 'referral', 'walk-in', 'whatsapp', 'billboard']), null,
        choice(interestedProducts).id, null, index % 11 === 0 ? 'Requested follow-up when new sizes arrive.' : null,
        userIds.get(`${storeCode}.manager@statestreet.local`),
      ]
    );
  }

  const currentYear = today.getUTCFullYear();
  for (const [categoryCode, , group] of expenseCategories) {
    const amount = group === 'capital' ? between(90000, 260000) : group === 'below-line' ? between(70000, 180000) : between(60000, 420000);
    await client.query(
      `insert into budgets
        (year, expense_category_id, store_id, amount, notes, created_by_user_id, updated_by_user_id)
       values ($1,$2,null,$3,$4,$5,$5)`,
      [currentYear, expenseCategoryIds.get(categoryCode), amount, 'Synthetic local annual budget.', financeId]
    );
  }

  const expenseCodes = expenseCategories.filter(([, , group]) => group === 'operating').map(([code]) => code);
  for (let index = 0; index < 120; index += 1) {
    const categoryCode = expenseCodes[index % expenseCodes.length];
    const storeCode = index % 5 === 0 ? null : retailStoreCodes[index % retailStoreCodes.length];
    const base = categoryCode === 'payroll' || categoryCode === 'rent' ? between(12000, 42000) : between(350, 9200);
    await client.query(
      `insert into expenses
        (business_date, expense_category_id, store_id, amount, vendor, invoice_reference, payment_method_id,
         description, overspend_reason, created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
      [
        daysAgo(index % 88), expenseCategoryIds.get(categoryCode), storeCode ? storeIds.get(storeCode) : null,
        base, choice(['Local Demo Vendor', 'Accra Services Ltd', 'Internal Allocation', 'City Utilities']),
        `LOCAL-INV-${String(index + 1).padStart(4, '0')}`, paymentMethodIds.get(choice(paymentMethods)[0]),
        `Synthetic ${categoryCode.replaceAll('-', ' ')} expense.`, index % 37 === 0 ? 'Unplanned urgent requirement.' : null,
        financeId,
      ]
    );
  }

  await client.query(
    `insert into capital_snapshots
      (year, capital_employed, total_investment, notes, created_by_user_id, updated_by_user_id)
     values ($1,$2,$3,$4,$5,$5)`,
    [currentYear, 8750000, 6120000, 'Synthetic local capital position.', financeId]
  );

  for (let index = 0; index < 24; index += 1) {
    await client.query(
      `insert into cash_transactions
        (business_date, direction, category, amount, cash_account_id, reference, description,
         created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
      [
        daysAgo(index * 3), index % 3 === 0 ? 'inflow' : 'outflow',
        index % 3 === 0 ? 'other-income' : 'non-operating-payment', between(1200, 18000),
        choice([...cashAccountIds.values()]), `LOCAL-CASH-${String(index + 1).padStart(3, '0')}`,
        'Synthetic non-derived cash activity.', financeId,
      ]
    );
  }

  for (let index = 0; index < 14; index += 1) {
    const originalAmount = between(9000, 82000);
    const openAmount = index % 4 === 0 ? 0 : index % 3 === 0 ? roundMoney(originalAmount * 0.45) : originalAmount;
    const status = openAmount === 0 ? 'settled' : openAmount < originalAmount ? 'partial' : 'open';
    const itemResult = await client.query(
      `insert into working_capital_items
        (type, entity, original_amount, open_amount, due_date, status, notes, created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$8) returning id`,
      [
        index % 2 === 0 ? 'debtor' : 'creditor', `Demo ${index % 2 === 0 ? 'Corporate Customer' : 'Supplier'} ${index + 1}`,
        originalAmount, openAmount, daysAgo(index - 5), status,
        index % 5 === 0 ? 'Follow-up scheduled.' : null, financeId,
      ]
    );
    if (openAmount < originalAmount) {
      await client.query(
        `insert into working_capital_settlements
          (working_capital_item_id, business_date, amount, cash_account_id, reference, created_by_user_id)
         values ($1,$2,$3,$4,$5,$6)`,
        [
          itemResult.rows[0].id, daysAgo(index + 2), roundMoney(originalAmount - openAmount),
          cashAccountIds.get('operating-bank'), `LOCAL-SETTLE-${index + 1}`, financeId,
        ]
      );
    }
  }

  for (const offset of [-1, 0, 1]) {
    await client.query(
      `insert into financial_forecasts
        (period_start, period_end, revenue, gross_profit, net_profit, cash_balance, confidence, assumptions,
         created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
      [
        monthStart(offset), monthEnd(offset), 2480000 + offset * 160000, 1030000 + offset * 70000,
        410000 + offset * 45000, 1320000 + offset * 90000, offset === 1 ? 'medium' : 'high',
        'Based on approved trading history and the current retail calendar.', financeId,
      ]
    );
  }

  const endOfWeek = (weeksBack) => {
    const value = new Date(today);
    const daysUntilSunday = (7 - value.getUTCDay()) % 7;
    value.setUTCDate(value.getUTCDate() + daysUntilSunday - weeksBack * 7);
    return value.toISOString().slice(0, 10);
  };
  const startOfWeek = (weekEnd) => {
    const value = new Date(`${weekEnd}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() - 6);
    return value.toISOString().slice(0, 10);
  };

  for (const storeCode of retailStoreCodes) {
    for (let week = 0; week < 12; week += 1) {
      const weekEnd = endOfWeek(week);
      await client.query(
        `insert into performance_targets
          (metric, scope_type, store_id, period_type, period_start, period_end, value, unit,
           created_by_user_id, updated_by_user_id)
         values ('net-revenue','store',$1,'week',$2,$3,$4,'money',$5,$5)`,
        [storeIds.get(storeCode), startOfWeek(weekEnd), weekEnd, between(145000, 285000), commercialId]
      );
    }
  }
  for (const [metric, value, unit] of [
    ['net-revenue', 2350000, 'money'],
    ['gross-profit', 1010000, 'money'],
    ['operating-profit', 385000, 'money'],
    ['gross-margin', 42, 'percent'],
  ]) {
    await client.query(
      `insert into performance_targets
        (metric, scope_type, period_type, period_start, period_end, value, unit, created_by_user_id, updated_by_user_id)
       values ($1,'group','month',$2,$3,$4,$5,$6,$6)`,
      [metric, monthStart(), monthEnd(), value, unit, commercialId]
    );
  }

  for (const storeCode of retailStoreCodes) {
    for (let week = 1; week <= 5; week += 1) {
      const weekEnd = endOfWeek(week);
      const reviewResult = await client.query(
        `insert into weekly_reviews
          (store_id, week_end, status, summary, risks, opportunities, marketing_amplify_category_id,
           different_this_week, first_three_actions, submitted_by_user_id, approved_by_user_id, approved_at)
         values ($1,$2,'approved',$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [
          storeIds.get(storeCode), weekEnd, 'The team converted more styling conversations into complete looks.',
          week % 2 === 0 ? 'Core sizes are becoming shallow in two lines.' : 'No material operational risk.',
          'Build appointments around the strongest category and follow up with recent leads.',
          categoryIds.get(storeCategories.get(storeCode)[week % storeCategories.get(storeCode).length]),
          'Run two focused clienteling blocks and improve complete-look recommendations.',
          'Replenish core sizes; call top clients; brief advisors on the priority category.',
          userIds.get(`${storeCode}.manager@statestreet.local`), commercialId, `${weekEnd}T18:00:00.000Z`,
        ]
      );
      const reviewId = Number(reviewResult.rows[0].id);
      for (const categoryCode of storeCategories.get(storeCode).slice(0, 4)) {
        await client.query(
          `insert into weekly_review_category_notes
            (weekly_review_id, category_id, performance_comment, overstocked, slow_moving,
             weeks_without_movement, value_at_risk, corrective_action, manager_comment)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            reviewId, categoryIds.get(categoryCode),
            random() > 0.35 ? 'Healthy customer interest and good size coverage.' : 'Demand needs a sharper selling story.',
            random() < 0.1, random() < 0.18, between(0, 3), random() < 0.2 ? between(6000, 24000) : 0,
            'Review placement, client list, and replenishment before Friday.', 'Discussed with the store team.',
          ]
        );
      }
      await client.query(
        `insert into weekly_review_actions
          (weekly_review_id, category_id, action, owner_name, target_units, target_revenue, due_date, status, manager_comment)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          reviewId, categoryIds.get(storeCategories.get(storeCode)[0]), 'Run a focused clienteling follow-up.',
          `${stores.find(([code]) => code === storeCode)[1]} Manager`, between(8, 18), between(12000, 42000),
          endOfWeek(Math.max(0, week - 1)), week === 1 ? 'in-progress' : 'completed', 'Priority action from the weekly review.',
        ]
      );
    }
  }

  const campaignIds = [];
  const campaignSeed = [
    ['Father’s Day Edit', 'boulevard-men', 'instagram', 'active'],
    ['Bridal Season', 'boulevard-women', 'instagram', 'active'],
    ['Sneaker Drop', 'carbon-shoes', 'tiktok', 'completed'],
    ['Fragrance Wardrobe', 'dangelo', 'google', 'active'],
    ['Weekend Layers', 'woodpeckers', 'instagram', 'completed'],
    ['Executive Refresh', 'boulevard-men', 'whatsapp', 'planned'],
  ];
  for (const [index, [name, brandCode, platform, status]] of campaignSeed.entries()) {
    const result = await client.query(
      `insert into marketing_campaign_reports
        (business_date, name, brand_id, platform, reach, engagement, store_visits, revenue_influenced,
         spend, status, created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) returning id`,
      [
        daysAgo(index * 8 + 2), name, brandIds.get(brandCode), platform, between(120000, 520000),
        between(12000, 68000), between(90, 430), between(130000, 560000), between(28000, 95000),
        status, marketingId,
      ]
    );
    campaignIds.push(Number(result.rows[0].id));
  }

  const leadChannels = ['instagram', 'whatsapp', 'walk-in', 'referral', 'website', 'corporate'];
  for (let week = 0; week < 12; week += 1) {
    for (const [channelIndex, channel] of leadChannels.entries()) {
      const leadCount = between(42, 160);
      const qualifiedCount = Math.round(leadCount * (0.42 + random() * 0.25));
      const convertedCount = Math.round(qualifiedCount * (0.28 + random() * 0.32));
      await client.query(
        `insert into lead_metrics
          (business_date, channel, campaign_report_id, lead_count, qualified_count, converted_count,
           average_value, notes, created_by_user_id, updated_by_user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
        [
          daysAgo(week * 7), channel, campaignIds[(week + channelIndex) % campaignIds.length], leadCount,
          qualifiedCount, convertedCount, between(800, 2600), null, marketingId,
        ]
      );
    }
  }

  for (let week = 0; week < 12; week += 1) {
    for (const [index, platform] of ['instagram', 'tiktok', 'facebook', 'youtube'].entries()) {
      await client.query(
        `insert into social_metrics
          (business_date, platform, followers, posts, reels, stories, reach, impressions, engagement,
           clicks, website_visits, created_by_user_id, updated_by_user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
        [
          daysAgo(week * 7), platform, 18000 + index * 7400 + week * 310, between(3, 9), between(2, 7),
          between(8, 24), between(45000, 230000), between(70000, 360000), between(6000, 38000),
          between(900, 8200), between(500, 4100), marketingId,
        ]
      );
    }
  }

  for (let index = 0; index < 28; index += 1) {
    const contacted = between(35, 140);
    const responses = Math.round(contacted * (0.3 + random() * 0.35));
    await client.query(
      `insert into clienteling_activities
        (business_date, type, store_id, contacted, responses, appointments, estimated_revenue, notes,
         created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
      [
        daysAgo(index * 3), choice(['whatsapp', 'phone', 'vip-preview', 'appointment-follow-up']),
        storeIds.get(retailStoreCodes[index % retailStoreCodes.length]), contacted, responses,
        Math.round(responses * (0.18 + random() * 0.3)), between(18000, 98000),
        index % 7 === 0 ? 'Strong response from recent buyers.' : null, marketingId,
      ]
    );
  }

  for (let index = 0; index < 72; index += 1) {
    const score = between(4, 10);
    await client.query(
      `insert into customer_feedback
        (business_date, source, type, category, nps_score, recommendation, frequency, detail,
         store_id, brand_id, contact_consent, captured_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11)`,
      [
        daysAgo(index % 80), choice(['survey', 'in-store', 'social', 'phone']),
        score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor',
        choice(['service', 'product', 'experience', 'availability']), score,
        score >= 9 ? 'yes' : score >= 7 ? 'likely' : 'no', choice(['once', 'occasional', 'recurring']),
        score >= 8 ? 'Helpful styling and a polished store experience.' : 'Wanted better availability in a core size.',
        storeIds.get(retailStoreCodes[index % retailStoreCodes.length]),
        brandIds.get(Object.keys(brandStoreCodes).find((brandCode) => brandStoreCodes[brandCode].includes(retailStoreCodes[index % retailStoreCodes.length]))),
        marketingId,
      ]
    );
  }

  for (const [storeIndex, storeCode] of retailStoreCodes.entries()) {
    for (let week = 0; week < 10; week += 1) {
      const scoreBase = 76 + ((storeIndex * 3 + week) % 17);
      await client.query(
        `insert into store_standard_reviews
          (business_date, store_id, operations_score, vm_score, readiness_score, customer_experience_score,
           cleanliness_score, safety_score, issues, reviewed_by_user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          daysAgo(week * 7 + storeIndex), storeIds.get(storeCode), scoreBase, Math.min(100, scoreBase + between(-4, 5)),
          Math.min(100, scoreBase + between(-5, 6)), Math.min(100, scoreBase + between(-3, 7)),
          Math.min(100, scoreBase + between(-2, 8)), Math.min(100, scoreBase + between(0, 9)),
          week % 4 === 0 ? 'Refresh one display zone and close a minor maintenance item.' : null, operationsId,
        ]
      );
      await client.query(
        `insert into visual_merchandising_reviews
          (business_date, store_id, window_display_score, mannequin_score, product_presentation_score,
           size_arrangement_score, improvements, reviewed_by_user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          daysAgo(week * 7 + storeIndex), storeIds.get(storeCode), scoreBase + between(-6, 5),
          scoreBase + between(-5, 6), scoreBase + between(-4, 7), scoreBase + between(-3, 8),
          week % 3 === 0 ? 'Tighten size sequencing and complete-look storytelling.' : null, operationsId,
        ]
      );
      await client.query(
        `insert into sop_reviews
          (business_date, store_id, area, compliance_score, deviations, corrective_action, reviewed_by_user_id)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          daysAgo(week * 7 + storeIndex), storeIds.get(storeCode), choice(['opening', 'cash-handling', 'stock', 'customer-service']),
          Math.min(100, scoreBase + between(-4, 8)), week % 5 === 0 ? 'One checklist was completed late.' : null,
          week % 5 === 0 ? 'Manager to review closing checklist daily.' : null, operationsId,
        ]
      );
      const staffTotal = between(6, 13);
      await client.query(
        `insert into people_snapshots
          (business_date, store_id, staff_total, staff_present, punctuality_score, training_completion_score,
           absence_reason, notes, recorded_by_user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          daysAgo(week * 7 + storeIndex), storeIds.get(storeCode), staffTotal,
          staffTotal - (random() < 0.2 ? 1 : 0), between(82, 100), between(70, 100),
          random() < 0.2 ? 'Approved leave' : null, null, operationsId,
        ]
      );
    }
  }

  for (let index = 0; index < 16; index += 1) {
    const storeCode = retailStoreCodes[index % retailStoreCodes.length];
    await client.query(
      `insert into maintenance_requests
        (business_date, store_id, category, priority, description, assigned_to_name, estimated_cost,
         due_date, status, resolved_at, reported_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
      [
        daysAgo(index * 4), storeIds.get(storeCode), choice(['electrical', 'plumbing', 'fixtures', 'it', 'hvac']),
        index < 2 ? 'high' : choice(['low', 'medium']),
        choice(['POS terminal intermittently disconnects.', 'Display light requires replacement.', 'Back-store fixture needs repair.', 'Air conditioner requires servicing.']),
        choice(['Facilities Partner', 'IT Vendor', 'Store Team']), between(250, 6800), daysAgo(index * 4 - 7),
        index % 3 === 0 ? 'completed' : index % 4 === 0 ? 'in-progress' : 'open',
        index % 3 === 0 ? `${daysAgo(index * 4 - 2)}T15:00:00.000Z` : null, operationsId,
      ]
    );
  }

  for (let index = 0; index < 9; index += 1) {
    await client.query(
      `insert into incidents
        (occurred_at, store_id, type, severity, description, immediate_action, follow_up_required,
         status, resolved_at, reported_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
      [
        `${daysAgo(index * 8 + 3)}T${String(10 + (index % 8)).padStart(2, '0')}:30:00.000Z`,
        storeIds.get(retailStoreCodes[index % retailStoreCodes.length]), choice(['safety', 'security', 'operational', 'customer']),
        index === 0 ? 'high' : choice(['low', 'medium']),
        choice(['Brief POS interruption.', 'Customer slip with no injury.', 'Stock discrepancy isolated during handover.', 'Alarm triggered after closing.']),
        'Manager followed the incident checklist and notified Operations.', index < 3,
        index < 2 ? 'investigating' : 'resolved', index < 2 ? null : `${daysAgo(index * 8 + 2)}T12:00:00.000Z`, operationsId,
      ]
    );
  }

  for (const [brandIndex, [brandCode]] of brands.entries()) {
    for (let month = 0; month < 4; month += 1) {
      const base = 72 + brandIndex * 3 + month * 2;
      await client.query(
        `insert into brand_health_assessments
          (business_date, brand_id, type, awareness_score, consideration_score, preference_score,
           satisfaction_score, loyalty_score, advocacy_score, momentum_score, created_by_user_id, updated_by_user_id)
         values ($1,$2,'portfolio',$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
        [
          monthEnd(-month), brandIds.get(brandCode), Math.min(100, base + 4), Math.min(100, base + 2),
          Math.min(100, base + 1), Math.min(100, base + 5), Math.min(100, base),
          Math.min(100, base - 2), Math.min(100, base + 3), brandManagerId,
        ]
      );
      const positive = between(180, 460);
      const neutral = between(60, 170);
      const negative = between(18, 75);
      await client.query(
        `insert into brand_sentiment_snapshots
          (business_date, brand_id, source, positive_mentions, neutral_mentions, negative_mentions,
           positive_theme, negative_theme, created_by_user_id, updated_by_user_id)
         values ($1,$2,'combined',$3,$4,$5,$6,$7,$8,$8)`,
        [
          monthEnd(-month), brandIds.get(brandCode), positive, neutral, negative,
          'Quality, styling advice, and store experience.', 'Availability in selected sizes.', brandManagerId,
        ]
      );
      await client.query(
        `insert into digital_reputation_snapshots
          (business_date, brand_id, google_rating, google_review_count, instagram_sentiment,
           instagram_followers, response_rate, average_response_hours, nps, trustpilot_rating,
           new_reviews, negative_reviews, created_by_user_id, updated_by_user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
        [
          monthEnd(-month), brandIds.get(brandCode), 4.2 + random() * 0.5, 120 + brandIndex * 35 + month * 12,
          between(72, 92), 8500 + brandIndex * 3200 + month * 280, between(78, 98), between(3, 18),
          between(38, 72), 4 + random() * 0.7, between(8, 32), between(0, 5), brandManagerId,
        ]
      );
    }
  }

  for (let index = 0; index < 10; index += 1) {
    await client.query(
      `insert into competitor_activities
        (business_date, competitor, brand_id, share_of_voice, activity_type, description,
         threat_level, recommended_response, created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
      [
        daysAgo(index * 8), `Demo Competitor ${index + 1}`, brandIds.get(brands[index % brands.length][0]),
        between(8, 32), choice(['campaign', 'promotion', 'store-opening', 'product-launch']),
        'Synthetic competitor activity for local dashboard verification.', index < 2 ? 'high' : 'medium',
        'Review positioning and strengthen clienteling around the affected category.', brandManagerId,
      ]
    );
  }

  const actionSeed = [
    ['executive', 'Dzorwulu revenue below weekly target', 'high', storeIds.get('dzorwulu-men'), commercialId, daysAgo(-3)],
    ['inventory', 'Replenish Carbon core sizes', 'critical', storeIds.get('woodpeckers'), inventoryId, daysAgo(-1)],
    ['operations', 'Close outstanding display-light repair', 'medium', storeIds.get('bw-labone'), operationsId, daysAgo(-5)],
    ['marketing', 'Launch clienteling follow-up for suit buyers', 'high', storeIds.get('east-legon-men'), marketingId, daysAgo(-2)],
    ['brand', 'Respond to recurring availability feedback', 'medium', null, brandManagerId, daysAgo(-7)],
    ['finance', 'Review two overdue debtor balances', 'high', null, financeId, daysAgo(-1)],
  ];
  for (const [department, title, priority, storeId, ownerUserId, dueDate] of actionSeed) {
    await client.query(
      `insert into action_items
        (department, store_id, title, detail, priority, owner_user_id, due_date, status,
         created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,'open',$8,$8)`,
      [department, storeId, title, 'Synthetic local decision queue item.', priority, ownerUserId, dueDate, ownerId]
    );
  }

  for (let index = 0; index < 8; index += 1) {
    const product = productRows[index * 5];
    const storeCode = brandStoreCodes[product.brandCode][0];
    await client.query(
      `insert into inventory_dispositions
        (review_date, product_id, store_id, action, justification, status, created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [
        daysAgo(index + 4), product.id, storeIds.get(storeCode), choice(['markdown-20', 'transfer', 'markdown-40']),
        'Movement has slowed relative to the rest of the category.', index < 3 ? 'proposed' : 'approved', inventoryId,
      ]
    );
  }

  await client.query(
    `insert into import_batches
      (type, filename, status, total_rows, imported_rows, error_rows, summary, created_by_user_id,
       started_at, completed_at, undone_at, undone_by_user_id)
     values ('finance','local-demo-finance.xlsx','undone',24,24,0,$1::jsonb,$2,
       now() - interval '2 days',now() - interval '2 days',now() - interval '1 day',$2)`,
    [JSON.stringify({
      filename: 'local-demo-finance.xlsx', uploadedBy: 'Finance Manager',
      expensesAdded: 18, budgetAdded: 6, budgetUpdated: 0, budgetSkipped: 0,
      expenseErrors: 0, budgetErrors: 0, source: 'synthetic-local-seed',
    }), financeId]
  );

  await client.query('commit');
  const counts = await client.query(`
    select
      (select count(*) from daily_reports)::int as daily_reports,
      (select count(*) from daily_sales_lines)::int as sales_lines,
      (select count(*) from products)::int as products,
      (select count(*) from inventory_movements)::int as inventory_movements,
      (select count(*) from expenses)::int as expenses,
      (select count(*) from action_items)::int as action_items
  `);
  console.log(`Seeded ${LOCAL_DATABASE_NAME}:`, counts.rows[0]);
  console.log('Demo password for every local account: demo1234');
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
