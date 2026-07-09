'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

/** Flip the theme on <html>, persist it, and return the new value. Shared by the
 *  button and the ⌘K palette command so both stay in sync. */
export function toggleTheme(): Theme {
  const current = (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('tf-theme', next);
  } catch {
    /* private mode — ignore */
  }
  return next;
}

/**
 * Light/dark theme toggle. Persists the choice in localStorage (a UI preference,
 * not sensitive data) and flips `data-theme` on <html>. The no-flash init script
 * in layout.tsx applies the saved value before first paint.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
    setTheme(current);
  }, []);

  function toggle() {
    setTheme(toggleTheme());
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title="Toggle theme"
    >
      {theme === 'dark' ? '◑ Light' : '◐ Dark'}
    </button>
  );
}
