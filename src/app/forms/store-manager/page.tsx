'use client';

import { WorkflowWorkspace } from '@/components/forms/WorkflowWorkspace';
import { storeShortcuts, storeWorkflows } from '@/components/forms/workflow-definitions';

export default function StoreManagerFormsPage() {
  return <WorkflowWorkspace title="Store workflows" definitions={storeWorkflows} shortcuts={storeShortcuts} />;
}
