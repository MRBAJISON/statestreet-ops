import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { computeMetrics } from '@/lib/metrics';

// Live aggregated metrics for a department, computed from all its entries.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ department: string }> }
) {
  try {
    const { department } = await params;
    const rows = await db.select().from(entries).where(eq(entries.department, department));
    return NextResponse.json(computeMetrics(department, rows));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
