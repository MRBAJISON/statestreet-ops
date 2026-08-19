import { and, eq } from 'drizzle-orm';
import type { AppUser } from '../auth';
import { canAccessDepartment } from '../access';
import type { AnalyticsMeta, AnalyticsPreset, AnalyticsQuery, AnalyticsStoreScope, AnalyticsView } from '../contracts/analytics';
import { db } from '../db';
import { stores } from '../db/foundation-schema';
import { organizationSettings } from '../db/operational-schema';
import { HttpError } from '../server-errors';
import { resolveActingStore } from '../store-access';
import type { Department } from '../types';
import { resolveAnalyticsRange } from './range';

export interface AnalyticsRange {
  preset: AnalyticsPreset;
  from: string;
  to: string;
  compareFrom: string;
  compareTo: string;
}

export interface AnalyticsScope extends AnalyticsRange {
  store: AnalyticsStoreScope | null;
}

const VIEW_DEPARTMENTS: Partial<Record<AnalyticsView, Department>> = {
  executive: 'executive',
  finance: 'finance',
  commercial: 'commercial',
  marketing: 'marketing',
  operations: 'operations',
  inventory: 'inventory',
  brand: 'brand',
};

const STORE_ANALYTICS_ROLES = new Set(['owner', 'finance', 'commercial', 'operations', 'store-manager']);

function canAccessView(user: AppUser, view: AnalyticsView): boolean {
  if (user.role === 'store-manager') return view === 'store';
  if (view === 'store') return STORE_ANALYTICS_ROLES.has(user.role);
  const department = VIEW_DEPARTMENTS[view];
  return Boolean(department && canAccessDepartment(user.role, department));
}

async function storeById(id: number): Promise<AnalyticsStoreScope | null> {
  const [store] = await db
    .select({ id: stores.id, code: stores.code, name: stores.name })
    .from(stores)
    .where(and(eq(stores.id, id), eq(stores.type, 'store'), eq(stores.active, true)))
    .limit(1);
  return store ?? null;
}

export async function resolveAnalyticsScope(
  user: AppUser,
  view: AnalyticsView,
  query: AnalyticsQuery
): Promise<AnalyticsScope> {
  if (!canAccessView(user, view)) throw new HttpError(403, 'Forbidden');
  let store: AnalyticsStoreScope | null = null;
  if (user.role === 'store-manager') {
    // Dashboards stay per store by design: each store's records sit on its own
    // dashboard, and only the downloaded report combines the two. So this follows
    // the tab rather than blending them.
    const acting = await resolveActingStore(user);
    store = await storeById(acting.id);
    if (!store) throw new HttpError(409, 'The assigned store is not active');
  } else if (query.storeId) {
    store = await storeById(query.storeId);
    if (!store) throw new HttpError(400, 'Store was not found or is inactive');
  }
  if (view === 'store' && !store) throw new HttpError(400, 'storeId is required for the store view');
  return { ...resolveAnalyticsRange(query), store };
}

export async function analyticsMeta(scope: AnalyticsScope): Promise<AnalyticsMeta> {
  const [settings] = await db
    .select({ currency: organizationSettings.currency })
    .from(organizationSettings)
    .where(eq(organizationSettings.id, 1))
    .limit(1);
  return {
    preset: scope.preset,
    from: scope.from,
    to: scope.to,
    compareFrom: scope.compareFrom,
    compareTo: scope.compareTo,
    currency: settings?.currency ?? 'GHS',
    store: scope.store,
    generatedAt: new Date().toISOString(),
  };
}

export function jsonResult<T>(result: { rows: unknown[] }): T {
  const row = result.rows[0] as { data?: unknown } | undefined;
  if (!row?.data) throw new Error('Reporting query returned no data');
  return row.data as T;
}
