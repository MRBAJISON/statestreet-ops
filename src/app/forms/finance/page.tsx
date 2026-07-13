'use client';

import { WorkflowWorkspace } from '@/components/forms/WorkflowWorkspace';
import { financeShortcuts, financeWorkflows } from '@/components/forms/workflow-definitions';

export default function FinanceFormsPage() {
  return <WorkflowWorkspace title="Finance workflows" definitions={financeWorkflows} shortcuts={financeShortcuts} />;
}
