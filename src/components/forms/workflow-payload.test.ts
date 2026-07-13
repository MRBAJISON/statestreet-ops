import { describe, expect, it } from 'vitest';
import { buildWorkflowPayload } from './workflow-payload';

describe('workflow payload builder', () => {
  it('preserves exact money strings while converting counts and references to numbers', () => {
    const definition = {
      fields: [
        { name: 'amount', label: 'Amount', type: 'money' as const },
        { name: 'units', label: 'Units', type: 'number' as const },
        { name: 'storeId', label: 'Store', type: 'select' as const, reference: 'stores' as const },
        { name: 'approved', label: 'Approved', type: 'switch' as const },
      ],
    };

    expect(
      buildWorkflowPayload(definition, {
        amount: '1250.50',
        units: '4',
        storeId: '3',
        approved: true,
      })
    ).toEqual({ amount: '1250.50', units: 4, storeId: 3, approved: true });
  });
});
