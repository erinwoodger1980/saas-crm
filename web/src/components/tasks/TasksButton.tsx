"use client";

import { useEffect, useState } from "react";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { TasksDrawer } from "./TasksDrawer";
import { StreakBadge } from "@/components/streak/StreakBadge";
import { CelebrationWatcher } from "./CelebrationWatcher";

export function TasksButton() {
  const [ids, setIds] = useState<{ tenantId: string; userId: string } | null>(null);

  useEffect(() => {
    function sync() { setIds(getAuthIdsFromJwt()); }
    sync();
    const t = setTimeout(sync, 800); // in case DevAuth seeds after first render
    return () => clearTimeout(t);
  }, []);

  if (!ids) return null;

  return (
    <>
      {/* Streak bubble */}
      <StreakBadge tenantId={ids.tenantId} userId={ids.userId} />
      {/* Celebration (checks quietly) */}
      <CelebrationWatcher tenantId={ids.tenantId} userId={ids.userId} />
      {/* Floating “My Tasks” button */}
      <div className="fixed bottom-6 right-6 z-[997]">
        <TasksDrawer tenantId={ids.tenantId} userId={ids.userId} />
      </div>
    </>
  );
}