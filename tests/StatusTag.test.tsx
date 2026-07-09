import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusTag } from '@/components/StatusTag';
import type { TaskStatus } from '@/lib/types';

describe('<StatusTag />', () => {
  it('renders the bracketed, human label for a status', () => {
    render(<StatusTag status="in_progress" />);
    expect(screen.getByText('[IN PROGRESS]')).toBeInTheDocument();
  });

  it('exposes the raw status as a data attribute for styling', () => {
    render(<StatusTag status="blocked" />);
    expect(screen.getByText('[BLOCKED]')).toHaveAttribute('data-state', 'blocked');
  });

  it('maps every known status to its label', () => {
    const cases: Record<TaskStatus, string> = {
      todo: '[TODO]',
      in_progress: '[IN PROGRESS]',
      blocked: '[BLOCKED]',
      done: '[DONE]',
    };
    for (const [status, label] of Object.entries(cases) as [TaskStatus, string][]) {
      const { unmount } = render(<StatusTag status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});
