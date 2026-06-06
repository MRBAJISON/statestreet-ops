import { cookies } from 'next/headers';
import type { User, UserRole, Department } from './types';
import { verifySession, signSession } from './session';

const USERS: User[] = [
  { id: '1', name: 'CEO / Owner', email: 'owner@statestreet.com', password: 'owner123', role: 'owner', department: 'executive' },
  { id: '2', name: 'Finance Manager', email: 'finance@statestreet.com', password: 'finance123', role: 'finance', department: 'finance' },
  { id: '3', name: 'Commercial Director', email: 'commercial@statestreet.com', password: 'commercial123', role: 'commercial', department: 'commercial' },
  { id: '4', name: 'Marketing Director', email: 'marketing@statestreet.com', password: 'marketing123', role: 'marketing', department: 'marketing' },
  { id: '5', name: 'Operations Manager', email: 'operations@statestreet.com', password: 'operations123', role: 'operations', department: 'operations' },
  { id: '6', name: 'Inventory Manager', email: 'inventory@statestreet.com', password: 'inventory123', role: 'inventory', department: 'inventory' },
  { id: '7', name: 'Brand Manager', email: 'brand@statestreet.com', password: 'brand123', role: 'brand', department: 'brand' },
];

const ROLE_DEPARTMENTS: Record<UserRole, Department[]> = {
  owner: ['executive', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'],
  finance: ['finance'],
  commercial: ['commercial'],
  marketing: ['marketing', 'brand'],
  operations: ['operations'],
  inventory: ['inventory'],
  brand: ['brand'],
};

export function authenticate(email: string, password: string): User | null {
  return USERS.find(u => u.email === email && u.password === password) || null;
}

export async function getSession(): Promise<{ user: User; departments: Department[] } | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  if (!session) return null;

  const data = await verifySession(session.value);
  if (!data) return null;
  const user = USERS.find((u) => u.id === data.userId);
  if (!user) return null;
  return { user, departments: ROLE_DEPARTMENTS[user.role] };
}

export async function createSessionToken(userId: string): Promise<string> {
  return signSession(userId);
}

export function getDepartmentsForRole(role: UserRole): Department[] {
  return ROLE_DEPARTMENTS[role];
}

export function canAccessDepartment(role: UserRole, dept: Department): boolean {
  return ROLE_DEPARTMENTS[role].includes(dept);
}
