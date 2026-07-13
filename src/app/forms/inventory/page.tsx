'use client';

import { WorkflowWorkspace } from '@/components/forms/WorkflowWorkspace';
import { inventoryShortcuts, inventoryWorkflows } from '@/components/forms/workflow-definitions';

export default function InventoryFormsPage() {
  return <WorkflowWorkspace title="Inventory workflows" definitions={inventoryWorkflows} shortcuts={inventoryShortcuts} />;
}
