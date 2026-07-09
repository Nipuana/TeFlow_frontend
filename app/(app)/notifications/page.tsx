'use client';

import { useNotifications, relativeTime } from '@/lib/notifications';

export default function NotificationsPage() {
  const { items, unread, markAllRead, markRead } = useNotifications();

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      <div className="row spread">
        <div className="row" style={{ gap: '0.6rem' }}>
          <h1>Notifications</h1>
          {unread > 0 && <span className="badge-count">{unread}</span>}
        </div>
        <button className="btn" onClick={markAllRead} disabled={unread === 0}>
          Mark all read
        </button>
      </div>

      <div className="feed">
        {items.length === 0 ? (
          <div className="feed-item muted">// nothing here yet</div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className="noti-item"
              role="button"
              tabIndex={0}
              onClick={() => markRead(n.id)}
              onKeyDown={(e) => e.key === 'Enter' && markRead(n.id)}
              style={{ cursor: n.read ? 'default' : 'pointer' }}
            >
              <span className="noti-dot" data-read={n.read || undefined} aria-hidden />
              <div style={{ opacity: n.read ? 0.6 : 1 }}>
                <div>
                  {n.actor && <span className="who" style={{ color: 'var(--phosphor)' }}>{n.actor} </span>}
                  {n.text}
                </div>
                <span className="when" style={{ display: 'block', color: 'var(--paper-dim)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                  {relativeTime(n.createdAt)}
                  {!n.read && ' · unread'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="muted" style={{ fontSize: '0.72rem' }}>
        Notifications are generated server-side on real events (task assignments, comments) and scoped to you — read state is
        tracked on the backend.
      </p>
    </div>
  );
}
