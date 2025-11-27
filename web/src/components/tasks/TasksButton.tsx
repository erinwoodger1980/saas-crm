"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { StreakBadge } from "@/components/streak/StreakBadge";
import { CelebrationWatcher } from "./CelebrationWatcher";
import { CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function TasksButton() {
  const [ids, setIds] = useState<{ tenantId: string; userId: string } | null>(null);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    function sync() { setIds(getAuthIdsFromJwt()); }
    sync();
    const t = setTimeout(sync, 800); // in case DevAuth seeds after first render
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ids) return;
    
    const loadTaskCount = async () => {
      try {
        const params = new URLSearchParams();
        params.set("mine", "true");
        params.set("take", "1");
        
        const response = await apiFetch<{ items: any[]; total: number }>(
          `/tasks?${params}`,
          { headers: { "x-tenant-id": ids.tenantId } }
        );
        
        setTaskCount(response.total);
      } catch (error) {
        console.error("Failed to load task count:", error);
      }
    };
    
    loadTaskCount();
    const interval = setInterval(loadTaskCount, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [ids]);

  if (!ids) return null;

  return (
    <>
      {/* Streak bubble */}
      <StreakBadge tenantId={ids.tenantId} userId={ids.userId} />
      {/* Celebration (checks quietly) */}
      <CelebrationWatcher tenantId={ids.tenantId} userId={ids.userId} />
      {/* Floating "My Tasks" button */}
      <Link href="/tasks/center" className="fixed bottom-6 right-6 z-[997]">
        <Button 
          size="lg" 
          className="h-14 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-2xl rounded-full"
        >
          <CheckSquare className="h-6 w-6 mr-2" />
          <span className="font-semibold">My Tasks</span>
          {taskCount > 0 && (
            <Badge className="ml-2 bg-white text-blue-600 hover:bg-white">{taskCount}</Badge>
          )}
        </Button>
      </Link>
    </>
  );
}
