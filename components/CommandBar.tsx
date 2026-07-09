'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { can, ROLE_LABEL } from '@/lib/permissions';
import { ThemeToggle, toggleTheme } from './ThemeToggle';
import { DensityToggle, toggleDensity } from './DensityToggle';

/**
 * Command bar + ⌘K palette — the primary, keyboard-first navigation model.
 * The blinking caret (▮) at the end of the palette input is the one place motion
 * draws the eye; it's suppressed under prefers-reduced-motion (see globals.css).
 */
interface Cmd {
  id: string;
  label: string;
  hint: string;
  run: () => void;
  show?: boolean;
}

export function CommandBar() {
  const router = useRouter();
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingG = useRef(false);

  const commands = useMemo<Cmd[]>(
    () => [
      { id: 'dashboard', label: 'Go to Dashboard', hint: 'g d', run: () => router.push('/dashboard') },
      { id: 'projects', label: 'Go to Projects', hint: 'g p', run: () => router.push('/projects') },
      { id: 'notifications', label: 'Go to Notifications', hint: 'g n', run: () => router.push('/notifications') },
      { id: 'settings', label: 'Go to Settings', hint: 'g s', run: () => router.push('/settings') },
      { id: 'theme', label: 'Toggle light / dark theme', hint: 'theme', run: () => toggleTheme() },
      { id: 'density', label: 'Toggle compact / comfortable density', hint: 'view', run: () => toggleDensity() },
      { id: 'help', label: 'Show keyboard shortcuts', hint: '?', run: () => setShowHelp(true) },
      {
        id: 'members',
        label: 'Manage Team & Accounts',
        hint: 'admin',
        run: () => router.push('/members'),
        show: can.manageMembers(user?.role),
      },
      {
        id: 'create-account',
        label: 'Create a new account',
        hint: 'owner',
        run: () => router.push('/members'),
        show: can.manageAccounts(user?.role),
      },
      {
        id: 'audit',
        label: 'Open Audit Log',
        hint: 'admin',
        run: () => router.push('/audit'),
        show: can.viewAudit(user?.role),
      },
      { id: 'signout', label: 'Sign out', hint: 'exit', run: () => logout() },
    ],
    [router, user, logout],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands.filter((c) => c.show !== false && (!q || c.label.toLowerCase().includes(q)));
  }, [commands, query]);

  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl-K toggles the palette from anywhere.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setShowHelp(false);
        return;
      }
      // Single-key shortcuts only fire when not typing and without modifiers.
      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === '?') {
        setShowHelp((v) => !v);
        return;
      }
      if (e.key === 'c') {
        // Ask the current page to focus its primary create field.
        window.dispatchEvent(new CustomEvent('tf-quick-create'));
        return;
      }
      // Chord navigation: press "g" then a destination key.
      if (pendingG.current) {
        pendingG.current = false;
        const dest: Record<string, string> = { d: '/dashboard', p: '/projects', n: '/notifications', s: '/settings' };
        if (dest[e.key]) {
          e.preventDefault();
          router.push(dest[e.key]);
        }
        return;
      }
      if (e.key === 'g') {
        pendingG.current = true;
        setTimeout(() => (pendingG.current = false), 1200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const exec = (c: Cmd) => {
    setOpen(false);
    c.run();
  };

  return (
    <>
      <header className="commandbar">
        <span className="brand">
          TE<b>FLOW</b>
        </span>
        <button className="cmd-trigger" onClick={() => setOpen(true)} aria-label="Open command palette">
          <span>Search or run a command…</span>
          <kbd>⌘K</kbd>
        </button>
        <span className="muted" style={{ fontSize: '0.75rem' }}>
          {user ? (
            <>
              <span className="mono-id">{user.email}</span> ·{' '}
              <span style={{ color: 'var(--phosphor)' }}>{ROLE_LABEL[user.role]}</span>
            </>
          ) : null}
        </span>
        <DensityToggle />
        <ThemeToggle />
      </header>

      {showHelp && (
        <div
          className="palette-backdrop"
          onClick={() => setShowHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div className="confirm" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-title">Keyboard shortcuts</div>
            <div className="shortcut-grid">
              <kbd>⌘K</kbd>
              <span>Command palette</span>
              <kbd>/</kbd>
              <span>Open palette / search</span>
              <kbd>g d</kbd>
              <span>Go to Dashboard</span>
              <kbd>g p</kbd>
              <span>Go to Projects</span>
              <kbd>g n</kbd>
              <span>Go to Notifications</span>
              <kbd>g s</kbd>
              <span>Go to Settings</span>
              <kbd>c</kbd>
              <span>Create (focus the new-item field)</span>
              <kbd>?</kbd>
              <span>This help</span>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div
          className="palette-backdrop"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <div className="palette" onClick={(e) => e.stopPropagation()}>
            <div className="palette-input">
              <span style={{ color: 'var(--phosphor)' }}>❯</span>
              <input
                ref={inputRef}
                value={query}
                placeholder="type a command"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') setCursor((c) => Math.min(c + 1, results.length - 1));
                  if (e.key === 'ArrowUp') setCursor((c) => Math.max(c - 1, 0));
                  if (e.key === 'Enter' && results[cursor]) exec(results[cursor]);
                }}
                aria-label="Command input"
              />
              <span className="caret" aria-hidden />
            </div>
            <div role="listbox" aria-label="Commands">
              {results.length === 0 ? (
                <div className="palette-item muted">no matching command</div>
              ) : (
                results.map((c, i) => (
                  <div
                    key={c.id}
                    className="palette-item"
                    role="option"
                    aria-selected={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => exec(c)}
                  >
                    <span>{c.label}</span>
                    <span className="hint">{c.hint}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
