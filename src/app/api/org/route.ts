import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { formatContractError } from '@/lib/contracts/shared';
import { db } from '@/lib/db';
import { getOrgSettings } from '@/lib/org-server';
import { sessionUserId } from '@/lib/server-errors';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

const patchSchema = z
  .object({
    companyName: z.string().trim().min(1).max(120).optional(),
    tagline: z.string().trim().max(160).optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    logo: z.string().max(300_000).optional(),
    weekStart: z.enum(['monday', 'sunday']).optional(),
    security: z
      .object({
        minPasswordLen: z.number().int().min(8).max(128).optional(),
        sessionDays: z.number().int().min(1).max(90).optional(),
      })
      .optional(),
  })
  .strict();

export async function GET() {
  const [org, session] = await Promise.all([getOrgSettings(), getSession()]);
  if (!session) {
    return NextResponse.json({
      companyName: org.companyName,
      tagline: org.tagline,
      currency: org.currency,
      logo: org.logo,
      passwordMinLength: org.security.minPasswordLen,
    });
  }
  return NextResponse.json(org, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (session?.user.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
  if (!Object.keys(parsed.data).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  const input = parsed.data;
  const actorUserId = sessionUserId(session.user.id);
  const result = await db.execute(sql`
    with before_settings as materialized (
      select * from organization_settings where id = 1 for update
    ), updated as (
      update organization_settings settings
      set company_name = coalesce(${input.companyName ?? null}::text, before.company_name),
          tagline = coalesce(${input.tagline ?? null}::text, before.tagline),
          currency = coalesce(${input.currency ?? null}::text, before.currency),
          logo = coalesce(${input.logo ?? null}::text, before.logo),
          week_start = coalesce(${input.weekStart ?? null}::text, before.week_start),
          minimum_password_length = coalesce(${input.security?.minPasswordLen ?? null}::integer, before.minimum_password_length),
          session_days = coalesce(${input.security?.sessionDays ?? null}::integer, before.session_days),
          updated_by_user_id = ${actorUserId},
          updated_at = now()
      from before_settings before
      where settings.id = before.id
      returning settings.*
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after)
      select 'organization-settings', updated.id, 'update', ${actorUserId},
             to_jsonb(before_settings) - 'logo', to_jsonb(updated) - 'logo'
      from updated join before_settings on before_settings.id = updated.id
      returning id
    )
    select id from updated
  `);
  if (!result.rows.length) return NextResponse.json({ error: 'Organization settings are unavailable' }, { status: 409 });
  return NextResponse.json({ ok: true, org: await getOrgSettings() });
}
