'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Lightweight toast system for action feedback (created / saved / failed).
 * Replaces scattered inline banners so every action gives consistent, glanceable
 * confirmation without blocking the UI.
 */
type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastApi {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++seq;
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => remove(id), 3600);
    },
    [remove],
  );

  const api: ToastApi = {
    toast,
    success: (m) => toast(m, 'success'),
    error: (m) => toast(m, 'error'),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" data-type={t.type} onClick={() => remove(t.id)}>
            <span className="toast-mark" aria-hidden>
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '›'}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
