import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  actionDecisionSchema,
  dispositionDecisionSchema,
  incidentDecisionSchema,
  maintenanceDecisionSchema,
  mutableWorkflowSchema,
  workingCapitalSettlementSchema,
} from '@/lib/contracts/decisions';
import { formatContractError } from '@/lib/contracts/shared';
import { HttpError } from '@/lib/server-errors';
import {
  decideAction,
  decideDisposition,
  decideIncident,
  decideMaintenance,
  settleWorkingCapital,
} from '@/lib/workflow-decisions';

const SCHEMAS = {
  action: actionDecisionSchema,
  maintenance: maintenanceDecisionSchema,
  incident: incidentDecisionSchema,
  'inventory-disposition': dispositionDecisionSchema,
  'working-capital': workingCapitalSettlementSchema,
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workflow: string; id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const values = await params;
    const parsedWorkflow = mutableWorkflowSchema.safeParse(values.workflow);
    if (!parsedWorkflow.success) return NextResponse.json({ error: 'Unknown mutable workflow' }, { status: 404 });
    const id = Number(values.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const parsed = SCHEMAS[parsedWorkflow.data].safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatContractError(parsed.error) }, { status: 400 });

    let record: Record<string, unknown>;
    if (parsedWorkflow.data === 'action') record = await decideAction(session.user, id, parsed.data as never);
    else if (parsedWorkflow.data === 'maintenance') record = await decideMaintenance(session.user, id, parsed.data as never);
    else if (parsedWorkflow.data === 'incident') record = await decideIncident(session.user, id, parsed.data as never);
    else if (parsedWorkflow.data === 'inventory-disposition') record = await decideDisposition(session.user, id, parsed.data as never);
    else record = await settleWorkingCapital(session.user, id, parsed.data as never);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'The workflow could not be updated' }, { status: 500 });
  }
}
