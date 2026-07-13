import { describe, expect, it } from 'vitest';
import type { AppUser } from './auth';
import {
  canMutateLegacyEntry,
  canReadLegacyDepartment,
  canReadLegacyForm,
  canWriteLegacyForm,
  isKnownLegacyForm,
} from './entry-permissions';

const user = (role: AppUser['role'], store = ''): AppUser => ({
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  role,
  department: role === 'store-manager' ? 'commercial' : role === 'owner' ? 'executive' : role,
  store,
});

describe('legacy entry permissions', () => {
  it('rejects unknown form names', () => {
    expect(isKnownLegacyForm('finance', 'made-up-form')).toBe(false);
    expect(canWriteLegacyForm(user('finance'), 'finance', 'made-up-form')).toBe(false);
  });

  it('keeps raw legacy reads within the approved role matrix', () => {
    expect(canReadLegacyDepartment('commercial', 'finance')).toBe(false);
    expect(canReadLegacyDepartment('marketing', 'commercial')).toBe(false);
    expect(canReadLegacyDepartment('marketing', 'brand')).toBe(true);
    expect(canReadLegacyDepartment('inventory', 'finance')).toBe(false);
  });

  it('allows store managers to read only their transitional workflow types', () => {
    const manager = user('store-manager', 'labone-men');
    expect(canReadLegacyForm(manager, 'finance', 'revenue')).toBe(true);
    expect(canReadLegacyForm(manager, 'inventory', 'store-transfer')).toBe(true);
    expect(canReadLegacyForm(manager, 'finance', 'expenses')).toBe(false);
  });

  it('limits ordinary roles to their own write surfaces', () => {
    expect(canWriteLegacyForm(user('finance'), 'finance', 'expenses')).toBe(true);
    expect(canWriteLegacyForm(user('finance'), 'marketing', 'campaign')).toBe(false);
    expect(canWriteLegacyForm(user('marketing'), 'brand', 'voice')).toBe(true);
  });

  it('allows store managers to update only their own approved legacy surfaces', () => {
    const manager = user('store-manager', 'labone-men');
    expect(
      canMutateLegacyEntry(
        manager,
        { department: 'finance', formType: 'revenue', payload: { store: 'labone-men' } },
        'update'
      )
    ).toBe(true);
    expect(
      canMutateLegacyEntry(
        manager,
        { department: 'finance', formType: 'revenue', payload: { store: 'east-legon-men' } },
        'update'
      )
    ).toBe(false);
    expect(
      canMutateLegacyEntry(
        manager,
        { department: 'inventory', formType: 'store-transfer', payload: { fromStore: 'labone-men' } },
        'delete'
      )
    ).toBe(false);
  });

  it('preserves target editing for owner, Finance, and Commercial', () => {
    expect(canWriteLegacyForm(user('owner'), 'commercial', 'weekly-target')).toBe(true);
    expect(canWriteLegacyForm(user('finance'), 'commercial', 'exec-target')).toBe(true);
    expect(canWriteLegacyForm(user('commercial'), 'commercial', 'exec-target-annual')).toBe(true);
  });
});
