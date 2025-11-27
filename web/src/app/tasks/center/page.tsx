// web/src/app/tasks/center/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { TaskCenter } from "@/components/tasks/TaskCenter";
import { MobileTaskCenter } from "@/components/tasks/MobileTaskCenter";
import { DeskSurface } from "@/components/DeskSurface";

export const dynamic = "force-dynamic";

export default function TaskCenterPage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
          <MobileTaskCenter />
        </Suspense>
      </div>
    );
  }

  return (
    <DeskSurface variant="violet" innerClassName="space-y-6">
      <Suspense fallback={<div>Loading…</div>}>
        <TaskCenter />
      </Suspense>
    </DeskSurface>
  );
}
