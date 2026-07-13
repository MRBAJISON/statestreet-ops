'use client';

import { WorkflowWorkspace } from '@/components/forms/WorkflowWorkspace';
import { marketingWorkflows } from '@/components/forms/workflow-definitions';

export default function MarketingFormsPage() {
  return <WorkflowWorkspace title="Marketing workflows" definitions={marketingWorkflows} />;
}
