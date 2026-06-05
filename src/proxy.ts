import { NextRequest, NextResponse } from 'next/server';

// Role -> departments map (mirrors src/lib/auth.ts; kept inline so proxy stays edge-safe).
const ROLE_DEPARTMENTS: Record<string, string[]> = {
  owner: ['executive', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'],
  finance: ['finance'],
  commercial: ['commercial'],
  marketing: ['marketing', 'brand'],
  operations: ['operations'],
  inventory: ['inventory'],
  brand: ['brand'],
};

// userId -> role (mirrors the demo users in src/lib/auth.ts).
const USER_ROLES: Record<string, string> = {
  '1': 'owner', '2': 'finance', '3': 'commercial', '4': 'marketing',
  '5': 'operations', '6': 'inventory', '7': 'brand',
};

// URL segment -> department key.
const SEGMENT_TO_DEPT: Record<string, string> = {
  executive: 'executive',
  finance: 'finance',
  commercial: 'commercial',
  marketing: 'marketing',
  operations: 'operations',
  inventory: 'inventory',
  'brand-health': 'brand',
};

function getRoleFromSession(req: NextRequest): string | null {
  const session = req.cookies.get('session');
  if (!session) return null;
  try {
    const data = JSON.parse(Buffer.from(session.value, 'base64').toString());
    return USER_ROLES[data.userId] ?? null;
  } catch {
    return null;
  }
}

function homeFor(role: string, allowed: string[]): string {
  if (role === 'owner') return 'executive';
  return allowed[0] === 'brand' ? 'brand-health' : allowed[0];
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = getRoleFromSession(req);

  // Not signed in -> bounce to login for any protected route.
  if (!role) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const allowed = ROLE_DEPARTMENTS[role] ?? [];

  // Enforce department access on /dashboard/<segment> and /forms/<segment>.
  const match = pathname.match(/^\/(dashboard|forms)\/([^/]+)/);
  if (match) {
    const segment = match[2];
    const dept = SEGMENT_TO_DEPT[segment];

    // Executive area is owner-only.
    if (segment === 'executive' && role !== 'owner') {
      return NextResponse.redirect(new URL(`/dashboard/${homeFor(role, allowed)}`, req.url));
    }

    // Known department the role may not access -> send to their own home.
    if (dept && !allowed.includes(dept)) {
      return NextResponse.redirect(new URL(`/dashboard/${homeFor(role, allowed)}`, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/forms/:path*'],
};
