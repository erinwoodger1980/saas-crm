"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { EndOfDayCelebration } from "@/components/celebration/EndOfDayCelebration";

type Task = { id: string };

function todayKey() {
  const d = new Date();
  return `celebrate_${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

export function CelebrationWatcher({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let t: any;
    async function check() {
      // Don’t re-celebrate the same day
      if (localStorage.getItem(todayKey())) return;

      const now = new Date();
      const after4pm = now.getHours() >= 16;

      // Only celebrate after 4pm local time
      if (!after4pm) return;

      // Ask API for “my tasks due today and still open”
      const qs = new URLSearchParams({ status: "OPEN", mine: "true", due: "today" });
      const data = await apiFetch<{ items: Task[] }>(`/tasks?${qs}`, {
        headers: { "x-tenant-id": tenantId, "x-user-id": userId },
      });

      if ((data.items?.length ?? 0) === 0) {
        setOpen(true);
        localStorage.setItem(todayKey(), "1");
      }
    }

    // check soon on mount, then every minute
    check().catch(() => {});
    t = setInterval(() => check().catch(() => {}), 60_000);
    return () => clearInterval(t);
  }, [tenantId, userId]);

  return <EndOfDayCelebration open={open} onClose={() => setOpen(false)} />;
}