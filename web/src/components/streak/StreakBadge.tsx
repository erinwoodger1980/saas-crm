"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export function StreakBadge({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    apiFetch<{ dayCount: number }>("/streaks/me", { headers: { "x-tenant-id": tenantId, "x-user-id": userId } })
      .then((d) => live && setCount(d.dayCount))
      .catch(() => live && setCount(0));
    return () => { live = false; };
  }, [tenantId, userId]);

  if (count === null) return null;

  return (
    <div className="fixed top-4 right-4 z-[996]">
      <div className="rounded-full border px-3 py-1 bg-white shadow-sm text-sm flex items-center gap-2">
        <span>🔥</span>
        <span className="font-medium">{count} day{count === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}