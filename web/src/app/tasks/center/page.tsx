// web/src/app/tasks/center/page.tsx
"use client";

import { Suspense } from "react";
import { TaskCenter } from "@/components/tasks/TaskCenter";
import { DeskSurface } from "@/components/DeskSurface";

export const dynamic = "force-dynamic";

export default function TaskCenterPage() {
  return (
    <DeskSurface variant="violet" innerClassName="space-y-6">
      <Suspense fallback={<div>Loading…</div>}>
        <TaskCenter />
      </Suspense>
    </DeskSurface>
  );
}
