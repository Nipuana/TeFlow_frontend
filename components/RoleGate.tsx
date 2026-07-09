'use client';

import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';
import { atLeast } from '@/lib/permissions';
import type { Role } from '@/lib/types';

/**
 * Renders children only if the current user's role meets `min`.
 *
 * UX-only: it prevents showing controls that would 403 anyway. The server is
 * still the authority — never rely on this to protect an action.
 */
export function RoleGate({ min, children }: { min: Role; children: ReactNode }) {
  const { user } = useSession();
  if (!atLeast(user?.role, min)) return null;
  return <>{children}</>;
}
