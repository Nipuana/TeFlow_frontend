'use client';

import { useEffect, useState } from 'react';

type Density = 'comfortable' | 'compact';

/** Flip layout density on <html>, persist it, return the new value. */
export function toggleDensity(): Density {
  const current = (document.documentElement.getAttribute('data-density') as Density) || 'comfortable';
  const next: Density = current === 'comfortable' ? 'compact' : 'comfortable';
  document.documentElement.setAttribute('data-density', next);
  try {
    localStorage.setItem('tf-density', next);
  } catch {
    /* ignore */
  }
  return next;
}

/**
 * Density customization — comfortable (default) vs compact rows/cards. A
 * per-user UI preference persisted in localStorage; applied before paint by the
 * init script in layout.tsx.
 */
export function DensityToggle() {
  const [density, setDensity] = useState<Density>('comfortable');

  useEffect(() => {
    setDensity((document.documentElement.getAttribute('data-density') as Density) || 'comfortable');
  }, []);

  return (
    <button
      className="theme-toggle"
      onClick={() => setDensity(toggleDensity())}
      aria-label={`Switch to ${density === 'comfortable' ? 'compact' : 'comfortable'} density`}
      title="Toggle density"
    >
      {density === 'comfortable' ? '≣ Compact' : '≡ Comfy'}
    </button>
  );
}
