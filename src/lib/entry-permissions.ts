import type { AppUser } from './auth';
import type { UserRole } from './types';

export const LEGACY_FORM_TYPES = {
  finance: new Set(['revenue', 'closing', 'expenses', 'budget', 'capital', 'cashflow', 'debtors', 'forecast', 'import-log']),
  commercial: new Set([
    'store-sales',
    'category-perf',
    'sku-entry',
    'accountability',
    'weekly-review',
    'customer-capture',
    'weekly-target',
    'exec-target',
    'exec-target-annual',
  ]),
  marketing: new Set(['campaign', 'leads', 'social', 'clienteling', 'customer-experience', 'priorities']),
  operations: new Set(['store-audit', 'maintenance', 'vm-check', 'cx-feedback', 'incident', 'sop-check', 'hr']),
  inventory: new Set(['stock-count', 'goods-receipt', 'store-transfer', 'dead-stock', 'replenishment']),
  brand: new Set(['brand-score', 'sentiment', 'competitor', 'digital', 'voice', 'attention']),
} as const;

export type LegacyDepartment = keyof typeof LEGACY_FORM_TYPES;

const STORE_MANAGER_WRITES = new Set([
  'finance/revenue',
  'finance/closing',
  'inventory/store-transfer',
  'commercial/customer-capture',
  'commercial/weekly-review',
]);
const TARGET_WRITES = new Set(['commercial/weekly-target', 'commercial/exec-target', 'commercial/exec-target-annual']);

const READ_DEPARTMENTS: Record<UserRole, ReadonlySet<LegacyDepartment>> = {
  owner: new Set(['finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand']),
  finance: new Set(['finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand']),
  commercial: new Set(['commercial', 'finance']),
  marketing: new Set(['marketing', 'brand', 'commercial']),
  operations: new Set(['finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand']),
  inventory: new Set(['inventory']),
  brand: new Set(['brand']),
  'store-manager': new Set(['finance', 'commercial', 'inventory']),
};

export function isLegacyDepartment(value: string): value is LegacyDepartment {
  return Object.prototype.hasOwnProperty.call(LEGACY_FORM_TYPES, value);
}

export function isKnownLegacyForm(department: string, formType: string): boolean {
  return isLegacyDepartment(department) && LEGACY_FORM_TYPES[department].has(formType as never);
}

export function canReadLegacyDepartment(role: UserRole, department: LegacyDepartment): boolean {
  return READ_DEPARTMENTS[role].has(department);
}

export function canWriteLegacyForm(user: AppUser, department: LegacyDepartment, formType: string): boolean {
  const key = `${department}/${formType}`;
  if (!isKnownLegacyForm(department, formType)) return false;
  if (user.role === 'operations') return true;
  if (user.role === 'store-manager') return STORE_MANAGER_WRITES.has(key) && Boolean(user.store);
  if (TARGET_WRITES.has(key)) return ['owner', 'finance', 'commercial'].includes(user.role);
  if (user.role === 'marketing') return department === 'marketing' || department === 'brand';
  return user.role === department;
}

export function legacyEntryBelongsToStore(
  department: LegacyDepartment,
  formType: string,
  payload: Record<string, unknown>,
  store: string
): boolean {
  if (department === 'inventory' && formType === 'store-transfer') {
    return String(payload.fromStore ?? '') === store;
  }
  return String(payload.store ?? '') === store;
}

export function canMutateLegacyEntry(
  user: AppUser,
  entry: { department: string; formType: string; payload: Record<string, unknown> },
  action: 'update' | 'delete'
): boolean {
  if (!isLegacyDepartment(entry.department) || !canWriteLegacyForm(user, entry.department, entry.formType)) return false;
  if (user.role !== 'store-manager') return true;
  if (action === 'delete' || !user.store) return false;
  return legacyEntryBelongsToStore(entry.department, entry.formType, entry.payload, user.store);
}
