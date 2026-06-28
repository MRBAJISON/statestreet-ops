import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { getOrgRow, getOrgSettings } from '@/lib/org-server';
import { mergeOrg, type OrgSettings } from '@/lib/org';

export const runtime = 'nodejs';

// Public read — branding (name/logo) is needed on the login screen too.
export async function GET() {
  const org = await getOrgSettings();
  return NextResponse.json(org);
}

// Update (partial patch merged over current settings).
// Owner, Commercial and Operations may edit organization settings.
const ORG_EDITORS = ['owner', 'finance', 'commercial', 'operations'];
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !ORG_EDITORS.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body: Partial<OrgSettings>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  // Guard logo size (data URLs can balloon the row).
  if (typeof body.logo === 'string' && body.logo.length > 300_000) {
    return NextResponse.json({ error: 'Logo is too large (max ~200 KB). Use a smaller PNG/SVG.' }, { status: 400 });
  }

  const row = await getOrgRow();
  const current = mergeOrg((row?.payload as Partial<OrgSettings>) ?? null);
  const next = mergeOrg({ ...current, ...body, security: { ...current.security, ...(body.security ?? {}) } });

  if (row) {
    await db.update(entries).set({ payload: next as unknown as Record<string, unknown> }).where(eq(entries.id, row.id));
  } else {
    await db.insert(entries).values({ department: 'admin', formType: 'org-settings', payload: next as unknown as Record<string, unknown> });
  }
  return NextResponse.json({ ok: true, org: next });
}
