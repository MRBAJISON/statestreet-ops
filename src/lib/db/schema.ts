import { pgTable, serial, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

// A single flexible table holds every form submission across all departments.
// `payload` is the raw form data (jsonb); dashboards aggregate from these rows.
// This lets all 7 departments persist real data immediately without 30+ rigid tables.
export const entries = pgTable(
  'entries',
  {
    id: serial('id').primaryKey(),
    department: text('department').notNull(), // 'finance' | 'commercial' | ...
    formType: text('form_type').notNull(), // e.g. 'revenue', 'expenses', 'store-sales'
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('entries_dept_type_idx').on(t.department, t.formType)]
);

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

// Application users for live (DB-backed, hashed) authentication.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  department: text('department').notNull(),
  store: text('store'), // assigned store for store-manager role (nullable)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DbUser = typeof users.$inferSelect;
