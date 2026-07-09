import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * RoleGate reads the current user from the session context. We mock that hook
 * so we can drive the component with any role. `vi.hoisted` gives the (hoisted)
 * mock factory a mutable handle we can set per test.
 */
const sessionState = vi.hoisted(() => ({ role: undefined as string | undefined }));

vi.mock('@/lib/session', () => ({
  useSession: () => ({ user: sessionState.role ? { role: sessionState.role } : null }),
}));

import { RoleGate } from '@/components/RoleGate';

describe('<RoleGate />', () => {
  beforeEach(() => {
    sessionState.role = undefined;
  });

  it('renders children when the role meets the minimum', () => {
    sessionState.role = 'owner';
    render(
      <RoleGate min="admin">
        <button>Delete org</button>
      </RoleGate>,
    );
    expect(screen.getByRole('button', { name: 'Delete org' })).toBeInTheDocument();
  });

  it('renders nothing when the role is below the minimum', () => {
    sessionState.role = 'employee';
    render(
      <RoleGate min="manager">
        <button>New project</button>
      </RoleGate>,
    );
    expect(screen.queryByRole('button', { name: 'New project' })).not.toBeInTheDocument();
  });

  it('renders nothing when there is no signed-in user', () => {
    sessionState.role = undefined;
    render(
      <RoleGate min="employee">
        <span>secret</span>
      </RoleGate>,
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('treats an exactly-matching role as sufficient', () => {
    sessionState.role = 'manager';
    render(
      <RoleGate min="manager">
        <span>managers only</span>
      </RoleGate>,
    );
    expect(screen.getByText('managers only')).toBeInTheDocument();
  });
});
