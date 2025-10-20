// web/src/app/tasks/owner/page.tsx
import { Suspense } from "react";
import OwnerDashboard from "@/components/tasks/OwnerDashboard";

export const dynamic = "force-dynamic";

export default function OwnerTasksPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-2">Owner Dashboard</h1>
      <p className="text-sm text-gray-600 mb-4">Overdue, due today, unassigned, and blocked — with quick bulk actions.</p>
      <Suspense fallback={<div>Loading…</div>}>
        <OwnerDashboard />
      </Suspense>
    </div>
  );
}