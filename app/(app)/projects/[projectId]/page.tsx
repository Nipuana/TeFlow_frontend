'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import type { Member, Project, Task, TaskPriority, TaskStatus } from '@/lib/types';
import { dueInfo, dateInputToIso, shortDate } from '@/lib/date';
import { ViewState } from '@/components/ViewState';
import { Ledger } from '@/components/Ledger';
import { StatusTag } from '@/components/StatusTag';
import { KanbanBoard } from '@/components/KanbanBoard';
import { Timeline } from '@/components/Timeline';

type View = 'ledger' | 'board' | 'timeline';
type SortKey = 'created' | 'priority' | 'title' | 'status' | 'due';

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];
const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'critical'];
const PRIORITY_ORDER: Record<TaskPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
const STATUS_ORDER: Record<TaskStatus, number> = { blocked: 0, in_progress: 1, todo: 2, done: 3 };

export default function ProjectDetailPage() {
  const router = useRouter();
  const { user } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const { projectId } = useParams<{ projectId: string }>();
  // Managers manage every project; below manager, editing requires being on the
  // project team (the server enforces both — this just mirrors it for the UI).
  const canManageProject = can.manageProject(user?.role); // manager+
  const canDelete = can.deleteProject(user?.role); // admin+

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('ledger');

  // Filter / sort / search state
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'unassigned' | string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [search, setSearch] = useState('');

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [creating, setCreating] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const nameOf = useMemo(() => {
    const map = new Map(members.map((m) => [m.userId, m.name]));
    return (id?: string | null) => (id ? map.get(id) ?? `${id.slice(0, 8)}…` : 'Unassigned');
  }, [members]);

  // The project TEAM = org members who are on this project. Task assignees are
  // chosen from here; `addable` are org members not yet on the team.
  const teamIds = project?.memberIds ?? [];
  const projectTeam = useMemo(() => members.filter((m) => teamIds.includes(m.userId)), [members, teamIds]);
  const addableMembers = useMemo(() => members.filter((m) => !teamIds.includes(m.userId)), [members, teamIds]);
  const [addPick, setAddPick] = useState('');

  // A manager may edit any project; anyone else must be on this project's team.
  const isProjectMember = user ? teamIds.includes(user.id) : false;
  const canEdit = can.editTask(user?.role) && (canManageProject || isProjectMember);

  // Open the native calendar on a single click anywhere in a date field.
  function openDatePicker(e: React.MouseEvent<HTMLInputElement>) {
    try {
      (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      /* not supported / not a user gesture — the icon still works */
    }
  }

  const [managing, setManaging] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('tf-view') : null;
    if (saved === 'board' || saved === 'ledger' || saved === 'timeline') setView(saved);
  }, []);

  // `c` keyboard shortcut / palette → focus the new-task field.
  useEffect(() => {
    const onQuickCreate = () => titleRef.current?.focus();
    window.addEventListener('tf-quick-create', onQuickCreate);
    return () => window.removeEventListener('tf-quick-create', onQuickCreate);
  }, []);

  function pickView(v: View) {
    setView(v);
    try {
      window.localStorage.setItem('tf-view', v);
    } catch {
      /* ignore */
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ project }, tasksRes, mem] = await Promise.all([
        api<{ project: Project }>(`/projects/${projectId}`),
        api<{ data: Task[] }>(`/projects/${projectId}/tasks`),
        user?.orgId ? api<{ data: Member[] }>(`/orgs/${user.orgId}/members`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setProject(project);
      setTasks(tasksRes.data);
      setMembers(mem.data);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? 'Project not found.' : 'Could not load project.');
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.orgId]);

  useEffect(() => {
    load();
  }, [load]);

  // Derived: filtered + sorted view of the tasks (client-side, instant).
  const visibleTasks = useMemo(() => {
    let list = tasks ?? [];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => t.title.toLowerCase().includes(q));
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== 'all') list = list.filter((t) => t.priority === priorityFilter);
    if (assigneeFilter === 'unassigned') list = list.filter((t) => !t.assigneeId);
    else if (assigneeFilter !== 'all') list = list.filter((t) => t.assigneeId === assigneeFilter);
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'priority':
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        case 'title':
          return a.title.localeCompare(b.title);
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        case 'due':
          // Tasks with a due date first (soonest), then undated.
          return (a.dueDate ? +new Date(a.dueDate) : Infinity) - (b.dueDate ? +new Date(b.dueDate) : Infinity);
        default:
          return +new Date(b.createdAt) - +new Date(a.createdAt);
      }
    });
    return sorted;
  }, [tasks, search, statusFilter, priorityFilter, assigneeFilter, sortKey]);

  const filtersActive =
    statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all' || search.trim() !== '';

  async function submitNewTask() {
    if (!title.trim() || creating) return;
    const startIso = dateInputToIso(startDate);
    const dueIso = dateInputToIso(dueDate);
    if (startIso && dueIso && new Date(startIso) > new Date(dueIso)) {
      toast.error('Start date must be on or before the end date');
      return;
    }
    setCreating(true);
    try {
      const { task } = await api<{ task: Task }>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: {
          title: title.trim(),
          priority,
          ...(assigneeId ? { assigneeId } : {}),
          ...(startIso ? { startDate: startIso } : {}),
          ...(dueIso ? { dueDate: dueIso } : {}),
        },
      });
      setTasks((cur) => [...(cur ?? []), task]);
      setTitle('');
      setPriority('normal');
      setStartDate('');
      setDueDate('');
      setAssigneeId('');
      titleRef.current?.focus(); // keep flow going for rapid entry
      toast.success('Task created');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create task');
    } finally {
      setCreating(false);
    }
  }

  // Generic optimistic field patch — used by inline edits and board drag.
  async function patchTask(taskId: string, patch: Partial<Task>, label = 'Task updated') {
    const prev = tasks;
    setTasks((cur) => cur?.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) ?? cur);
    try {
      await api(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: patch });
      toast.success(label);
    } catch (err) {
      setTasks(prev ?? null);
      toast.error(err instanceof ApiError && err.status === 403 ? 'Your role cannot edit tasks' : 'Update failed — reverted');
    }
  }

  async function deleteTask(taskId: string, taskTitle: string) {
    const ok = await confirm({
      title: 'Delete task?',
      message: `"${taskTitle}" will be permanently removed.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const prev = tasks;
    setTasks((cur) => cur?.filter((t) => t.id !== taskId) ?? cur);
    try {
      await api(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' });
      toast.success('Task deleted');
    } catch (err) {
      setTasks(prev ?? null);
      toast.error(err instanceof ApiError && err.status === 403 ? 'Your role cannot delete tasks' : 'Delete failed — reverted');
    }
  }

  function openManage() {
    setEditName(project?.name ?? '');
    setEditDesc(project?.description ?? '');
    setManaging(true);
  }

  async function saveProject(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { project: updated } = await api<{ project: Project }>(`/projects/${projectId}`, {
        method: 'PATCH',
        body: { name: editName.trim(), description: editDesc.trim() },
      });
      setProject(updated);
      setManaging(false);
      toast.success('Project updated');
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 403 ? 'Your role cannot edit this project' : 'Update failed');
    }
  }

  async function addProjectMember(userId: string) {
    if (!userId) return;
    try {
      const { project: updated } = await api<{ project: Project }>(`/projects/${projectId}/members`, { method: 'POST', body: { userId } });
      setProject(updated);
      setAddPick('');
      toast.success('Member added to project');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add member');
    }
  }

  async function removeProjectMember(userId: string) {
    try {
      const { project: updated } = await api<{ project: Project }>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
      setProject(updated);
      toast.success('Member removed from project');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove member');
    }
  }

  async function deleteProject() {
    const ok = await confirm({
      title: 'Delete project?',
      message: `"${project?.name}" and all its tasks will be permanently removed.`,
      confirmLabel: 'Delete project',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/projects/${projectId}`, { method: 'DELETE' });
      toast.success('Project deleted');
      router.push('/projects');
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 403 ? 'Only an admin/owner can delete a project' : 'Delete failed');
    }
  }

  if (error) {
    return (
      <div className="state" role="alert">
        <div className="k">// error</div>
        <p>{error}</p>
        <button className="btn" onClick={() => router.push('/projects')}>
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <p className="muted" style={{ fontSize: '0.78rem' }}>
            <a onClick={() => router.push('/projects')} style={{ cursor: 'pointer' }}>
              projects
            </a>{' '}
            / <span className="mono-id">{String(projectId).slice(0, 8)}</span>
          </p>
          <h1>{project ? project.name : 'Loading…'}</h1>
          {project?.description && <p className="muted">{project.description}</p>}
        </div>

        <div className="row" style={{ gap: '0.6rem' }}>
          {canManageProject && !managing && (
            <button className="btn" onClick={openManage}>
              Manage
            </button>
          )}
          <div className="segmented" role="group" aria-label="View mode">
            <button aria-pressed={view === 'ledger'} onClick={() => pickView('ledger')}>
              Ledger
            </button>
            <button aria-pressed={view === 'board'} onClick={() => pickView('board')}>
              Board
            </button>
            <button aria-pressed={view === 'timeline'} onClick={() => pickView('timeline')}>
              Timeline
            </button>
          </div>
        </div>
      </div>

      {managing && (
        <form className="panel stack" style={{ padding: '1rem', gap: '0.75rem' }} onSubmit={saveProject}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            project settings
          </div>
          <div className="field">
            <label className="label" htmlFor="pname">
              Name
            </label>
            <input id="pname" className="input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="pdesc">
              Description
            </label>
            <textarea id="pdesc" className="input" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </div>
          <div className="row spread">
            <div className="row" style={{ gap: '0.5rem' }}>
              <button className="btn btn-primary" type="submit" disabled={!editName.trim()}>
                Save
              </button>
              <button className="btn" type="button" onClick={() => setManaging(false)}>
                Cancel
              </button>
            </div>
            {canDelete && (
              <button className="btn btn-danger" type="button" onClick={deleteProject}>
                Delete project
              </button>
            )}
          </div>
        </form>
      )}

      {/* Project team — only org members can be added, chosen from a list. */}
      <section className="panel" style={{ padding: '1.1rem' }}>
        <div className="section-title" style={{ marginBottom: '0.6rem' }}>
          project team
        </div>
        <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
          {projectTeam.length === 0 && <span className="muted" style={{ fontSize: '0.8rem' }}>No members yet.</span>}
          {projectTeam.map((m) => (
            <span key={m.userId} className="chip">
              {m.name}
              {m.userId === project?.createdBy && <span className="muted"> · lead</span>}
              {canManageProject && m.userId !== project?.createdBy && (
                <button className="chip-x" onClick={() => removeProjectMember(m.userId)} aria-label={`Remove ${m.name}`}>
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
        {canManageProject && (
          <div className="row" style={{ gap: '0.5rem', marginTop: '0.75rem' }}>
            <select
              className="input"
              value={addPick}
              onChange={(e) => setAddPick(e.target.value)}
              aria-label="Add member from organization"
              disabled={addableMembers.length === 0}
            >
              <option value="">{addableMembers.length ? 'add member from organization…' : 'everyone is already on the team'}</option>
              {addableMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} · {m.email}
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => addProjectMember(addPick)} disabled={!addPick}>
              Add to project
            </button>
          </div>
        )}
      </section>

      <section>
        <div className="row spread" style={{ alignItems: 'center', marginBottom: '0.6rem' }}>
          <div className="section-title" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {view === 'board' ? 'board' : view === 'timeline' ? 'timeline' : 'task ledger'}
          </div>
          <span className="result-count">
            {visibleTasks.length}/{tasks?.length ?? 0} shown
          </span>
        </div>

        {/* Filter / sort / search bar */}
        <div className="filterbar" style={{ marginBottom: '0.75rem' }}>
          <input
            className="input grow"
            placeholder="search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search tasks"
          />
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status">
            <option value="all">all statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
          <select className="input" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)} aria-label="Filter by priority">
            <option value="all">all priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select className="input" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} aria-label="Filter by assignee">
            <option value="all">anyone</option>
            <option value="unassigned">unassigned</option>
            {projectTeam.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
          <select className="input" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort by">
            <option value="created">sort: newest</option>
            <option value="due">sort: due date</option>
            <option value="priority">sort: priority</option>
            <option value="status">sort: status</option>
            <option value="title">sort: title</option>
          </select>
          {filtersActive && (
            <button
              className="btn"
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setPriorityFilter('all');
                setAssigneeFilter('all');
              }}
            >
              Clear
            </button>
          )}
        </div>

        {view === 'board' ? (
          <ViewState loading={loading} error={null} data={visibleTasks} onRetry={load} empty={<span className="k">// no matching tasks</span>}>
            {(rows) => (
              <KanbanBoard tasks={rows} canEdit={canEdit} nameOf={nameOf} onMove={(id, status) => patchTask(id, { status }, 'Status updated')} onOpen={(id) => router.push(`/projects/${projectId}/tasks/${id}`)} />
            )}
          </ViewState>
        ) : view === 'timeline' ? (
          <ViewState loading={loading} error={null} data={visibleTasks} onRetry={load} empty={<span className="k">// no matching tasks</span>}>
            {(rows) => <Timeline tasks={rows} nameOf={nameOf} onOpen={(id) => router.push(`/projects/${projectId}/tasks/${id}`)} />}
          </ViewState>
        ) : loading ? (
          <div className="panel" style={{ padding: '1.1rem' }}>
            <div className="skeleton" style={{ width: '70%' }} />
          </div>
        ) : (
          <div className="panel" style={{ padding: '0.5rem 0.7rem' }}>
            <Ledger
              columns={['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Start', 'End', '']}
              // Inline "quick add" row lives inside the ledger itself (only for
              // roles that can edit). It aligns cell-for-cell with the columns.
              addRow={
                canEdit
                  ? [
                      <span key="n" className="muted" style={{ fontSize: '0.7rem' }}>
                        new
                      </span>,
                      <input
                        key="t"
                        ref={titleRef}
                        className="input"
                        style={{ width: '100%', minWidth: 140 }}
                        placeholder="new task title  ·  press c"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitNewTask();
                          }
                        }}
                        aria-label="New task title"
                      />,
                      <span key="s" className="muted" style={{ fontSize: '0.72rem' }}>
                        todo
                      </span>,
                      <select
                        key="p"
                        className="inline-select"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as TaskPriority)}
                        aria-label="New task priority"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>,
                      <select
                        key="a"
                        className="inline-select"
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                        aria-label="New task assignee"
                      >
                        <option value="">unassigned</option>
                        {projectTeam.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.name}
                          </option>
                        ))}
                      </select>,
                      <input
                        key="st"
                        className="input"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        onClick={openDatePicker}
                        aria-label="Start date"
                        title="Start date"
                      />,
                      <input
                        key="en"
                        className="input"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        onClick={openDatePicker}
                        aria-label="End date"
                        title="End date"
                      />,
                      <button
                        key="add"
                        className="btn btn-primary"
                        style={{ padding: '0.2rem 0.55rem', fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                        onClick={submitNewTask}
                        disabled={creating || !title.trim()}
                      >
                        {creating ? 'adding…' : 'Add'}
                      </button>,
                    ]
                  : undefined
              }
              rows={visibleTasks.map((t) => {
                const d = dueInfo(t.dueDate, t.status === 'done');
                return {
                  key: t.id,
                  cells: [
                    <span key="id" className="mono-id">
                      {t.id.slice(0, 8)}
                    </span>,
                    <a key="t" onClick={() => router.push(`/projects/${projectId}/tasks/${t.id}`)} style={{ cursor: 'pointer' }}>
                      {t.title}
                    </a>,
                    // Inline status edit (member+), else a static tag.
                    canEdit ? (
                      <select
                        key="s"
                        className="inline-select"
                        value={t.status}
                        onChange={(e) => patchTask(t.id, { status: e.target.value as TaskStatus }, 'Status updated')}
                        aria-label={`Status of ${t.title}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <StatusTag key="s" status={t.status} />
                    ),
                    // Inline priority edit (member+), else static text.
                    canEdit ? (
                      <select
                        key="p"
                        className="inline-select"
                        value={t.priority}
                        onChange={(e) => patchTask(t.id, { priority: e.target.value as TaskPriority }, 'Priority updated')}
                        aria-label={`Priority of ${t.title}`}
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span key="p" className="prio" data-p={t.priority}>
                        {t.priority}
                      </span>
                    ),
                    <span key="as" className={t.assigneeId ? undefined : 'muted'} style={{ fontSize: '0.8rem' }}>
                      {nameOf(t.assigneeId)}
                    </span>,
                    <span key="st" className="mono-id" style={{ fontSize: '0.72rem', color: 'var(--paper-dim)' }}>
                      {shortDate(t.startDate)}
                    </span>,
                    <span
                      key="en"
                      className="mono-id"
                      title={d ? d.label : undefined}
                      style={{ fontSize: '0.72rem', color: d?.overdue ? 'var(--alert)' : d?.soon ? 'var(--phosphor)' : 'var(--paper-dim)' }}
                    >
                      {shortDate(t.dueDate)}
                    </span>,
                    canEdit ? (
                      <button
                        key="d"
                        className="btn btn-danger"
                        style={{ padding: '0.15rem 0.4rem', fontSize: '0.62rem' }}
                        onClick={() => deleteTask(t.id, t.title)}
                        aria-label={`Delete ${t.title}`}
                      >
                        ✕
                      </button>
                    ) : (
                      <span key="d" />
                    ),
                  ],
                };
              })}
            />
            {visibleTasks.length === 0 && (
              <div className="k" style={{ padding: '0.6rem 0.5rem' }}>
                {filtersActive
                  ? '// no matching tasks — try clearing filters'
                  : canEdit
                    ? '// no tasks yet — add one in the “+” row above'
                    : '// no tasks yet'}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
