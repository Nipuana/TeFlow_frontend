'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password, mfaRequired ? mfaCode : undefined);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setError('Enter your 6-digit MFA code to continue.');
      } else {
        // Generic message — the server does not reveal which field was wrong.
        setError('Invalid credentials. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card stack" onSubmit={onSubmit}>
        <div>
          <h1>
            TE<span style={{ color: 'var(--phosphor)' }}>FLOW</span>
          </h1>
          <p className="muted prompt" style={{ marginTop: '0.4rem' }}>
            authenticate
          </p>
        </div>

        {error && (
          <div className="banner" data-tone={mfaRequired ? 'ok' : undefined} role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {mfaRequired && (
          <div className="field">
            <label className="label" htmlFor="mfa">
              MFA code
            </label>
            <input
              id="mfa"
              className="input"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              aria-describedby="mfa-help"
            />
            <span id="mfa-help" className="muted" style={{ fontSize: '0.75rem' }}>
              6 digits from your authenticator app
            </span>
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'authenticating…' : 'Sign in'}
        </button>

        <p className="muted" style={{ fontSize: '0.8rem' }}>
          No account? <Link href="/register">Create org</Link>
        </p>
      </form>
    </div>
  );
}
