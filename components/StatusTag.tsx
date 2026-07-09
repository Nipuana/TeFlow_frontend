import type { TaskStatus } from '@/lib/types';

const LABELS: Record<TaskStatus, string> = {
  todo: 'TODO',
  in_progress: 'IN PROGRESS',
  blocked: 'BLOCKED',
  done: 'DONE',
};

/**
 * Bracketed status tag, e.g. [IN PROGRESS] — build-log style, not a pill.
 * Color is paired with the text label so color is never the only signal (a11y).
 */
export function StatusTag({ status }: { status: TaskStatus }) {
  return (
    <span className="tag" data-state={status}>
      [{LABELS[status] ?? String(status).toUpperCase()}]
    </span>
  );
}
