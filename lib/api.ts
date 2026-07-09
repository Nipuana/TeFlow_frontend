import type { ApiErrorShape } from './types';

/**
 * Secure API client.
 *
 * SECURITY MODEL (frontend side of OWASP):
 *   - The access token is held in a MODULE-SCOPED variable (memory only). It is
 *     never written to localStorage/sessionStorage, so an XSS payload can't read
 *     it back out.
 *   - The refresh token is an httpOnly, SameSite cookie set by the backend — not
 *     readable by JS at all. We send it automatically via `credentials:'include'`.
 *   - On a 401 we transparently try ONE refresh (rotating the refresh cookie) and
 *     replay the request. If that fails, the session is over.
 *   - This client makes NO authorization decisions. It just carries the token;
 *     the server decides what the caller may do.
 */
// Default to a SAME-ORIGIN path: the browser hits `/api/v1/*` on the Next.js
// origin, which reverse-proxies to the backend (see next.config.mjs `rewrites`).
// Keeping it same-origin makes the httpOnly refresh cookie first-party, so it is
// reliably sent on reload and the session survives. Set NEXT_PUBLIC_API_URL to
// an absolute URL only if you intentionally want to bypass the proxy.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, body: ApiErrorShape) {
    super(body?.message || 'Request failed');
    this.status = status;
    this.code = body?.code || 'ERROR';
    this.details = body?.details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** internal: prevents infinite refresh recursion */
  _retry?: boolean;
}

async function raw(path: string, opts: RequestOptions = {}): Promise<Response> {
  return fetch(API_URL + path, {
    method: opts.method || 'GET',
    credentials: 'include', // send/receive the httpOnly refresh cookie
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

/**
 * Attempt a silent refresh; returns true if a new access token was set.
 *
 * SINGLE-FLIGHT: concurrent callers share ONE in-flight request. This matters a
 * lot with refresh-token ROTATION + reuse-detection: the refresh cookie is
 * single-use and rotated on every call, so firing two refreshes with the same
 * cookie makes the backend see the second as a REUSED token and revoke the whole
 * session (logging the user out). React StrictMode's double-mounted bootstrap
 * effect and bursts of 401 retries would otherwise do exactly that on reload.
 */
let refreshInFlight: Promise<boolean> | null = null;

export function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(API_URL + '/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      const data = await res.json();
      accessToken = data.accessToken ?? null;
      return Boolean(accessToken);
    } catch {
      accessToken = null;
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await raw(path, opts);

  // Transparently refresh once on expiry, then replay.
  if (res.status === 401 && !opts._retry && accessToken !== null) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await raw(path, { ...opts, _retry: true });
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, (data?.error ?? { message: 'Request failed' }) as ApiErrorShape);
  }
  return data as T;
}

/** Common auth-refresh-retry wrapper for non-JSON requests (uploads / blobs). */
async function withAuthRetry(send: () => Promise<Response>): Promise<Response> {
  let res = await send();
  if (res.status === 401 && accessToken !== null) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await send();
  }
  return res;
}

/** POST multipart/form-data (e.g. a profile-picture upload). The browser sets
 *  the multipart boundary — we must NOT set Content-Type ourselves. */
export async function apiUpload<T = unknown>(path: string, formData: FormData): Promise<T> {
  const send = () =>
    fetch(API_URL + path, {
      method: 'POST',
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      body: formData,
    });
  const res = await withAuthRetry(send);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, (data?.error ?? { message: 'Upload failed' }) as ApiErrorShape);
  return data as T;
}

/** GET binary content (e.g. an avatar image) as a Blob, or null if not found. */
export async function apiBlob(path: string): Promise<Blob | null> {
  const send = () =>
    fetch(API_URL + path, {
      method: 'GET',
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
  const res = await withAuthRetry(send);
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, { message: 'Request failed' } as ApiErrorShape);
  return res.blob();
}
