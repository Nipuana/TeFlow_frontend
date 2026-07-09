/** @type {import('next').NextConfig} */

// The backend origin Next.js reverse-proxies API calls to (server-to-server).
// The BROWSER only ever talks to this Next.js origin, so the httpOnly refresh
// cookie is first-party and is reliably sent back on every reload — no
// cross-origin / SameSite / third-party-cookie pitfalls. Override with
// BACKEND_ORIGIN if the backend isn't on localhost:3000.
const backendOrigin = process.env.BACKEND_ORIGIN || 'http://localhost:3000';

// API calls now go to the SAME origin as the app, so 'self' in connect-src
// covers them. If you deliberately point the client at an absolute
// NEXT_PUBLIC_API_URL to bypass the proxy, its origin is allow-listed too.
const explicitApiOrigin = (() => {
  const v = process.env.NEXT_PUBLIC_API_URL;
  if (!v) return '';
  try {
    return new URL(v).origin;
  } catch {
    return '';
  }
})();

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy + hardening headers (frontend-side defence-in-depth).
 * - default-src 'self': nothing loads from third-party origins by default.
 * - connect-src limited to self (+ an explicit API origin if configured): the
 *   browser can't be tricked into exfiltrating data to an attacker host.
 * - frame-ancestors 'none': clickjacking protection.
 * Dev needs 'unsafe-eval'/'unsafe-inline' for React Fast Refresh; production is
 * tighter. (A nonce-based script-src is the next step for full strictness.)
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' ${isDev ? "'unsafe-eval' 'unsafe-inline'" : "'unsafe-inline'"}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self'`,
  `connect-src 'self'${explicitApiOrigin ? ` ${explicitApiOrigin}` : ''}`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // don't advertise the framework (API8)
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Same-origin reverse proxy: the browser calls /api/v1/* on the Next origin
  // and Next forwards it to the backend (relaying Set-Cookie / Cookie / auth
  // headers transparently). This is what keeps the session alive across reloads.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${backendOrigin}/api/v1/:path*` }];
  },
};

export default nextConfig;
