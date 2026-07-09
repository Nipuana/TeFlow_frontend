'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useSession } from './session';

/**
 * Notifications, backed by the real backend `/notifications` API.
 *
 * A tiny module-level cache + listener set keeps every component that uses
 * `useNotifications` (dashboard preview, notifications page) in sync after any
 * read/mutation, without a global state library. Fetching is gated on an
 * authenticated session so it never fires an unauthenticated request.
 */
export interface Notification {
  id: string;
  actor?: string;
  text: string;
  createdAt: string;
  read: boolean;
}

interface ApiNotification {
  id: string;
  actorName?: string;
  text: string;
  createdAt: string;
  read: boolean;
}

let cache: Notification[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

const mapN = (n: ApiNotification): Notification => ({
  id: n.id,
  actor: n.actorName,
  text: n.text,
  createdAt: n.createdAt,
  read: n.read,
});

export async function fetchNotifications(): Promise<void> {
  try {
    const res = await api<{ data: ApiNotification[] }>('/notifications');
    cache = res.data.map(mapN);
    emit();
  } catch {
    // Not authenticated yet or backend unreachable — leave cache as-is.
  }
}

export async function markAllRead(): Promise<void> {
  try {
    await api('/notifications/read-all', { method: 'POST', body: {} });
  } catch {
    /* ignore */
  }
  await fetchNotifications();
}

export async function markRead(id: string): Promise<void> {
  try {
    await api(`/notifications/${id}/read`, { method: 'POST', body: {} });
  } catch {
    /* ignore */
  }
  await fetchNotifications();
}

export function useNotifications() {
  const { user } = useSession();
  const [items, setItems] = useState<Notification[]>(cache);

  const sync = useCallback(() => setItems([...cache]), []);

  useEffect(() => {
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, [sync]);

  // (Re)load whenever an authenticated user becomes available.
  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  return {
    items,
    unread: items.filter((n) => !n.read).length,
    markAllRead,
    markRead,
    refresh: fetchNotifications,
  };
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.max(0, Math.round(diff / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
