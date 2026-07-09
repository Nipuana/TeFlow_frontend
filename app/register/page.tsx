'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { ApiError } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useSession();
  const [form, setForm] = useState({ name: '', orgName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Client-side hint only — the server re-enforces the real policy.
    if (form.password.length < 10) {
      setPwError('Use at least 10 characters.');
      return;
    }
    setPwError(null);
    setBusy(true);
    try {
      await register(form);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the organization.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card stack" onSubmit={onSubmit}>
        <div>
          <h1>
            NEW <span style={{ color: 'var(--phosphor)' }}>ORG</span>
          </h1>
          <p className="muted prompt" style={{ marginTop: '0.4rem' }}>
            provision workspace
          </p>
        </div>

        {error && (
          <div className="banner" role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input id="name" className="input" value={form.name} onChange={set('name')} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="org">
            Organization name
          </label>
          <input id="org" className="input" value={form.orgName} onChange={set('orgName')} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={set('email')}
            required
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            aria-invalid={Boolean(pwError)}
            aria-describedby="pw-help"
            required
          />
          <span id="pw-help" className={pwError ? 'field-error' : 'muted'} style={{ fontSize: '0.75rem' }}>
            {pwError ?? 'Minimum 10 characters.'}
          </span>
        </div>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'provisioning…' : 'Create organization'}
        </button>

        <p className="muted" style={{ fontSize: '0.8rem' }}>
          Already have one? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
