'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { useToast } from '@/components/Toast';
import type { Member, Project, Task, TaskStatus } from '@/lib/types';
import { dueInfo, isoToDateInput, dateInputToIso } from '@/lib/date';
import { StatusTag } from '@/components/StatusTag';
import { ViewState } from '@/components/ViewState';
import { Ledger } from '@/components/Ledger';

interface Comment {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
}

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

export default function TaskDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [team, setTeam] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const base = `/projects/${projectId}/tasks/${taskId}`;
  const nameOf = useMemo(() => {
    const map = new Map(members.map((m) => [m.userId, m.name]));
    return (id?: string | null) => (id ? map.get(id) ?? `${id.slice(0, 8)}…` : 'Unassigned');
  }, [members]);

  // Editing requires employee+ AND (manager, or being on this project's team).
  const canEdit =
    can.editTask(user?.role) && (can.manageProject(user?.role) || (user ? team.includes(user.id) : false));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ task }, cs, mem, proj] = await Promise.all([
        api<{ task: Task }>(base),
        api<{ data: Comment[] }>(`${base}/comments`),
        user?.orgId ? api<{ data: Member[] }>(`/orgs/${user.orgId}/members`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        api<{ project: Project }>(`/projects/${projectId}`).catch(() => ({ project: null as Project | null })),
      ]);
      setTask(task);
      setComments(cs.data);
      setMembers(mem.data);
      setTeam(proj.project?.memberIds ?? []);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'Task not found.' : 'Could not load task.');
    } finally {
      setLoading(false);
    }
  }, [base, user?.orgId]);

  useEffect(() => {
    load();
  }, [load]);

  // Optimistic field patch used by status / assignee / due date.
  async function patchField(patch: Partial<Task>, label: string) {
    if (!task) return;
    const prev = task;
    setTask({ ...task, ...patch });
    try {
      const { task: updated } = await api<{ task: Task }>(base, { method: 'PATCH', body: patch });
      setTask(updated);
      toast.success(label);
    } catch (err) {
      setTask(prev);
      toast.error(err instanceof ApiError && err.status === 403 ? 'Your role cannot edit this task' : 'Update failed');
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await api(`${base}/comments`, { method: 'POST', body: { body: comment.trim() } });
      setComment('');
      const cs = await api<{ data: Comment[] }>(`${base}/comments`);
      setComments(cs.data);
      toast.success('Comment posted');
    } catch {
      toast.error('Could not post comment');
    } finally {
      setPosting(false);
    }
  }

  if (error && !task) {
    return (
      <div className="state" role="alert">
        <div className="k">// error</div>
        <p>{error}</p>
        <button className="btn" onClick={() => router.back()}>
          Back
        </button>
      </div>
    );
  }

  const due = task ? dueInfo(task.dueDate, task.status === 'done') : null;

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      <div>
        <p className="muted" style={{ fontSize: '0.78rem' }}>
          <a onClick={() => router.push(`/projects/${projectId}`)} style={{ cursor: 'pointer' }}>
            project
          </a>{' '}
          / task <span className="mono-id">{String(taskId).slice(0, 8)}</span>
        </p>
        <h1>{task ? task.title : 'Loading…'}</h1>
      </div>

      {task && (
        <section className="panel" style={{ padding: '1rem' }}>
          <div className="row" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
            <StatusTag status={task.status} />
            <span className="prio" data-p={task.priority}>
              {task.priority}
            </span>
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              · assigned to <span style={{ color: 'var(--paper)' }}>{nameOf(task.assigneeId)}</span>
            </span>
            {due && (
              <span
                className="mono-id"
                style={{ fontSize: '0.75rem', color: due.overdue ? 'var(--alert)' : due.soon ? 'var(--phosphor)' : 'var(--paper-dim)' }}
              >
                · {due.label}
              </span>
            )}
          </div>

          {task.description && <p style={{ maxWidth: 640, marginTop: '0.75rem' }}>{task.description}</p>}

          {/* Editing controls (employee+ on the team); server re-checks every write. */}
          {canEdit && (
            <div className="row" style={{ gap: '1.25rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'flex-end' }}>
              <div className="field">
                <span className="label">Status</span>
                <select
                  className="input"
                  value={task.status}
                  onChange={(e) => patchField({ status: e.target.value as TaskStatus }, 'Status updated')}
                  aria-label="Status"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span className="label">Assignee</span>
                <select
                  className="input"
                  value={task.assigneeId ?? ''}
                  onChange={(e) => patchField({ assigneeId: e.target.value || null }, 'Assignee updated')}
                  aria-label="Assignee"
                >
                  <option value="">Unassigned</option>
                  {members
                    .filter((m) => team.includes(m.userId))
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="field">
                <span className="label">Start date</span>
                <input
                  className="input"
                  type="date"
                  value={isoToDateInput(task.startDate)}
                  onChange={(e) => patchField({ startDate: dateInputToIso(e.target.value) }, 'Start date updated')}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
                    } catch {
                      /* not supported / not a user gesture — the icon still works */
                    }
                  }}
                  aria-label="Start date"
                />
              </div>

              <div className="field">
                <span className="label">End date</span>
                <input
                  className="input"
                  type="date"
                  value={isoToDateInput(task.dueDate)}
                  onChange={(e) => patchField({ dueDate: dateInputToIso(e.target.value) }, 'End date updated')}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
                    } catch {
                      /* not supported / not a user gesture — the icon still works */
                    }
                  }}
                  aria-label="End date"
                />
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <div className="section-title">comments</div>
        {canEdit && (
          <form className="panel row" style={{ padding: '1rem', gap: '0.6rem', marginBottom: '0.75rem' }} onSubmit={addComment}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="add a comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              aria-label="Add a comment"
            />
            <button className="btn btn-primary" type="submit" disabled={posting || !comment.trim()}>
              {posting ? 'posting…' : 'Post'}
            </button>
          </form>
        )}

        <div className="panel" style={{ padding: '0.5rem 0.7rem' }}>
          <ViewState loading={loading} error={null} data={comments} onRetry={load} empty={<span className="k">// no comments yet</span>}>
            {(rows) => (
              <Ledger
                columns={['Author', 'Comment', 'When']}
                rows={rows.map((c) => ({
                  key: c.id,
                  cells: [
                    <span key="a">{nameOf(c.authorId)}</span>,
                    c.body,
                    <span key="w" className="muted">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>,
                  ],
                }))}
              />
            )}
          </ViewState>
        </div>
      </section>
    </div>
  );
}
