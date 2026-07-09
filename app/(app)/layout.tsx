'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { can, ROLE_LABEL } from '@/lib/permissions';
import { CommandBar } from '@/components/CommandBar';
import { ForcePasswordChange } from '@/components/ForcePasswordChange';

/**
 * Authenticated shell: command bar + expandable sidebar + content.
 * The sidebar can be collapsed to an icon rail (labels then appear as hover
 * tooltips) or expanded to show icons + labels; the choice is remembered.
 * Client-side auth guard redirects to /login if no session bootstraps — a UX
 * guard only; every API call is independently authorized server-side.
 */
function svg(children: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  dashboard: svg(
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>,
  ),
  projects: svg(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />),
  notifications: svg(
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>,
  ),
  members: svg(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
  ),
  settings: svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>,
  ),
  collapse: svg(
    <>
      <path d="M14 7l-5 5 5 5" />
      <path d="M20 7l-5 5 5 5" />
    </>,
  ),
  expand: svg(
    <>
      <path d="M10 7l5 5-5 5" />
      <path d="M4 7l5 5-5 5" />
    </>,
  ),
};

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/projects', label: 'Projects', icon: 'projects' },
  { href: '/notifications', label: 'Notifications', icon: 'notifications' },
  { href: '/members', label: 'Members', icon: 'members', adminOnly: true },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem('tf-nav-collapsed') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  function toggleNav() {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem('tf-nav-collapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (loading || !user) {
    return (
      <div className="auth-wrap">
        <span className="muted prompt">authenticating…</span>
      </div>
    );
  }

  if (user.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  const initials =
    (user.name || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || ROLE_LABEL[user.role].slice(0, 2).toUpperCase();

  const items = NAV.filter((item) => !item.adminOnly || can.manageMembers(user.role));

  return (
    <div>
      <CommandBar />
      <div className="shell" data-nav={collapsed ? 'collapsed' : 'expanded'}>
        <nav className="rail" aria-label="Primary">
          <button
            className="nav-toggle"
            onClick={toggleNav}
            data-tip={collapsed ? 'Expand' : 'Collapse'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            <span className="nav-ico">{collapsed ? ICONS.expand : ICONS.collapse}</span>
            <span className="nav-label">Collapse</span>
          </button>

          <div className="nav-items">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-item"
                data-active={pathname.startsWith(item.href)}
                data-tip={item.label}
                aria-label={item.label}
              >
                <span className="nav-ico">{ICONS[item.icon]}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="nav-foot">
            <div className="nav-user" data-tip={`${user.name} · ${ROLE_LABEL[user.role]}`}>
              <span className="rail-role">{initials}</span>
              <span className="nav-label nav-user-meta">
                <span className="nu-name">{user.name}</span>
                <span className="nu-role">{ROLE_LABEL[user.role]}</span>
              </span>
            </div>
          </div>
        </nav>

        <main>
          <div className="wrap">{children}</div>
        </main>
      </div>
    </div>
  );
}
