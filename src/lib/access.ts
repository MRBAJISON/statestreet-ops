import type { Department, UserRole } from './types';

export const USER_ROLES = [
  'owner',
  'finance',
  'commercial',
  'marketing',
  'operations',
  'inventory',
  'brand',
  'store-manager',
] as const satisfies readonly UserRole[];

export const DEPARTMENTS = [
  'executive',
  'finance',
  'commercial',
  'marketing',
  'operations',
  'inventory',
  'brand',
] as const satisfies readonly Department[];

const ROLE_DEPARTMENTS: Record<UserRole, Department[]> = {
  owner: ['executive', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'],
  finance: ['finance', 'executive', 'commercial', 'marketing', 'operations', 'inventory', 'brand'],
  commercial: ['commercial'],
  marketing: ['marketing', 'brand'],
  operations: ['finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'],
  inventory: ['inventory'],
  brand: ['brand'],
  'store-manager': ['commercial'],
};

const HOME_DEPARTMENT: Record<UserRole, Department> = {
  owner: 'executive',
  finance: 'finance',
  commercial: 'commercial',
  marketing: 'marketing',
  operations: 'operations',
  inventory: 'inventory',
  brand: 'brand',
  'store-manager': 'commercial',
};

const UNIT_COST_READERS = new Set<UserRole>(['owner', 'finance', 'commercial', 'operations', 'inventory']);

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}

export function isDepartment(value: unknown): value is Department {
  return typeof value === 'string' && DEPARTMENTS.includes(value as Department);
}

export function getDepartmentsForRole(role: UserRole): Department[] {
  return [...ROLE_DEPARTMENTS[role]];
}

export function canAccessDepartment(role: UserRole, department: Department): boolean {
  return ROLE_DEPARTMENTS[role].includes(department);
}

export function homeDepartmentForRole(role: UserRole): Department {
  return HOME_DEPARTMENT[role];
}

export function isValidRoleDepartment(role: UserRole, department: Department): boolean {
  return HOME_DEPARTMENT[role] === department;
}

export function canReadUnitCost(role: UserRole): boolean {
  return UNIT_COST_READERS.has(role);
}
