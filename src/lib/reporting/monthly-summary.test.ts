import { describe, it, expect } from 'vitest';
import { generateMonthlySummary } from './monthly-summary';
// Date arithmetic is tested separately without connecting to the database.
describe('monthly narrative', () => {
  it('uses weighted totals and does not invent a cause', () => {
    const result = generateMonthlySummary({
      label: 'August',
      stores: [
        {
          name: 'A',
          netRevenue: 100,
          target: 200,
          units: 2,
          transactions: 1,
          footfall: 3,
        },
        {
          name: 'B',
          netRevenue: 900,
          target: 1000,
          units: 6,
          transactions: 2,
          footfall: 6,
        },
      ],
      evidence: [],
      lowProduct: 'Test shoe at A (1 unit, GHS 50.00 recorded sales)',
      nonMovingCount: 0,
      riskValue: null,
    });
    expect(result.facts[0]).toContain('83.3%');
    expect(
      result.facts.some((fact) =>
        fact.includes('lowest positive recorded seller was Test shoe')
      )
    ).toBe(true);
    expect(
      result.facts.some((fact) =>
        fact.includes('rank alone does not establish stock risk')
      )
    ).toBe(true);
    expect(result.explanation).toContain('Causes cannot be established');
  });
});
