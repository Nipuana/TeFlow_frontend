'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';

/** Landing: route to the app if a session bootstraps, otherwise to login. */
export default function Home() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [user, loading, router]);

  return (
    <div className="auth-wrap">
      <div className="muted prompt">booting console…</div>
    </div>
  );
}
