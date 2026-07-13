import { describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './test-database';

describe('test database safety', () => {
  it('accepts an explicit test database and refuses normal databases', () => {
    expect(testDatabaseUrl('postgresql:///statestreet_ops_test?host=/tmp')).toBe(
      'postgresql:///statestreet_ops_test?host=/tmp'
    );
    expect(() => testDatabaseUrl('postgresql:///statestreet_ops_local?host=/tmp')).toThrow(/ending in _test/);
    expect(() => testDatabaseUrl('postgresql://example.com/production')).toThrow(/ending in _test/);
  });
});
