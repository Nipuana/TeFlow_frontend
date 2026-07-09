import type { Role } from './types';

/**
 * UX-ONLY permission helpers.
 *
 * These decide whether to RENDER a control, so users don't see buttons that
 * would just 403. They are NOT a security boundary — the backend independently
 * authorizes every request (that separation is exactly what API5 is about).
 */
export const ROLE_RANK: Record<Role, number> = {
  employee: 0,
  manager: 1,
  admin: 2,
  owner: 3,
};

/** Human-friendly labels + one-line descriptions for the role picker/badges. */
export const ROLE_LABEL: Record<Role, string> = {
  employee: 'Employee',
  manager: 'Manager',
  admin: 'Admin',
  owner: 'Owner',
};

export const ROLE_BLURB: Record<Role, string> = {
  employee: 'Works on tasks in the projects they are added to',
  manager: 'Sees and manages every project in the organization',
  admin: 'Organization administration — members & billing',
  owner: 'Full control — provisions accounts and billing',
};

export function atLeast(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const can = {
  createTask: (r?: Role) => atLeast(r, 'employee'),
  editTask: (r?: Role) => atLeast(r, 'employee'),
  createProject: (r?: Role) => atLeast(r, 'manager'),
  manageProject: (r?: Role) => atLeast(r, 'manager'),
  seeAllProjects: (r?: Role) => atLeast(r, 'manager'),
  deleteProject: (r?: Role) => atLeast(r, 'admin'),
  manageMembers: (r?: Role) => atLeast(r, 'admin'),
  manageAccounts: (r?: Role) => atLeast(r, 'owner'),
  manageWebhooks: (r?: Role) => atLeast(r, 'admin'),
  viewAudit: (r?: Role) => atLeast(r, 'admin'),
  billing: (r?: Role) => atLeast(r, 'owner'),
  deleteOrg: (r?: Role) => atLeast(r, 'owner'),
};
