'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAuthIdsFromJwt } from '@/lib/auth';

export type AuthIds = { tenantId: string; userId: string };

/**
 * Cookie-first auth helper.
 * Many older screens expect a readable JWT (localStorage/cookie) for tenantId/userId.
 * Newer auth uses an HttpOnly cookie, so we fall back to /auth/me.
 */
export function useAuthIds() {
  const [ids, setIds] = useState<AuthIds | null>(() => {
    const legacy = getAuthIdsFromJwt();
    return legacy ? { tenantId: legacy.tenantId, userId: legacy.userId } : null;
  });
  const [loading, setLoading] = useState<boolean>(ids == null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (ids) {
        setLoading(false);
        return;
      }

      try {
        const me = await apiFetch<any>('/auth/me');
        const tenantId = me?.tenantId;
        const userId = me?.id;
        if (!cancelled && tenantId && userId) {
          setIds({ tenantId, userId });
        }
      } catch {
        // apiFetch('/auth/me') will handle redirects on 401.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ids, loading } as const;
}
