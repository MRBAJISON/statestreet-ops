'use client';

import { WorkflowWorkspace } from '@/components/forms/WorkflowWorkspace';
import { targetWorkflows } from '@/components/forms/workflow-definitions';

export default function TargetsPage() {
  return <WorkflowWorkspace title="Targets" definitions={targetWorkflows} />;
}
