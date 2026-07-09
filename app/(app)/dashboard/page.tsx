'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { can, ROLE_LABEL } from '@/lib/permissions';
import { useNotifications, relativeTime } from '@/lib/notifications';
import type { Project, Task } from '@/lib/types';
import { ViewState } from '@/components/ViewState';
import { StatusTag } from '@/components/StatusTag';

interface ProjectStat extends Project {
  openTasks: number;
}
interface Activity {
  id: string;
  taskId: string;
  projectId: string;
  projectName: string;
  title: string;
  status: Task['status'];
  updatedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useSession();
  const { items: notifications } = useNotifications();

  const [projects, setProjects] = useState<ProjectStat[] | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, memberRes] = await Promise.all([
        api<{ data: Project[] }>('/projects?limit=100'),
        user?.orgId
          ? api<{ data: unknown[] }>(`/orgs/${user.orgId}/members`).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);
      setMemberCount(memberRes.data.length);

      // Fetch tasks per project to compute REAL open-task counts + activity.
      const withTasks = await Promise.all(
        projRes.data.map(async (p) => {
          const t = await api<{ data: Task[] }>(`/projects/${p.id}/tasks`).catch(() => ({ data: [] as Task[] }));
          return { project: p, tasks: t.data };
        }),
      );

      setProjects(withTasks.map(({ project, tasks }) => ({ ...project, openTasks: tasks.filter((t) => t.status !== 'done').length })));

      const feed: Activity[] = withTasks
        .flatMap(({ project, tasks }) =>
          tasks.map((t) => ({
            id: t.id,
            taskId: t.id,
            projectId: project.id,
            projectName: project.name,
            title: t.title,
            status: t.status,
            updatedAt: t.updatedAt,
          })),
        )
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .slice(0, 5);
      setActivity(feed);
    } catch {
      setError('Could not load your workspace. Check the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [user?.orgId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      <div>
        <h1>Dashboard</h1>
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          <span style={{ color: 'var(--phosphor)' }}>{user ? ROLE_LABEL[user.role] : ''}</span> view —{' '}
          {user && can.seeAllProjects(user.role) ? 'all organization projects' : 'the projects you are on'}
        </p>
      </div>

      <div className="two-col">
        {/* ── Left: projects ─────────────────────────────────────────── */}
        <section>
          <div className="section-title">your projects</div>
          <ViewState
            loading={loading}
            error={error}
            data={projects}
            onRetry={load}
            empty={
              <span className="k">
                // no projects yet — <Link href="/projects">create one</Link>
              </span>
            }
          >
            {(rows) => (
              <div>
                {rows.map((p) => (
                  <div
                    key={p.id}
                    className="proj-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && router.push(`/projects/${p.id}`)}
                  >
                    <div>
                      <h3>{p.name}</h3>
                      <div className="meta">
                        {memberCount ?? '—'} member{memberCount === 1 ? '' : 's'} · {p.openTasks} open task
                        {p.openTasks === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className="arrow" aria-hidden>
                      →
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ViewState>
        </section>

        {/* ── Right: activity + notifications ────────────────────────── */}
        <div className="stack" style={{ gap: '1.5rem' }}>
          <section>
            <div className="section-title">recent activity</div>
            <div className="feed">
              {loading ? (
                <div className="feed-item skeleton" style={{ margin: '0.7rem' }} />
              ) : activity.length === 0 ? (
                <div className="feed-item muted">// no activity yet</div>
              ) : (
                activity.map((a) => (
                  <div key={a.id} className="feed-item">
                    <span>
                      task <span className="mono-id">{a.taskId.slice(0, 4)}</span> · <StatusTag status={a.status} /> in{' '}
                      <span className="who">{a.projectName}</span>
                    </span>
                    <span className="when">{relativeTime(a.updatedAt)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="row spread" style={{ alignItems: 'baseline' }}>
              <div className="section-title" style={{ borderBottom: 'none', marginBottom: 0 }}>
                notifications
              </div>
              <Link className="link-lite" href="/notifications">
                see all →
              </Link>
            </div>
            <div className="feed" style={{ marginTop: '0.5rem' }}>
              {notifications.slice(0, 3).map((n) => (
                <div key={n.id} className="feed-item" data-read={n.read || undefined}>
                  <span>
                    {n.actor && <span className="who">{n.actor} </span>}
                    {n.text}
                  </span>
                  <span className="when">{relativeTime(n.createdAt)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
