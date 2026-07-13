import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { publicSurveySchema } from '@/lib/contracts/survey';
import { formatContractError } from '@/lib/contracts/shared';
import { db } from '@/lib/db';
import { brands, brandStores, stores } from '@/lib/db/foundation-schema';
import { customerFeedback, organizationSettings, surveyRateLimits } from '@/lib/db/operational-schema';
import { customerContactRetentionWindow } from '@/lib/customer-contact-retention';
import { authSecret } from '@/lib/secret';

const MAX_PER_WINDOW = 5;

function surveyFingerprint(ip: string): string {
  return createHmac('sha256', authSecret()).update(`survey:${ip}`).digest('hex');
}

async function rateLimited(ip: string): Promise<boolean> {
  const fingerprint = surveyFingerprint(ip);
  const result = await db.execute(sql`
    with pruned as (
      delete from ${surveyRateLimits}
      where ${surveyRateLimits.updatedAt} < now() - interval '24 hours'
    ), limited as (
      insert into ${surveyRateLimits} (fingerprint, window_started_at, submission_count, updated_at)
      values (${fingerprint}, now(), 1, now())
      on conflict (fingerprint) do update
      set window_started_at = case
            when ${surveyRateLimits.windowStartedAt} <= now() - interval '1 minute' then now()
            else ${surveyRateLimits.windowStartedAt}
          end,
          submission_count = case
            when ${surveyRateLimits.windowStartedAt} <= now() - interval '1 minute' then 1
            else ${surveyRateLimits.submissionCount} + 1
          end,
          updated_at = now()
      returning submission_count
    )
    select submission_count from limited
  `);
  return Number((result.rows[0] as { submission_count?: number | string } | undefined)?.submission_count ?? 0) > MAX_PER_WINDOW;
}

export async function GET() {
  const [organizationRows, storeRows] = await Promise.all([
    db
      .select({ name: organizationSettings.companyName, tagline: organizationSettings.tagline, logo: organizationSettings.logo })
      .from(organizationSettings)
      .where(eq(organizationSettings.id, 1))
      .limit(1),
    db
      .select({ id: stores.id, code: stores.code, name: stores.name })
      .from(stores)
      .where(and(eq(stores.active, true), eq(stores.type, 'store')))
      .orderBy(asc(stores.name)),
  ]);
  return NextResponse.json({
    organization: organizationRows[0] ?? { name: 'StateStreet', tagline: 'Retail Group', logo: '' },
    stores: storeRows,
  }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.company === 'string' && body.company.trim()) {
      return NextResponse.json({ ok: true });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (await rateLimited(ip)) {
      return NextResponse.json({ error: 'Too many submissions. Try again shortly.' }, { status: 429 });
    }

    const parsed = publicSurveySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
    const input = parsed.data;
    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.id, input.storeId), eq(stores.active, true), eq(stores.type, 'store')))
      .limit(1);
    if (!store) return NextResponse.json({ error: 'Store was not found or is unavailable' }, { status: 400 });
    const brandRows = await db
      .select({ brandId: brandStores.brandId })
      .from(brandStores)
      .innerJoin(brands, and(eq(brandStores.brandId, brands.id), eq(brands.active, true)))
      .where(eq(brandStores.storeId, store.id))
      .limit(2);
    const brandId = brandRows.length === 1 ? brandRows[0].brandId : null;

    const retentionUntil = input.contactConsent ? customerContactRetentionWindow().to : null;
    await db.insert(customerFeedback).values({
      businessDate: new Date().toISOString().slice(0, 10),
      source: 'survey',
      type: 'customer-experience',
      category: input.category,
      npsScore: input.npsScore ?? null,
      recommendation: input.recommendation ?? null,
      detail: input.detail ?? '',
      storeId: store.id,
      brandId,
      contactName: input.contactConsent ? input.contactName ?? null : null,
      contactValue: input.contactConsent ? input.contactValue ?? null : null,
      contactConsent: input.contactConsent,
      retentionUntil,
      capturedByUserId: null,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
