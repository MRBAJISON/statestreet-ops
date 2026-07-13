import { describe, expect, it, vi } from 'vitest';
import type { WorkflowName } from './contracts/workflows';
import { WORKFLOW_HANDLERS } from './workflow-mutations';

vi.mock('./db', () => ({ db: {} }));

const OPERATIONS_DEPARTMENT_WORKFLOWS = [
  'expense',
  'budget',
  'capital-snapshot',
  'cash-transaction',
  'working-capital',
  'forecast',
  'target',
  'action',
  'product-insight',
  'campaign',
  'lead-metric',
  'social-metric',
  'clienteling',
  'feedback',
  'store-standard',
  'vm-review',
  'store-experience',
  'maintenance',
  'incident',
  'sop-review',
  'people',
  'brand-health',
  'brand-sentiment',
  'competitor',
  'digital-reputation',
  'inventory-disposition',
] as const satisfies readonly WorkflowName[];

describe('typed workflow role parity', () => {
  it.each(OPERATIONS_DEPARTMENT_WORKFLOWS)(
    'allows Operations to submit %s records',
    (workflow) => {
      expect(WORKFLOW_HANDLERS[workflow].roles.has('operations')).toBe(true);
    }
  );

  it('does not widen ordinary department roles or store-only customer capture', () => {
    expect(WORKFLOW_HANDLERS.expense.roles.has('commercial')).toBe(false);
    expect(WORKFLOW_HANDLERS['customer-capture'].roles.has('operations')).toBe(false);
  });
});
