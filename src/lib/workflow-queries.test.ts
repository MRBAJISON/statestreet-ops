import { describe, expect, it, vi } from 'vitest';
import type { AppUser } from './auth';
import { getMutableWorkflowReadScope } from './workflow-queries';
import type { Department, UserRole } from './types';

vi.mock('./db', () => ({ db: {} }));

function user(role: UserRole, department: Department = role === 'owner' ? 'executive' : role as Department): AppUser {
  return {
    id: '17',
    name: 'Test User',
    email: 'test@example.com',
    role,
    department,
  };
}

describe('mutable workflow read scopes', () => {
  it('allows owners to see all actions and keeps department roles scoped', () => {
    expect(getMutableWorkflowReadScope('action', user('owner'))).toEqual({
      actorUserId: 17,
      allActions: true,
      actionDepartments: [],
    });
    expect(getMutableWorkflowReadScope('action', user('finance'))).toMatchObject({
      allActions: false,
      actionDepartments: ['finance'],
    });
  });

  it('includes brand actions in the marketing PATCH-equivalent scope', () => {
    expect(getMutableWorkflowReadScope('action', user('marketing')).actionDepartments).toEqual([
      'marketing',
      'brand',
    ]);
  });

  it('preserves Operations cross-department mutable workflow access', () => {
    expect(getMutableWorkflowReadScope('action', user('operations'))).toMatchObject({
      allActions: true,
      actionDepartments: [],
    });
    expect(getMutableWorkflowReadScope('working-capital', user('operations'))).toMatchObject({
      actorUserId: 17,
    });
    expect(getMutableWorkflowReadScope('inventory-disposition', user('operations'))).toMatchObject({
      actorUserId: 17,
    });
  });

  it('does not expose mutable action records to store managers without a launcher definition', () => {
    expect(() => getMutableWorkflowReadScope('action', user('store-manager', 'commercial'))).toThrowError(
      expect.objectContaining({ status: 403 })
    );
  });

  it.each([
    ['maintenance', 'operations'],
    ['incident', 'operations'],
    ['inventory-disposition', 'inventory'],
    ['working-capital', 'finance'],
  ] as const)('requires the PATCH role for %s reads', (workflow, requiredRole) => {
    expect(getMutableWorkflowReadScope(workflow, user(requiredRole))).toMatchObject({ actorUserId: 17 });
    expect(() => getMutableWorkflowReadScope(workflow, user('commercial'))).toThrowError(
      expect.objectContaining({ status: 403 })
    );
  });

  it('rejects an invalid session user id before querying', () => {
    expect(() => getMutableWorkflowReadScope('working-capital', { ...user('finance'), id: 'invalid' })).toThrowError(
      expect.objectContaining({ status: 401 })
    );
  });
});
