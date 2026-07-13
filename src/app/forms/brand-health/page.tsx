'use client';

import { WorkflowWorkspace } from '@/components/forms/WorkflowWorkspace';
import { brandWorkflows } from '@/components/forms/workflow-definitions';

export default function BrandFormsPage() {
  return <WorkflowWorkspace title="Brand workflows" definitions={brandWorkflows} />;
}
