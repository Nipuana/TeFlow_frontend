import { describe, it, expect } from 'vitest';
import { atLeast, can, ROLE_RANK } from '@/lib/permissions';

describe('ROLE_RANK', () => {
  it('orders the role hierarchy correctly', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.manager);
    expect(ROLE_RANK.manager).toBeGreaterThan(ROLE_RANK.employee);
  });
});

describe('atLeast', () => {
  it('is true when the role meets or exceeds the minimum', () => {
    expect(atLeast('owner', 'admin')).toBe(true);
    expect(atLeast('manager', 'manager')).toBe(true);
  });

  it('is false when the role is below the minimum', () => {
    expect(atLeast('employee', 'manager')).toBe(false);
  });

  it('is false for an undefined role', () => {
    expect(atLeast(undefined, 'employee')).toBe(false);
  });
});

describe('can (UX capability matrix)', () => {
  it('gates project creation to managers and above', () => {
    expect(can.createProject('employee')).toBe(false);
    expect(can.createProject('manager')).toBe(true);
    expect(can.createProject('owner')).toBe(true);
  });

  it('gates member management to admins and above', () => {
    expect(can.manageMembers('manager')).toBe(false);
    expect(can.manageMembers('admin')).toBe(true);
  });

  it('gates billing and account provisioning to the owner only', () => {
    expect(can.billing('admin')).toBe(false);
    expect(can.billing('owner')).toBe(true);
    expect(can.manageAccounts('admin')).toBe(false);
    expect(can.manageAccounts('owner')).toBe(true);
  });

  it('lets any signed-in role create tasks', () => {
    expect(can.createTask('employee')).toBe(true);
    expect(can.createTask(undefined)).toBe(false);
  });
});
