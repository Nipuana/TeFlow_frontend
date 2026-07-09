'use client';

import { useMemo } from 'react';
import type { Task } from '@/lib/types';
import { dueInfo } from '@/lib/date';
import { StatusTag } from './StatusTag';

/**
 * Timeline view — tasks grouped into deadline buckets, each bucket ordered by
 * due date. Gives an at-a-glance sense of what's overdue, due now, and coming
 * up, without a heavy Gantt chart.
 */
interface Props {
  tasks: Task[];
  nameOf: (id?: string | null) => string;
  onOpen: (taskId: string) => void;
}

type BucketKey = 'overdue' | 'today' | 'week' | 'later' | 'none';
const BUCKET_LABELS: Record<BucketKey, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  week: 'Next 7 days',
  later: 'Later',
  none: 'No due date',
};
const ORDER: BucketKey[] = ['overdue', 'today', 'week', 'later', 'none'];

function bucketOf(task: Task): BucketKey {
  if (!task.dueDate) return 'none';
  const done = task.status === 'done';
  const days = Math.round((new Date(task.dueDate).getTime() - Date.now()) / 86_400_000);
  if (!done && days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days > 0 && days <= 7) return 'week';
  return 'later';
}

export function Timeline({ tasks, nameOf, onOpen }: Props) {
  const groups = useMemo(() => {
    const map: Record<BucketKey, Task[]> = { overdue: [], today: [], week: [], later: [], none: [] };
    for (const t of tasks) map[bucketOf(t)].push(t);
    for (const key of ORDER) {
      map[key].sort((a, b) => (a.dueDate ? +new Date(a.dueDate) : Infinity) - (b.dueDate ? +new Date(b.dueDate) : Infinity));
    }
    return map;
  }, [tasks]);

  return (
    <div className="timeline">
      {ORDER.filter((k) => groups[k].length > 0).map((key) => (
        <section key={key} className="tl-group">
          <div className="tl-head" data-bucket={key}>
            <span className="tl-dot" aria-hidden />
            {BUCKET_LABELS[key]} <span className="muted">· {groups[key].length}</span>
          </div>
          <div className="tl-items">
            {groups[key].map((t) => {
              const d = dueInfo(t.dueDate, t.status === 'done');
              return (
                <button key={t.id} className="tl-item" onClick={() => onOpen(t.id)}>
                  <span className="tl-title">{t.title}</span>
                  <span className="row" style={{ gap: '0.6rem' }}>
                    <StatusTag status={t.status} />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>
                      {nameOf(t.assigneeId)}
                    </span>
                    {d && (
                      <span
                        className="mono-id"
                        style={{ fontSize: '0.72rem', color: d.overdue ? 'var(--alert)' : d.soon ? 'var(--phosphor)' : 'var(--paper-dim)' }}
                      >
                        {d.label}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
