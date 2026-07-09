'use client';

import { useState } from 'react';
import { api, ApiError, setAccessToken } from '@/lib/api';
import { useSession } from '@/lib/session';

/**
 * Full-screen gate shown when the signed-in account is still on its owner-issued
 * temporary password (`mustChangePassword`). The rest of the app is not rendered
 * until the user sets their own password.
 *
 * This is a UX gate; the backend also flags the account and returns a fresh
 * session on success (rotating the refresh cookie), so we simply swap in the new
 * access token and reload the profile.
 */
export function ForcePasswordChange() {
  const { user, refreshUser, logout } = useSession();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next.length < 10) return setErr('New password must be at least 10 characters.');
    if (next !== confirm) return setErr('New password and confirmation do not match.');
    setBusy(true);
    try {
      const res = await api<{ accessToken: string }>('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: cur, newPassword: next },
      });
      // The server just revoked every old session and minted a new one for this
      // device — adopt its access token so we stay signed in.
      setAccessToken(res.accessToken);
      await refreshUser();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Could not update password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card stack" onSubmit={submit}>
        <div>
          <h1>
            SET <span style={{ color: 'var(--phosphor)' }}>PASSWORD</span>
          </h1>
          <p className="muted prompt" style={{ marginTop: '0.4rem' }}>
            welcome{user?.name ? `, ${user.name}` : ''} — secure your account
          </p>
        </div>

        <div className="banner" data-tone="ok" role="status">
          Your account was created with a temporary password. Choose a new one to continue.
        </div>

        {err && (
          <div className="banner" role="alert">
            {err}
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="cur">
            Temporary password
          </label>
          <input
            id="cur"
            className="input"
            type="password"
            autoComplete="current-password"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="np">
            New password
          </label>
          <input
            id="np"
            className="input"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            Minimum 10 characters.
          </span>
        </div>
        <div className="field">
          <label className="label" htmlFor="cp">
            Confirm new password
          </label>
          <input
            id="cp"
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'saving…' : 'Set password & continue'}
        </button>

        <button className="btn" type="button" onClick={() => logout()} style={{ fontSize: '0.8rem' }}>
          Sign out instead
        </button>
      </form>
    </div>
  );
}
