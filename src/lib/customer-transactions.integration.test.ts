import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { testDatabaseUrl } from './test-database';

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('customer credit-sale ledger', () => {
  const client = new Client({ connectionString: databaseUrl });
  let userId: number;
  let storeId: number;
  let categoryOneId: number;
  let categoryTwoId: number;
  let productId: number;
  let paymentMethodId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_DRIVER = 'node-postgres';
    await client.connect();
    await client.query(`
      truncate table
        audit_events, cash_transactions, customer_credit_sale_payments,
        customer_credit_sale_items, customer_credit_sales, payment_methods,
        products, brands, categories, stores, users
      restart identity cascade
    `);
    userId = Number((await client.query(`
      insert into users (name, email, password_hash, role, department, store)
      values ('Credit Test Manager', 'credit-test@example.com', 'not-used', 'store-manager', 'commercial', 'credit-store')
      returning id
    `)).rows[0].id);
    storeId = Number((await client.query(`insert into stores (code, name) values ('credit-store', 'Credit Store') returning id`)).rows[0].id);
    const categories = await client.query(`
      insert into categories (code, name, sort_order)
      values ('credit-shirts', 'Credit Shirts', 1), ('credit-shoes', 'Credit Shoes', 2)
      returning id, code
    `);
    categoryOneId = Number(categories.rows.find((row) => row.code === 'credit-shirts').id);
    categoryTwoId = Number(categories.rows.find((row) => row.code === 'credit-shoes').id);
    const brandId = Number((await client.query(`insert into brands (code, name) values ('credit-brand', 'Credit Brand') returning id`)).rows[0].id);
    productId = Number((await client.query(`
      insert into products (sku, name, brand_id, category_id, selling_price)
      values ('CREDIT-TEE', 'Credit Tee', $1, $2, '125.00') returning id
    `, [brandId, categoryOneId])).rows[0].id);
    paymentMethodId = Number((await client.query(`insert into payment_methods (code, name, sort_order) values ('credit-cash', 'Cash', 1) returning id`)).rows[0].id);
  });

  afterAll(async () => { await client.end(); });

  it('records category-linked items, settles payments, and returns a receipt view', async () => {
    const { addCreditSalePayment, createCreditSale, getCreditSalePaymentReceipt, listCustomerTransactions } = await import('./customer-transactions');
    const user = {
      id: String(userId), name: 'Credit Test Manager', email: 'credit-test@example.com',
      role: 'store-manager' as const, department: 'commercial' as const, store: 'credit-store',
    };
    const saleId = await createCreditSale(user, {
      type: 'credit-sale', businessDate: '2026-09-11', storeId,
      customerName: 'Credit Customer', customerPhone: '0240000000',
      items: [
        { categoryId: categoryOneId, productId, productName: 'Credit Tee', quantity: 2 },
        { categoryId: categoryTwoId, productName: 'Uncatalogued shoe', quantity: 1, unitPrice: '150' },
      ],
    });
    let listed = await listCustomerTransactions(user, storeId, '2026-09-11', false, true);
    expect(listed.creditSales[0]).toMatchObject({ id: saleId, totalValue: 400, balanceValue: 400, status: 'open' });
    expect(listed.creditSales[0].items.map((item) => item.categoryId)).toEqual([categoryOneId, categoryTwoId]);

    const firstPayment = await addCreditSalePayment(user, saleId, {
      type: 'credit-sale', action: 'payment', businessDate: '2026-09-12', amount: '100', paymentMethodId,
    });
    expect(firstPayment).toMatchObject({ status: 'partial', openValue: 300 });
    const secondPayment = await addCreditSalePayment(user, saleId, {
      type: 'credit-sale', action: 'payment', businessDate: '2026-09-12', amount: '300', paymentMethodId,
    });
    expect(secondPayment).toMatchObject({ status: 'settled', openValue: 0 });

    listed = await listCustomerTransactions(user, storeId, '2026-09-11', false, true);
    expect(listed.creditSales[0]).toMatchObject({ status: 'settled', balanceValue: 0, paidValue: 400 });
    const receipt = await getCreditSalePaymentReceipt(user, saleId, secondPayment.paymentId);
    expect(receipt).toMatchObject({
      creditNumber: 'CR-credit-store-1', receiptNumber: 'RCP-credit-store-2',
      amount: 300, previousBalance: 300, remainingBalance: 0, paymentMethodName: 'Cash',
    });
  });
});
