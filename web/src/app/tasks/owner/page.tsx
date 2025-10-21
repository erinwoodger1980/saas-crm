// web/src/app/tasks/owner/page.tsx
"use client";

import { Suspense } from "react";
import OwnerDashboard from "@/components/tasks/OwnerDashboard";
import { DeskSurface } from "@/components/DeskSurface";
import { useTenantBrand } from "@/lib/use-tenant-brand";

export const dynamic = "force-dynamic";

export default function OwnerTasksPage() {
  const { shortName } = useTenantBrand();
  return (
    <DeskSurface variant="violet" innerClassName="space-y-6">
      <header
        className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200/70 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-500 shadow-sm"
        title="Overdue, due today, unassigned, and blocked — with quick bulk actions."
      >
        <span aria-hidden="true">✅</span>
        Task desk
        {shortName && <span className="hidden sm:inline text-slate-400">· {shortName}</span>}
      </header>

      <Suspense fallback={<div>Loading…</div>}>
        <OwnerDashboard />
      </Suspense>
    </DeskSurface>
  );
}