import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dateSchema } from '@/lib/contracts/shared';
import { getProductPerformance } from '@/lib/reporting/product-performance';
import { monthlyScopeOptions } from '@/lib/monthly-reviews';
import { resolveActingStore } from '@/lib/store-access';
import { HttpError } from '@/lib/server-errors';
import { ZodError } from 'zod';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const from = dateSchema.parse(req.nextUrl.searchParams.get('from')),
      to = dateSchema.parse(req.nextUrl.searchParams.get('to'));
    if (from > to)
      throw new HttpError(400, 'Start date must not be after end date');
    const options = await monthlyScopeOptions(session.user);
    const raw = req.nextUrl.searchParams.get('storeId');
    const id = raw
      ? Number(raw)
      : session.user.role === 'store-manager'
        ? (await resolveActingStore(session.user)).id
        : null;
    if (raw && (!Number.isSafeInteger(id) || Number(id) <= 0))
      throw new HttpError(400, 'Invalid store');
    if (id && !options.stores.some((s) => s.id === id))
      throw new HttpError(403, 'Store is not available');
    const data = await getProductPerformance(
      id ? [id] : options.stores.map((s) => s.id),
      from,
      to,
      req.nextUrl.searchParams.get('approvedOnly') === 'true'
    );
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : 'Product performance could not be loaded',
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
