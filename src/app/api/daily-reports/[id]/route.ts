import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dailyReportDecisionSchema, saveDailyReportSchema } from '@/lib/contracts/daily-report';
import { formatContractError } from '@/lib/contracts/shared';
import {
  decideDailyReport,
  getDailyReportForMutation,
  replaceDailyReport,
  resolveDailyReportStore,
  validateDailyReportReferences,
} from '@/lib/daily-reports';
import { HttpError } from '@/lib/server-errors';

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const reportId = parseId((await params).id);
    if (!reportId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const parsed = saveDailyReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
    }
    if (!parsed.data.lockVersion) {
      return NextResponse.json({ error: 'lockVersion is required' }, { status: 400 });
    }
    const existing = await getDailyReportForMutation(reportId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const permittedStoreId = await resolveDailyReportStore(session.user, parsed.data.storeId ?? existing.storeId);
    if (permittedStoreId !== existing.storeId) {
      return NextResponse.json({ error: 'A report cannot be moved to another store' }, { status: 400 });
    }
    await validateDailyReportReferences(parsed.data, existing.storeId, {
      categoryIds: existing.categoryIds,
      paymentMethodIds: existing.paymentMethodIds,
    });
    const report = await replaceDailyReport(session.user, reportId, {
      ...parsed.data,
      lockVersion: parsed.data.lockVersion,
    });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const reportId = parseId((await params).id);
    if (!reportId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const body = await req.json().catch(() => null);
    const parsed = dailyReportDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });
    }
    const report = await decideDailyReport(
      session.user,
      reportId,
      parsed.data.action,
      parsed.data.lockVersion,
      parsed.data.reason
    );
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
