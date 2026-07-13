'use client';

import { WorkflowWorkspace } from '@/components/forms/WorkflowWorkspace';
import { commercialWorkflows } from '@/components/forms/workflow-definitions';

export default function CommercialFormsPage() {
  return <WorkflowWorkspace title="Commercial workflows" definitions={commercialWorkflows} />;
}
