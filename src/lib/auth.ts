import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import type { UserRole, Department } from './types';
import { verifySession, signSession } from './session';
import { verifyPassword } from './password';
import { db } from './db';
import { users } from './db/schema';
import { getDepartmentsForRole, isDepartment, isUserRole, isValidRoleDepartment } from './access';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: Department;
  store?: string;
}

interface LoginUser extends AppUser {
  sessionVersion: number;
}

// Verify credentials against the database (hashed passwords).
export async function authenticate(email: string, password: string): Promise<LoginUser | null> {
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
  if (!u || !u.active || !isUserRole(u.role) || !isDepartment(u.department)) return null;
  if (!isValidRoleDepartment(u.role, u.department)) return null;
  if (!(await verifyPassword(password, u.passwordHash))) return null;
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    store: u.store ?? '',
    sessionVersion: u.sessionVersion,
  };
}

export async function getSessionFromToken(
  token: string | undefined | null
): Promise<{ user: AppUser; departments: Department[] } | null> {
  const data = await verifySession(token);
  if (!data) return null;
  const userId = Number(data.userId);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || !u.active || u.sessionVersion !== data.sessionVersion) return null;
  if (!isUserRole(u.role) || !isDepartment(u.department) || !isValidRoleDepartment(u.role, u.department)) return null;
  return {
    user: {
      id: String(u.id),
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      store: u.store ?? '',
    },
    departments: getDepartmentsForRole(u.role),
  };
}

// Resolve the signed token against the current user row so account changes are immediate.
export async function getSession(): Promise<{ user: AppUser; departments: Department[] } | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  if (!session) return null;
  return getSessionFromToken(session.value);
}

export async function createSessionToken(user: LoginUser): Promise<string> {
  return signSession(user);
}

export { canAccessDepartment, getDepartmentsForRole } from './access';
