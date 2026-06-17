import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from './lib/session';

// Role -> departments map (mirrors src/lib/auth.ts; kept inline so proxy stays edge-safe).
const ROLE_DEPARTMENTS: Record<string, string[]> = {
  owner: ['executive', 'finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'],
  finance: ['finance', 'executive', 'commercial', 'marketing', 'operations', 'inventory', 'brand'],
  commercial: ['commercial'],
  marketing: ['marketing', 'brand'],
  operations: ['finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'],
  inventory: ['inventory'],
  brand: ['brand'],
  'store-manager': ['commercial'],
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
  'store-manager': 'commercial',
  'weekly-targets': 'commercial',
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

// Where each role lands by default (store managers land on their form, not a dashboard).
function landingPath(role: string, allowed: string[]): string {
  if (role === 'store-manager') return '/forms/store-manager';
  return `/dashboard/${homeFor(role, allowed)}`;
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
    return NextResponse.redirect(new URL(landingPath(role, allowed), req.url));
  }

  // Enforce department access on /dashboard/<segment> and /forms/<segment>.
  const match = pathname.match(/^\/(dashboard|forms)\/([^/]+)/);
  if (match) {
    const area = match[1];
    const segment = match[2];
    const dept = SEGMENT_TO_DEPT[segment];

    // Executive area is for the owner and the finance manager.
    if (segment === 'executive' && role !== 'owner' && role !== 'finance') {
      return NextResponse.redirect(new URL(landingPath(role, allowed), req.url));
    }

    // The store-manager form is store-manager-only; store managers get no other forms.
    if (area === 'forms') {
      if (segment === 'store-manager' && role !== 'store-manager') {
        return NextResponse.redirect(new URL(landingPath(role, allowed), req.url));
      }
      if (role === 'store-manager' && segment !== 'store-manager') {
        return NextResponse.redirect(new URL('/forms/store-manager', req.url));
      }
      // Finance sees all dashboards but only enters the Finance form (forms aren't widened with dashboards).
      if (role === 'finance' && segment !== 'finance') {
        return NextResponse.redirect(new URL('/forms/finance', req.url));
      }
    }

    // Operations manager may use every form (data entry); dashboards stay scoped.
    const opsFormsAllowed = area === 'forms' && role === 'operations';

    // Known department the role may not access -> send to their own home.
    if (dept && !allowed.includes(dept) && !opsFormsAllowed) {
      return NextResponse.redirect(new URL(landingPath(role, allowed), req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/forms/:path*', '/settings/:path*'],
};
