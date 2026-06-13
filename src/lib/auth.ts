import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import type { UserRole, Department } from './types';
import { verifySession, signSession } from './session';
import { verifyPassword } from './password';
import { db } from './db';
import { users } from './db/schema';

const ROLE_DEPARTMENTS: Record<UserRole, Department[]> = {
  owner: ['executive', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'],
  finance: ['finance'],
  commercial: ['commercial'],
  marketing: ['marketing', 'brand'],
  operations: ['finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'],
  inventory: ['inventory'],
  brand: ['brand'],
  'store-manager': ['commercial'],
};

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: Department;
  store?: string;
}

// Verify credentials against the database (hashed passwords).
export async function authenticate(email: string, password: string): Promise<AppUser | null> {
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
  if (!u) return null;
  if (!(await verifyPassword(password, u.passwordHash))) return null;
  return { id: String(u.id), name: u.name, email: u.email, role: u.role as UserRole, department: u.department as Department, store: u.store ?? '' };
}

// Read the signed session cookie (no DB hit — identity is in the signed token).
export async function getSession(): Promise<{ user: AppUser; departments: Department[] } | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  if (!session) return null;
  const data = await verifySession(session.value);
  if (!data) return null;
  const role = data.role as UserRole;
  return {
    user: { id: data.userId, name: data.name, email: '', role, department: data.department as Department, store: data.store ?? '' },
    departments: ROLE_DEPARTMENTS[role] ?? [],
  };
}

export async function createSessionToken(user: AppUser): Promise<string> {
  return signSession(user);
}

export function getDepartmentsForRole(role: UserRole): Department[] {
  return ROLE_DEPARTMENTS[role] ?? [];
}

export function canAccessDepartment(role: UserRole, dept: Department): boolean {
  return (ROLE_DEPARTMENTS[role] ?? []).includes(dept);
}
