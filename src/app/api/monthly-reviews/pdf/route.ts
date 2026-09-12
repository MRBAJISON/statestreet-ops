import { NextRequest, NextResponse } from 'next/server';
import { pdf } from '@react-pdf/renderer';
import { getSession } from '@/lib/auth';
import { monthlyScopeSchema } from '@/lib/contracts/monthly-review';
import { getMonthlyReviewContext } from '@/lib/monthly-reviews';
import { MonthlyPerformanceDocument } from '@/components/pdf/MonthlyPerformanceDocument';
import { HttpError } from '@/lib/server-errors';
import { ZodError } from 'zod';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const scope = monthlyScopeSchema.parse({
      storeId: req.nextUrl.searchParams.has('storeId')
        ? Number(req.nextUrl.searchParams.get('storeId'))
        : undefined,
      groupId: req.nextUrl.searchParams.has('groupId')
        ? Number(req.nextUrl.searchParams.get('groupId'))
        : undefined,
      month: req.nextUrl.searchParams.get('month'),
    });
    const context = await getMonthlyReviewContext(session.user, scope);
    if (!context.ready)
      return NextResponse.json(
        {
          error:
            'Complete source submissions, submit the monthly review and confirm its current narrative before downloading.',
          outstanding: context.missing,
          narrativeCurrent: context.narrativeCurrent,
        },
        { status: 409 }
      );
    const stream = await pdf(
      MonthlyPerformanceDocument({ context, currency: context.currency })
    ).toBuffer();
    const chunks: Buffer[] = [];
    for await (const chunk of stream)
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return new NextResponse(new Uint8Array(Buffer.concat(chunks)), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="monthly-performance-${scope.groupId ? 'cluster' : 'store'}-${scope.groupId ?? scope.storeId}-${scope.month}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : error instanceof ZodError
              ? 'Choose a valid store or cluster and month'
              : 'The performance PDF could not be generated',
      },
      {
        status:
          error instanceof HttpError
            ? error.status
            : error instanceof ZodError
              ? 400
              : 500,
      }
    );
  }
}
