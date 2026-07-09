import type { Metadata } from 'next';
import { Space_Mono, IBM_Plex_Mono } from 'next/font/google';
import { SessionProvider } from '@/lib/session';
import { ToastProvider } from '@/components/Toast';
import { ConfirmProvider } from '@/components/Confirm';
import './globals.css';

// Self-hosted at build time by next/font — no external CDN request at runtime,
// which keeps the CSP tight (font-src 'self').
const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Teflow // Console',
  description: 'Audit-first team workspace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No-flash theme init: runs before paint, reads the saved preference (or the
  // OS setting) and stamps data-theme on <html>. Permitted by the CSP
  // (script-src includes 'unsafe-inline'); it touches only the theme attribute.
  const themeInit = `(function(){try{var t=localStorage.getItem('tf-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);var d=localStorage.getItem('tf-density');document.documentElement.setAttribute('data-density',d==='compact'?'compact':'comfortable');}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.setAttribute('data-density','comfortable');}})();`;

  return (
    <html lang="en" className={`${spaceMono.variable} ${plexMono.variable}`} data-theme="dark" data-density="comfortable">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ToastProvider>
          <ConfirmProvider>
            <SessionProvider>{children}</SessionProvider>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
