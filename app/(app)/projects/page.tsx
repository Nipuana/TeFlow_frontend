'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import type { Project } from '@/lib/types';
import { ViewState } from '@/components/ViewState';
import { Ledger } from '@/components/Ledger';
import { RoleGate } from '@/components/RoleGate';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

interface Paged<T> {
  data: T[];
}

export default function ProjectsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const seesAll = can.seeAllProjects(user?.role);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onQuickCreate = () => nameRef.current?.focus();
    window.addEventListener('tf-quick-create', onQuickCreate);
    return () => window.removeEventListener('tf-quick-create', onQuickCreate);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<Paged<Project>>('/projects?limit=100');
      setProjects(res.data);
    } catch {
      setError('Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api('/projects', {
        method: 'POST',
        body: { name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) },
      });
      setName('');
      setDescription('');
      await load();
      toast.success('Project created');
      nameRef.current?.focus();
    } catch (err) {
      // The server is the authority — a 403 here means the role can't create.
      toast.error(err instanceof ApiError ? err.message : 'Could not create project');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      <div>
        <h1>Projects</h1>
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          {seesAll ? 'All projects in your organization.' : 'Projects you are a member of.'}
        </p>
      </div>

      {/* UX gate: only render the create control for manager+ (server still enforces). */}
      <RoleGate min="manager">
        <form className="panel stack" style={{ padding: '1.1rem', gap: '0.75rem' }} onSubmit={createProject}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            new project
          </div>
          <input
            ref={nameRef}
            className="input"
            placeholder="project name  ·  press c to focus"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New project name"
          />
          <textarea
            className="input"
            placeholder="description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Project description"
            style={{ minHeight: '3.5rem' }}
          />
          <div>
            <button className="btn btn-primary" type="submit" disabled={creating || !name.trim()}>
              {creating ? 'creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </RoleGate>

      <section>
        <div className="section-title">ledger</div>
        <div className="panel" style={{ padding: '0.5rem 0.7rem' }}>
          <ViewState
            loading={loading}
            error={error}
            data={projects}
            onRetry={load}
            empty={
              <span className="k">
                {can.createProject(user?.role)
                  ? '// no projects — create the first one above'
                  : "// no projects yet — a manager will add you to a project's team"}
              </span>
            }
          >
            {(rows) => (
              <Ledger
                columns={['ID', 'Name', 'Description', 'Created']}
                rows={rows.map((p) => ({
                  key: p.id,
                  onClick: () => router.push(`/projects/${p.id}`),
                  cells: [
                    <span key="id" className="mono-id">
                      {p.id.slice(0, 8)}
                    </span>,
                    p.name,
                    <span key="d" className="muted">
                      {p.description || '—'}
                    </span>,
                    <span key="c" className="muted">
                      {new Date(p.createdAt).toLocaleDateString()}
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
