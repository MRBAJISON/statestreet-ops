import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { mutableWorkflowSchema } from '@/lib/contracts/decisions';
import { isWorkflowName } from '@/lib/contracts/workflows';
import { databaseErrorCode, HttpError } from '@/lib/server-errors';
import { executeWorkflow } from '@/lib/workflow-mutations';
import { getRecentWorkflowRecords } from '@/lib/workflow-queries';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workflow: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsedWorkflow = mutableWorkflowSchema.safeParse((await params).workflow);
    if (!parsedWorkflow.success) {
      return NextResponse.json({ error: 'Unknown mutable workflow' }, { status: 404 });
    }
    const records = await getRecentWorkflowRecords(parsedWorkflow.data, session.user);
    return NextResponse.json({ records }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Workflow records could not be loaded' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ workflow: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const name = (await params).workflow;
    if (!isWorkflowName(name)) return NextResponse.json({ error: 'Unknown workflow' }, { status: 404 });
    const input = await req.json().catch(() => null);
    const record = await executeWorkflow(name, session.user, input);
    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    const code = databaseErrorCode(error);
    if (code === '23503') return NextResponse.json({ error: 'A selected reference does not exist' }, { status: 400 });
    if (code === '23505') return NextResponse.json({ error: 'A record already exists for this selection and period' }, { status: 409 });
    if (code === '23514' || code === '22P02' || code === '22003') {
      return NextResponse.json({ error: 'One or more values are outside the allowed range' }, { status: 400 });
    }
    return NextResponse.json({ error: 'The record could not be saved' }, { status: 500 });
  }
}
