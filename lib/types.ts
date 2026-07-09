export type Role = 'employee' | 'manager' | 'admin' | 'owner';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  orgId: string | null;
  role: Role;
  mfaEnabled: boolean;
  bio?: string;
  hasAvatar?: boolean;
  /** True while the account is still on an owner-issued temporary password. */
  mustChangePassword?: boolean;
}

export interface Org {
  id: string;
  name: string;
  plan: string;
  seats: number;
  myRole?: Role;
}

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface Project {
  id: string;
  orgId: string;
  name: string;
  description: string;
  createdBy: string;
  memberIds: string[];
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  userId: string;
  role: Role;
  name: string;
  email: string;
  joinedAt: string;
  /** True while this member is still on their owner-issued temporary password. */
  pendingPasswordChange?: boolean;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}
