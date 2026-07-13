const PAYMENT_FIELDS = [
  ['bank-transfer', 'pay_bank_transfer', 'Bank Transfer'],
  ['cheque', 'pay_cheque', 'Cheque'],
  ['cash', 'pay_cash', 'Cash'],
  ['mobile-money', 'pay_mobile_money', 'Mobile Money'],
  ['pos-umb', 'pay_pos_umb', 'POS UMB'],
  ['pos-omnibsic', 'pay_pos_omnibsic', 'POS OmniBSIC'],
];

// Historical organization settings contain two retired store aliases and two
// values that were accidentally saved as category relationships. Normalize the
// aliases for migration input only; the legacy settings row remains unchanged.
const LEGACY_STORE_ALIASES = new Map([
  ['bw-dzorwulu', 'dzorwulu-women'],
  ['bw-labone', 'labone-women'],
]);
const LEGACY_IGNORED_RELATIONSHIP_CODES = new Set(['a', 'd']);

const clean = (value) => String(value ?? '').trim();

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

function validNumber(value) {
  const normalized = clean(value).replace(/[, ]/g, '');
  return !normalized || /^\d+(?:\.\d+)?$/.test(normalized);
}

function integer(value) {
  const parsed = Number(clean(value).replace(/[, ]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function cents(value) {
  const normalized = clean(value).replace(/[, ]/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return BigInt(0);
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0').slice(0, 2));
}

function amount(value) {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const whole = absolute / BigInt(100);
  const fraction = String(absolute % BigInt(100)).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function optionsByCode(options) {
  return new Map((Array.isArray(options) ? options : []).map((option) => [clean(option.value), clean(option.label)]));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildFoundationCatalog(org) {
  const closedStores = new Set(Array.isArray(org?.closedStores) ? org.closedStores.map(clean) : []);
  const stores = [...optionsByCode(org?.stores)].map(([code, name]) => ({ code, name, active: !closedStores.has(code) }));
  const brands = [...optionsByCode(org?.brands)].map(([code, name]) => ({ code, name }));
  const categories = [...optionsByCode(org?.categories)].map(([code, name], sortOrder) => ({ code, name, sort_order: sortOrder }));
  const storeCodes = new Set(stores.map((store) => store.code));
  const brandCodes = new Set(brands.map((brand) => brand.code));
  const categoryCodes = new Set(categories.map((category) => category.code));
  const masterDataBlockers = [
    ...stores.filter((store) => !store.code || !store.name).map((store) => `store:${store.code || '(blank)'}`),
    ...brands.filter((brand) => !brand.code || !brand.name).map((brand) => `brand:${brand.code || '(blank)'}`),
    ...categories.filter((category) => !category.code || !category.name).map((category) => `category:${category.code || '(blank)'}`),
  ];
  const subcategoryOptions = optionsByCode(org?.subCategories);
  const subcategoryParents = new Map();
  for (const [categoryCode, subcategoryCodes] of Object.entries(org?.categorySubcategories ?? {})) {
    for (const subcategoryCode of Array.isArray(subcategoryCodes) ? subcategoryCodes : []) {
      const parents = subcategoryParents.get(clean(subcategoryCode)) ?? [];
      parents.push(clean(categoryCode));
      subcategoryParents.set(clean(subcategoryCode), parents);
    }
  }
  const subcategories = [];
  const subcategoryBlockers = [];
  for (const [code, name] of subcategoryOptions) {
    const parents = unique(subcategoryParents.get(code) ?? []);
    if (parents.length !== 1 || !categoryCodes.has(parents[0])) subcategoryBlockers.push(code);
    else subcategories.push({ code, name, categoryCode: parents[0] });
  }
  const validExpenseGroups = new Set(['operating', 'capital', 'below-line']);
  const invalidExpenseGroups = [];
  const expenseCategories = (Array.isArray(org?.expenseItems) ? org.expenseItems : []).flatMap((item, sortOrder) => {
    const group = clean(item.group);
    if (!validExpenseGroups.has(group)) {
      invalidExpenseGroups.push(clean(item.value) || '(blank)');
      return [];
    }
    const code = clean(item.value);
    const name = clean(item.label);
    if (!code || !name) masterDataBlockers.push(`expense:${code || '(blank)'}`);
    return [{ code, name, group, sort_order: sortOrder }];
  });
  const brandStores = Object.entries(org?.brandStores ?? {}).flatMap(([brandCode, relatedStoreCodes]) =>
    (Array.isArray(relatedStoreCodes) ? relatedStoreCodes : []).flatMap((storeCode) => {
      const rawCode = clean(storeCode);
      if (LEGACY_IGNORED_RELATIONSHIP_CODES.has(rawCode)) return [];
      return [{ brandCode: clean(brandCode), storeCode: LEGACY_STORE_ALIASES.get(rawCode) ?? rawCode }];
    })
  );
  const brandCategories = Object.entries(org?.brandCategories ?? {}).flatMap(([brandCode, categoryCodes]) =>
    (Array.isArray(categoryCodes) ? categoryCodes : []).flatMap((categoryCode) => {
      const rawCode = clean(categoryCode);
      if (LEGACY_IGNORED_RELATIONSHIP_CODES.has(rawCode)) return [];
      return [{ brandCode: clean(brandCode), categoryCode: rawCode }];
    })
  );
  const relationshipBlockers = [
    ...brandStores
      .filter((relation) => !brandCodes.has(relation.brandCode) || !storeCodes.has(relation.storeCode))
      .map((relation) => `${relation.brandCode}->${relation.storeCode}`),
    ...brandCategories
      .filter((relation) => !brandCodes.has(relation.brandCode) || !categoryCodes.has(relation.categoryCode))
      .map((relation) => `${relation.brandCode}->${relation.categoryCode}`),
  ];
  const paymentMethods = PAYMENT_FIELDS.map(([code, , name], sortOrder) => ({
    code,
    name,
    sort_order: sortOrder,
  }));
  return {
    stores,
    brands,
    categories,
    subcategories,
    expenseCategories,
    paymentMethods,
    brandStores,
    brandCategories,
    blockers: {
      masterData: unique(masterDataBlockers).sort(),
      subcategories: subcategoryBlockers.sort(),
      expenseCategories: invalidExpenseGroups.sort(),
      relationships: unique(relationshipBlockers).sort(),
    },
  };
}

export function buildFoundationBackfillPlan(org, entries) {
  const stores = optionsByCode(org?.stores);
  const brands = optionsByCode(org?.brands);
  const categories = optionsByCode(org?.categories);
  const catalog = buildFoundationCatalog(org);
  const unresolvedStores = new Set();
  const unresolvedCategories = new Set();
  const invalidDates = new Set();
  const invalidNumbers = new Set();

  const revenueRows = entries.filter((entry) => entry.department === 'finance' && entry.form_type === 'revenue');
  const closingRows = entries.filter((entry) => entry.department === 'finance' && entry.form_type === 'closing');
  const closingByDay = new Map();
  for (const entry of closingRows) {
    const store = clean(entry.payload?.store);
    const date = clean(entry.payload?.date);
    if (!stores.has(store)) unresolvedStores.add(store || '(blank)');
    if (!validDate(date)) invalidDates.add(date || '(blank)');
    for (const field of ['customers', 'newCustomers', 'returningCustomers', ...PAYMENT_FIELDS.map(([, paymentField]) => paymentField)]) {
      if (!validNumber(entry.payload?.[field])) invalidNumbers.add(`${entry.id}:${field}`);
    }
    if (!stores.has(store) || !validDate(date)) continue;
    const key = `${store}|${date}`;
    const existing = closingByDay.get(key);
    if (!existing || String(existing.created_at) < String(entry.created_at)) closingByDay.set(key, entry);
  }

  const reports = new Map();
  let oldTransactions = 0;
  let oldFootfall = 0;
  let plannedTransactions = 0;
  let plannedFootfall = 0;
  const totals = {
    grossRevenue: BigInt(0),
    cogs: BigInt(0),
    discounts: BigInt(0),
    creditSales: BigInt(0),
    unitsSold: 0,
  };
  for (const entry of revenueRows) {
    const payload = entry.payload ?? {};
    const store = clean(payload.store);
    const date = clean(payload.date);
    const category = clean(payload.category);
    if (!stores.has(store)) unresolvedStores.add(store || '(blank)');
    if (!categories.has(category)) unresolvedCategories.add(category || '(blank)');
    if (!validDate(date)) invalidDates.add(date || '(blank)');
    for (const field of [
      'openingStock',
      'grossRevenue',
      'cogs',
      'discounts',
      'creditSales',
      'transactions',
      'footfall',
      'itemsSold',
    ]) {
      if (!validNumber(payload[field])) invalidNumbers.add(`${entry.id}:${field}`);
    }
    if (!stores.has(store) || !categories.has(category) || !validDate(date)) continue;
    const key = `${store}|${date}`;
    const report = reports.get(key) ?? {
      store,
      date,
      transactions: 0,
      footfall: 0,
      links: [],
      lines: new Map(),
    };
    const transactions = integer(payload.transactions);
    const footfall = integer(payload.footfall);
    oldTransactions += transactions;
    oldFootfall += footfall;
    report.transactions = Math.max(report.transactions, transactions);
    report.footfall = Math.max(report.footfall, footfall);
    report.links.push(entry.id);
    const line = report.lines.get(category) ?? {
      category,
      openingStock: 0,
      unitsSold: 0,
      grossRevenue: BigInt(0),
      cogs: BigInt(0),
      discounts: BigInt(0),
      creditSales: BigInt(0),
    };
    line.openingStock += integer(payload.openingStock);
    line.unitsSold += integer(payload.itemsSold);
    line.grossRevenue += cents(payload.grossRevenue);
    line.cogs += cents(payload.cogs);
    line.discounts += cents(payload.discounts);
    line.creditSales += cents(payload.creditSales);
    totals.grossRevenue += cents(payload.grossRevenue);
    totals.cogs += cents(payload.cogs);
    totals.discounts += cents(payload.discounts);
    totals.creditSales += cents(payload.creditSales);
    totals.unitsSold += integer(payload.itemsSold);
    report.lines.set(category, line);
    reports.set(key, report);
  }

  let salesLineCount = 0;
  let paymentLineCount = 0;
  let legacyLinkCount = 0;
  for (const [key, report] of reports) {
    plannedTransactions += report.transactions;
    plannedFootfall += report.footfall;
    salesLineCount += report.lines.size;
    const closing = closingByDay.get(key);
    if (closing) {
      report.links.push(closing.id);
      for (const [, field] of PAYMENT_FIELDS) {
        if (cents(closing.payload?.[field]) > BigInt(0)) paymentLineCount += 1;
      }
    }
    legacyLinkCount += report.links.length;
  }

  const productRows = entries.filter((entry) => clean(entry.payload?.sku));
  const products = new Map();
  for (const entry of productRows) {
    const payload = entry.payload ?? {};
    const sku = clean(payload.sku).toUpperCase();
    const candidate = products.get(sku) ?? { sku, names: [], brands: [], categories: [] };
    candidate.names.push(clean(payload.name ?? payload.description));
    candidate.brands.push(clean(payload.brand));
    candidate.categories.push(clean(payload.category));
    products.set(sku, candidate);
  }
  let classifiedProducts = 0;
  let unclassifiedProducts = 0;
  let conflictingProducts = 0;
  for (const candidate of products.values()) {
    const productBrands = unique(candidate.brands);
    const productCategories = unique(candidate.categories);
    if (productBrands.length > 1 || productCategories.length > 1) conflictingProducts += 1;
    else if (brands.has(productBrands[0]) && categories.has(productCategories[0]) && unique(candidate.names).length) {
      classifiedProducts += 1;
    } else unclassifiedProducts += 1;
  }

  const closingWithoutSales = [...closingByDay.keys()].filter((key) => !reports.has(key)).length;
  return {
    masters: {
      stores: catalog.stores.length,
      brands: catalog.brands.length,
      categories: catalog.categories.length,
      subcategories: catalog.subcategories.length,
      expenseCategories: catalog.expenseCategories.length,
      paymentMethods: catalog.paymentMethods.length,
    },
    dailyReports: {
      sourceRevenueRows: revenueRows.length,
      sourceClosingRows: closingRows.length,
      reports: reports.size,
      salesLines: salesLineCount,
      paymentLines: paymentLineCount,
      legacyLinks: legacyLinkCount,
      closingWithoutSales,
    },
    products: {
      candidates: products.size,
      classified: classifiedProducts,
      unclassified: unclassifiedProducts,
      conflicting: conflictingProducts,
    },
    parity: {
      grossRevenue: amount(totals.grossRevenue),
      cogs: amount(totals.cogs),
      discounts: amount(totals.discounts),
      creditSales: amount(totals.creditSales),
      unitsSold: totals.unitsSold,
      transactionsBefore: oldTransactions,
      transactionsAfterHeaderDeduplication: plannedTransactions,
      footfallBefore: oldFootfall,
      footfallAfterHeaderDeduplication: plannedFootfall,
    },
    blockers: {
      stores: [...unresolvedStores].sort(),
      categories: [...unresolvedCategories].sort(),
      dates: [...invalidDates].sort(),
      numbers: [...invalidNumbers].sort(),
      masterData: catalog.blockers.masterData,
      subcategories: catalog.blockers.subcategories,
      expenseCategories: catalog.blockers.expenseCategories,
      relationships: catalog.blockers.relationships,
    },
  };
}
