import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from './lib/session';

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

async function getRoleFromSession(req: NextRequest): Promise<string | null> {
  const session = req.cookies.get('session');
  if (!session) return null;
  const data = await verifySession(session.value); // rejects forged/edited cookies
  if (!data) return null;
  return data.role ?? null; // role is embedded in the signed token
}

function homeFor(role: string, allowed: string[]): string {
  if (role === 'owner') return 'executive';
  return allowed[0] === 'brand' ? 'brand-health' : allowed[0];
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = await getRoleFromSession(req);

  // Not signed in -> bounce to login for any protected route.
  if (!role) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // The CEO/owner consumes dashboards only — no data-entry forms.
  if (role === 'owner' && pathname.startsWith('/forms')) {
    return NextResponse.redirect(new URL('/dashboard/executive', req.url));
  }

  const allowed = ROLE_DEPARTMENTS[role] ?? [];

  // Admin area is owner-only.
  if (pathname.startsWith('/dashboard/admin') && role !== 'owner') {
    return NextResponse.redirect(new URL(`/dashboard/${homeFor(role, allowed)}`, req.url));
  }

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
