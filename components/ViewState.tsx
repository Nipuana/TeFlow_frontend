import type { ReactNode } from 'react';

/**
 * Enforces the "four states, always" rule from the build checklist:
 * loading (skeleton), error (what + retry), empty (what to do next), populated.
 * Every data-driven view wraps its content in this so no state is forgotten.
 */
interface ViewStateProps<T> {
  loading: boolean;
  error?: string | null;
  data: T[] | null | undefined;
  onRetry?: () => void;
  empty?: ReactNode;
  children: (data: T[]) => ReactNode;
  skeletonRows?: number;
}

export function ViewState<T>({
  loading,
  error,
  data,
  onRetry,
  empty,
  children,
  skeletonRows = 4,
}: ViewStateProps<T>) {
  if (loading) {
    return (
      <div className="stack" aria-busy="true" aria-live="polite">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="skeleton" style={{ width: `${90 - i * 8}%` }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="state" role="alert">
        <div className="k">// error</div>
        <p>{error}</p>
        {onRetry && (
          <button className="btn" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="state">{empty ?? <span className="k">// empty — nothing here yet</span>}</div>;
  }

  return <>{children(data)}</>;
}
