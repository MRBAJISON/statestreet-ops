import { pgTable, serial, text, jsonb, timestamp, index, integer, boolean } from 'drizzle-orm/pg-core';

// Transitional legacy submissions. Rebuilt workflows do not write here; these
// rows remain migration evidence until production parity is complete.
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
  active: boolean('active').notNull().default(true),
  sessionVersion: integer('session_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DbUser = typeof users.$inferSelect;

// Activity trail for entries (currently daily-sales/finance-revenue records).
export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    entryId: integer('entry_id').notNull(),
    action: text('action').notNull(), // 'create' | 'update' | 'delete'
    userId: text('user_id'),
    userName: text('user_name'),
    changes: jsonb('changes').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_entry_idx').on(t.entryId)]
);

export type AuditRow = typeof auditLog.$inferSelect;
