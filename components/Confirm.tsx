'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/**
 * On-brand confirmation dialog, exposed as an async `confirm()` so callers can
 * `if (await confirm({...}))` instead of using the browser's window.confirm.
 * Keyboard-accessible: Escape cancels, Enter confirms, focus lands on the
 * confirm button.
 */
interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="palette-backdrop"
          onClick={() => close(false)}
          role="dialog"
          aria-modal="true"
          aria-label={opts.title}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close(false);
            if (e.key === 'Enter') close(true);
          }}
        >
          <div className="confirm" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-title">{opts.title}</div>
            {opts.message && <p className="muted" style={{ fontSize: '0.85rem' }}>{opts.message}</p>}
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn" onClick={() => close(false)}>
                {opts.cancelLabel ?? 'Cancel'}
              </button>
              <button
                className={opts.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => close(true)}
                ref={(el) => el?.focus()}
              >
                {opts.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
