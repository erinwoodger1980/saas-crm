"use client";

import Link from "next/link";
import SourceCosts from "@/app/settings/SourceCosts";
import LeadSourcesManager from "@/app/settings/LeadSourcesManager";
import { Button } from "@/components/ui/button";

export default function LeadSourcesCostsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Lead Sources & Costs</h1>
          <p className="text-sm text-slate-500">Track spend, leads, sales, CPL and CPS by source</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/source-insights">View Source Insights →</Link>
          </Button>
        </div>
      </div>

      <LeadSourcesManager />
      <SourceCosts />
    </div>
  );
}
