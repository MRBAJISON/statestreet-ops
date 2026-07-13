'use client';

import { WorkflowWorkspace } from '@/components/forms/WorkflowWorkspace';
import { operationsWorkflows } from '@/components/forms/workflow-definitions';

export default function OperationsFormsPage() {
  return <WorkflowWorkspace title="Operations workflows" definitions={operationsWorkflows} />;
}
