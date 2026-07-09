'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { can, atLeast, ROLE_LABEL, ROLE_BLURB } from '@/lib/permissions';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import type { Member, Role } from '@/lib/types';
import { ViewState } from '@/components/ViewState';
import { Ledger } from '@/components/Ledger';

// Roles the owner may assign / provision (owner is never assignable here).
const ASSIGNABLE: Role[] = ['employee', 'manager', 'admin'];

export default function MembersPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [creating, setCreating] = useState(false);
  // The one-time temporary password to hand to the new user, shown once.
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const isAdmin = can.manageMembers(user?.role);
  const isOwner = atLeast(user?.role, 'owner');

  const load = useCallback(async () => {
    if (!user?.orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Member[] }>(`/orgs/${user.orgId}/members`);
      setMembers(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403 ? 'You do not have access to members.' : 'Could not load members.',
      );
    } finally {
      setLoading(false);
    }
  }, [user?.orgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.orgId || !name.trim() || !email.trim()) return;
    setCreating(true);
    setIssued(null);
    try {
      const res = await api<{ member: Member; temporaryPassword: string }>(`/orgs/${user.orgId}/members`, {
        method: 'POST',
        body: { name: name.trim(), email: email.trim().toLowerCase(), role },
      });
      setIssued({ email: res.member.email, password: res.temporaryPassword });
      setName('');
      setEmail('');
      setRole('employee');
      toast.success('Account created');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create account');
    } finally {
      setCreating(false);
    }
  }

  async function changeRole(userId: string, newRole: Role) {
    if (!user?.orgId) return;
    try {
      await api(`/orgs/${user.orgId}/members/role`, { method: 'PUT', body: { userId, role: newRole } });
      toast.success('Role updated');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update role');
      await load();
    }
  }

  const confirm = useConfirm();

  async function viewPassword(m: Member) {
    if (!user?.orgId) return;
    try {
      const res = await api<{ changed: boolean; temporaryPassword: string | null }>(
        `/orgs/${user.orgId}/members/${m.userId}/temp-password`,
      );
      if (res.changed) {
        toast.success(`${m.name} has already set their own password`);
        await load();
      } else if (res.temporaryPassword) {
        setIssued({ email: m.email, password: res.temporaryPassword });
      } else {
        toast.error('Temporary password is unavailable — reset it to issue a new one');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not fetch the password');
    }
  }

  async function resetPassword(m: Member) {
    if (!user?.orgId) return;
    const ok = await confirm({
      title: `Reset password for ${m.name}?`,
      message: 'Their current password stops working immediately and any active sessions are signed out.',
      confirmLabel: 'Reset password',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api<{ temporaryPassword: string }>(`/orgs/${user.orgId}/members/${m.userId}/reset-password`, {
        method: 'POST',
        body: {},
      });
      setIssued({ email: m.email, password: res.temporaryPassword });
      toast.success('Password reset');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not reset password');
    }
  }

  async function removeMember(m: Member) {
    if (!user?.orgId) return;
    const ok = await confirm({
      title: `Remove ${m.name}?`,
      message: 'They lose access to the organization immediately. This cannot be undone.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/orgs/${user.orgId}/members/${m.userId}`, { method: 'DELETE' });
      toast.success('Member removed');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove member');
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  }

  if (error) {
    return (
      <div className="state" role="alert">
        <div className="k">// error</div>
        <p>{error}</p>
        <button className="btn" onClick={() => router.push('/dashboard')}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      <div>
        <h1>Team &amp; accounts</h1>
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          {isOwner
            ? 'Create accounts, assign roles, and reset passwords for your organization.'
            : isAdmin
              ? 'Manage member roles for your organization.'
              : 'People in your organization.'}
        </p>
      </div>

      {/* One-time credential reveal (create account / reset password). */}
      {issued && (
        <div className="panel" style={{ padding: '1rem', borderColor: 'var(--phosphor)' }}>
          <div className="section-title" style={{ color: 'var(--phosphor)' }}>
            temporary password — shown once
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Share this with <strong>{issued.email}</strong> over a secure channel. They must change it on first login.
          </p>
          <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
            <code
              className="mono-id"
              style={{ background: 'var(--void)', padding: '0.5rem 0.75rem', border: '1px solid var(--line)', flex: 1 }}
            >
              {issued.password}
            </code>
            <button className="btn" onClick={() => copy(issued.password)}>
              Copy
            </button>
            <button className="btn" onClick={() => setIssued(null)} aria-label="Dismiss">
              Done
            </button>
          </div>
        </div>
      )}

      {isOwner && (
        <form className="panel stack" style={{ padding: '1.1rem', gap: '0.75rem' }} onSubmit={createAccount}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            create account
          </div>
          <div className="row" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ flex: '1 1 160px' }}
              placeholder="full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="New member name"
            />
            <input
              className="input"
              style={{ flex: '1 1 200px' }}
              type="email"
              placeholder="person@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="New member email"
            />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
              {ASSIGNABLE.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" type="submit" disabled={creating || !name.trim() || !email.trim()}>
              {creating ? 'creating…' : 'Create account'}
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.72rem' }}>
            {ROLE_BLURB[role]}. A one-time password is generated; the user is forced to change it on first login.
          </p>
        </form>
      )}

      <section>
        <div className="section-title">people</div>
        <div className="panel" style={{ padding: '0.5rem 0.7rem' }}>
          <ViewState
            loading={loading}
            error={null}
            data={members}
            onRetry={load}
            empty={<span className="k">// no members</span>}
          >
            {(rows) => (
              <Ledger
                columns={['Name', 'Email', 'Role', 'Status', 'Joined', '']}
                rows={rows.map((m) => ({
                  key: m.userId,
                  cells: [
                    <span key="n">
                      {m.name} {m.userId === user?.id && <span className="muted">(you)</span>}
                    </span>,
                    <span key="e" className="muted">
                      {m.email}
                    </span>,
                    // Owner can change roles inline (except owner/self); others see a label.
                    isOwner && m.userId !== user?.id && m.role !== 'owner' ? (
                      <select
                        key="r"
                        className="inline-select"
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value as Role)}
                        aria-label={`Role of ${m.name}`}
                      >
                        {ASSIGNABLE.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        key="r"
                        style={{ color: 'var(--phosphor)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}
                      >
                        {ROLE_LABEL[m.role]}
                      </span>
                    ),
                    <span key="st" style={{ fontSize: '0.72rem' }}>
                      {m.pendingPasswordChange ? (
                        <span className="tag" data-tone="signal">
                          PENDING SETUP
                        </span>
                      ) : (
                        <span className="muted">active</span>
                      )}
                    </span>,
                    <span key="j" className="muted">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </span>,
                    <span key="a" className="row" style={{ gap: '0.35rem', justifyContent: 'flex-end' }}>
                      {isOwner && m.userId !== user?.id && m.role !== 'owner' && m.pendingPasswordChange && (
                        <button
                          className="btn"
                          style={{ padding: '0.15rem 0.45rem', fontSize: '0.66rem' }}
                          onClick={() => viewPassword(m)}
                          title="Show the temporary password (still unused)"
                        >
                          View pw
                        </button>
                      )}
                      {isOwner && m.userId !== user?.id && m.role !== 'owner' && (
                        <button
                          className="btn"
                          style={{ padding: '0.15rem 0.45rem', fontSize: '0.66rem' }}
                          onClick={() => resetPassword(m)}
                        >
                          Reset pw
                        </button>
                      )}
                      {isAdmin && m.userId !== user?.id && m.role !== 'owner' && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.15rem 0.45rem', fontSize: '0.66rem' }}
                          onClick={() => removeMember(m)}
                        >
                          Remove
                        </button>
                      )}
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
