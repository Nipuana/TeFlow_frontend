'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@/lib/types';
import { dueInfo } from '@/lib/date';

/**
 * Trello-style board. Tasks are grouped into status columns; dragging a card to
 * another column changes its status.
 *
 * SECURITY: the board makes NO authorization decision. `canEdit` only controls
 * whether cards are draggable (a UX affordance) — the actual move calls the
 * parent's `onMove`, which hits the authorized PATCH endpoint. A viewer who
 * forges the request is still rejected server-side (API1/API5). The parent also
 * applies the move optimistically and rolls back if the server refuses.
 *
 * Accessibility: dragging is mouse-only, so each card also carries a keyboard-
 * reachable "move" <select>; status is shown as text (not color alone).
 */
const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'TODO' },
  { status: 'in_progress', label: 'IN PROGRESS' },
  { status: 'blocked', label: 'BLOCKED' },
  { status: 'done', label: 'DONE' },
];

interface Props {
  tasks: Task[];
  canEdit: boolean;
  onMove: (taskId: string, status: TaskStatus) => void;
  onOpen: (taskId: string) => void;
  nameOf?: (id?: string | null) => string;
}

export function KanbanBoard({ tasks, canEdit, onMove, onOpen, nameOf }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  function drop(status: TaskStatus) {
    if (dragId) onMove(dragId, status);
    setDragId(null);
    setOverCol(null);
  }

  return (
    <div className="board">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.status);
        return (
          <section
            key={col.status}
            className="board-col"
            data-over={overCol === col.status || undefined}
            onDragOver={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              setOverCol(col.status);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.status ? null : c))}
            onDrop={() => canEdit && drop(col.status)}
            aria-label={`${col.label} column`}
          >
            <header className="board-col-head">
              <span className="k tag" data-state={col.status}>
                [{col.label}]
              </span>
              <span className="count">{String(items.length).padStart(2, '0')}</span>
            </header>

            <div className="board-col-body">
              {items.length === 0 && <span className="muted" style={{ fontSize: '0.72rem' }}>—</span>}
              {items.map((t) => (
                <article
                  key={t.id}
                  className="card"
                  draggable={canEdit}
                  data-dragging={dragId === t.id || undefined}
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverCol(null);
                  }}
                  onClick={() => onOpen(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpen(t.id);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Task ${t.title}, status ${col.label}`}
                >
                  <div className="card-title">{t.title}</div>
                  <div className="card-meta">
                    <span className="card-id">{nameOf ? nameOf(t.assigneeId) : t.id.slice(0, 8)}</span>
                    <span className="prio" data-p={t.priority}>
                      {t.priority}
                    </span>
                  </div>
                  {(() => {
                    const d = dueInfo(t.dueDate, t.status === 'done');
                    return d ? (
                      <div
                        className="card-id"
                        style={{ marginTop: '0.3rem', color: d.overdue ? 'var(--alert)' : d.soon ? 'var(--phosphor)' : 'var(--paper-dim)' }}
                      >
                        {d.label}
                      </div>
                    ) : null;
                  })()}

                  {canEdit && (
                    <div className="card-meta" onClick={(e) => e.stopPropagation()}>
                      <label className="card-id" htmlFor={`mv-${t.id}`}>
                        move →
                      </label>
                      <select
                        id={`mv-${t.id}`}
                        className="card-move"
                        value={t.status}
                        onChange={(e) => onMove(t.id, e.target.value as TaskStatus)}
                        aria-label={`Move ${t.title} to another status`}
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.status} value={c.status}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
