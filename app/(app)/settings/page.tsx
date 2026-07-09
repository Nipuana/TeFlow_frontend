'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiUpload, apiBlob, ApiError, setAccessToken } from '@/lib/api';
import { useSession } from '@/lib/session';
import { RoleGate } from '@/components/RoleGate';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';

type Tab = 'profile' | 'security';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <h1>Settings</h1>

      <div className="tabs" role="tablist" aria-label="Settings sections">
        <button className="tab" role="tab" aria-selected={tab === 'profile'} onClick={() => setTab('profile')}>
          Profile
        </button>
        <button className="tab" role="tab" aria-selected={tab === 'security'} onClick={() => setTab('security')}>
          Security
        </button>
      </div>

      {tab === 'profile' ? <ProfileTab /> : <SecurityTab />}
    </div>
  );
}

function ProfileTab() {
  const { user, refreshUser } = useSession();
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Profile picture (multipart upload) ──────────────────────────────────
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Load the stored avatar as a blob (the endpoint is Bearer-auth'd, so an <img
  // src> can't carry the token — we fetch bytes and use an object URL instead).
  const loadAvatar = useCallback(async () => {
    if (!user?.hasAvatar) {
      setAvatarSrc(null);
      return;
    }
    try {
      const blob = await apiBlob(`/auth/me/avatar?t=${Date.now()}`);
      if (blob) setAvatarSrc(URL.createObjectURL(blob));
    } catch {
      /* leave placeholder */
    }
  }, [user?.hasAvatar]);

  useEffect(() => {
    loadAvatar();
  }, [loadAvatar]);

  // Revoke the previous object URL whenever it changes / on unmount (no leaks).
  useEffect(() => {
    return () => {
      if (avatarSrc) URL.revokeObjectURL(avatarSrc);
    };
  }, [avatarSrc]);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    setErr(null);
    setMsg(null);
    if (!/^image\/(png|jpe?g|gif)$/i.test(file.type)) {
      setErr('Please choose a PNG, JPEG, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('Image must be under 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await apiUpload('/auth/me/avatar', fd);
      await refreshUser(); // flips hasAvatar so the rest of the app knows
      // Show it immediately (cache-busted); we just uploaded so it exists.
      const blob = await apiBlob(`/auth/me/avatar?t=${Date.now()}`);
      setAvatarSrc(blob ? URL.createObjectURL(blob) : null);
      setMsg('Profile picture updated.');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      const setFromUrl = Boolean(avatarUrl.trim());
      const body: Record<string, string> = { name: name.trim(), bio: bio.trim() };
      if (setFromUrl) body.avatarUrl = avatarUrl.trim();
      await api('/auth/me', { method: 'PATCH', body });
      await refreshUser(); // updates name/bio everywhere (sidebar, command bar) via context
      // If the avatar was (re)set from a URL, refresh the preview immediately too.
      if (setFromUrl) {
        const blob = await apiBlob(`/auth/me/avatar?t=${Date.now()}`);
        setAvatarSrc(blob ? URL.createObjectURL(blob) : null);
      }
      setAvatarUrl('');
      setMsg('Profile saved.');
    } catch (e2) {
      // A blocked avatar URL (internal/SSRF) comes back as 400 from the guard.
      setErr(e2 instanceof ApiError ? e2.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" style={{ gap: '1rem', maxWidth: 420 }} onSubmit={save}>
      <div className="field">
        <span className="label">Profile picture</span>
        <div className="row" style={{ gap: '1rem', alignItems: 'center' }}>
          <div className="avatar-lg" aria-hidden>
            {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{initials}</span>}
          </div>
          <div className="stack" style={{ gap: '0.4rem' }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif"
              onChange={onPickAvatar}
              style={{ display: 'none' }}
              aria-label="Choose a profile picture"
            />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'uploading…' : avatarSrc ? 'Change picture' : 'Upload picture'}
            </button>
            <span className="muted" style={{ fontSize: '0.72rem' }}>
              PNG, JPEG, or GIF · up to 5 MB
            </span>
          </div>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="name">
          Name
        </label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="field">
        <label className="label" htmlFor="bio">
          Bio
        </label>
        <textarea
          id="bio"
          className="input"
          placeholder="say something about yourself…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="avatar">
          Or set avatar from an image URL
        </label>
        <input
          id="avatar"
          className="input"
          placeholder="https://…"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          aria-describedby="avatar-help"
        />
        <span id="avatar-help" className="muted" style={{ fontSize: '0.75rem' }}>
          fetched server-side; internal addresses are blocked
        </span>
      </div>

      <div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'saving…' : 'Save changes'}
        </button>
      </div>

      {msg && (
        <div className="banner" data-tone="ok">
          {msg}
        </div>
      )}
      {err && (
        <div className="banner" role="alert">
          {err}
        </div>
      )}
    </form>
  );
}

function SecurityTab() {
  const { user, refreshUser } = useSession();
  // Bumped after any change that affects sessions, so the sessions list re-fetches.
  const [sessionsReloadKey, setSessionsReloadKey] = useState(0);
  const bumpSessions = () => setSessionsReloadKey((k) => k + 1);
  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      <MfaSection
        enabled={!!user?.mfaEnabled}
        onChange={async () => {
          await refreshUser();
          bumpSessions();
        }}
      />
      <SessionsSection reloadKey={sessionsReloadKey} />
      <PasswordSection onChanged={bumpSessions} />
      <RoleGate min="owner">
        <section className="panel" style={{ padding: '1rem', borderColor: 'var(--alert)' }}>
          <div className="section-title" style={{ color: 'var(--alert)' }}>
            danger zone
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            Deleting the organization is owner-only and requires step-up re-authentication. Fully gated server-side
            (API5/API6).
          </p>
          <button className="btn btn-danger" disabled title="Requires step-up re-auth flow">
            Delete organization
          </button>
        </section>
      </RoleGate>
    </div>
  );
}

interface SessionInfo {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  userAgent: string;
  ip: string;
  current: boolean;
}

function friendlyAgent(ua: string): string {
  if (/edg/i.test(ua)) return 'Edge';
  if (/chrome/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  if (/curl/i.test(ua)) return 'curl';
  if (/node/i.test(ua)) return 'Node';
  return ua.slice(0, 28) || 'Unknown device';
}

function SessionsSection({ reloadKey = 0 }: { reloadKey?: number }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: SessionInfo[] }>('/auth/sessions');
      setSessions(res.data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload on mount and whenever `reloadKey` changes (e.g. after a password
  // change revokes the other sessions).
  useEffect(() => {
    load();
  }, [load, reloadKey]);

  async function revoke(s: SessionInfo) {
    const ok = await confirm({
      title: 'Sign out this session?',
      message: `${friendlyAgent(s.userAgent)} · ${s.ip}`,
      confirmLabel: 'Sign out',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/auth/sessions/${s.id}`, { method: 'DELETE' });
      toast.success('Session signed out');
      await load();
    } catch {
      toast.error('Could not sign out session');
    }
  }

  async function signOutOthers() {
    const ok = await confirm({
      title: 'Sign out everywhere else?',
      message: 'All other sessions will be revoked. This session stays signed in.',
      confirmLabel: 'Sign out others',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api<{ revoked: number }>('/auth/sessions/sign-out-others', { method: 'POST', body: {} });
      toast.success(`Signed out ${res.revoked} other session${res.revoked === 1 ? '' : 's'}`);
      await load();
    } catch {
      toast.error('Could not sign out other sessions');
    }
  }

  const others = (sessions ?? []).filter((s) => !s.current).length;

  return (
    <section className="panel" style={{ padding: '1rem' }}>
      <div className="row spread" style={{ alignItems: 'center' }}>
        <div className="section-title" style={{ marginBottom: 0, borderBottom: 'none' }}>
          active sessions
        </div>
        <button className="btn" onClick={signOutOthers} disabled={others === 0}>
          Sign out everywhere else
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ marginTop: '0.75rem', width: '70%' }} />
      ) : sessions && sessions.length > 0 ? (
        <div className="feed" style={{ marginTop: '0.75rem' }}>
          {sessions.map((s) => (
            <div key={s.id} className="row spread feed-item" style={{ alignItems: 'center' }}>
              <div>
                <div>
                  {friendlyAgent(s.userAgent)}{' '}
                  {s.current && <span className="tag" data-tone="signal">[THIS DEVICE]</span>}
                </div>
                <span className="when" style={{ display: 'block', color: 'var(--paper-dim)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                  <span className="mono-id">{s.ip}</span> · last used {new Date(s.lastUsedAt).toLocaleString()}
                </span>
              </div>
              {!s.current && (
                <button
                  className="btn btn-danger"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.66rem' }}
                  onClick={() => revoke(s)}
                >
                  Sign out
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>
          No other active sessions.
        </p>
      )}
    </section>
  );
}

function MfaSection({ enabled, onChange }: { enabled: boolean; onChange: () => Promise<void> }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function begin() {
    setErr(null);
    try {
      const res = await api<{ secret: string; otpauthUri: string }>('/auth/mfa/enrol', { method: 'POST', body: {} });
      setSecret(res.secret);
    } catch {
      setErr('Could not start MFA enrolment.');
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api('/auth/mfa/confirm', { method: 'POST', body: { mfaCode: code } });
      setMsg('MFA enabled.');
      setSecret(null);
      setCode('');
      await onChange();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Invalid code.');
    }
  }

  return (
    <section className="panel" style={{ padding: '1rem' }}>
      <div className="section-title">multi-factor auth</div>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Status:{' '}
        <span style={{ color: enabled ? 'var(--ok)' : 'var(--paper-dim)' }}>{enabled ? '[ENABLED]' : '[DISABLED]'}</span>
      </p>
      {!enabled && !secret && (
        <button className="btn btn-primary" onClick={begin}>
          Enrol MFA
        </button>
      )}
      {secret && (
        <form className="stack" style={{ gap: '0.6rem', marginTop: '0.5rem' }} onSubmit={confirm}>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            Add this secret to your authenticator app, then enter a code to confirm:
          </p>
          <code
            className="mono-id"
            style={{ background: 'var(--void)', padding: '0.5rem', border: '1px solid var(--line)', wordBreak: 'break-all' }}
          >
            {secret}
          </code>
          <div className="field">
            <label className="label" htmlFor="mfa-confirm">
              6-digit code
            </label>
            <input id="mfa-confirm" className="input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">
            Confirm & enable
          </button>
        </form>
      )}
      {msg && (
        <div className="banner" data-tone="ok" style={{ marginTop: '0.6rem' }}>
          {msg}
        </div>
      )}
      {err && (
        <div className="banner" role="alert" style={{ marginTop: '0.6rem' }}>
          {err}
        </div>
      )}
    </section>
  );
}

function PasswordSection({ onChanged }: { onChanged?: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (next.length < 10) {
      setErr('New password must be at least 10 characters.');
      return;
    }
    try {
      const res = await api<{ accessToken: string }>('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: cur, newPassword: next },
      });
      // Backend revoked every session and issued a fresh one for this device.
      if (res?.accessToken) setAccessToken(res.accessToken);
      setMsg('Password changed. All other sessions were signed out.');
      setCur('');
      setNext('');
      onChanged?.(); // refresh the active-sessions list to reflect the revocations
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Could not change password.');
    }
  }

  return (
    <section className="panel" style={{ padding: '1rem' }}>
      <div className="section-title">change password</div>
      <form className="stack" style={{ gap: '0.6rem', maxWidth: 360 }} onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="cur">
            Current password
          </label>
          <input id="cur" className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="np">
            New password
          </label>
          <input id="np" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">
          Update password
        </button>
      </form>
      {msg && (
        <div className="banner" data-tone="ok" style={{ marginTop: '0.6rem' }}>
          {msg}
        </div>
      )}
      {err && (
        <div className="banner" role="alert" style={{ marginTop: '0.6rem' }}>
          {err}
        </div>
      )}
    </section>
  );
}
