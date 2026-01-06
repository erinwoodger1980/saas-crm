"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueAt?: string | null;
  relatedId?: string | null;
  assigneeUserId?: string | null;
  assigneeName?: string | null;
};

type Lead = {
  id: string;
  contactName?: string | null;
  email?: string | null;
};

export function LatestTaskCell({
  task,
  lead,
  onChanged,
}: {
  task: Task | null | undefined;
  lead: Lead;
  onChanged: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const isReviewEnquiryTask = useMemo(() => {
    const t = String(task?.title || "").toLowerCase();
    return t.trim() === "review enquiry";
  }, [task?.title]);

  if (!task) return <span className="text-slate-400">-</span>;

  const stop = (e: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
  };

  const handleAccept = async (e: any) => {
    stop(e);
    if (!task.id) return;
    setLoading(true);
    try {
      await apiFetch(`/tasks/${task.id}/actions/accept-enquiry`, { method: "POST" });
      toast({ title: "Enquiry accepted" });
      await onChanged();
    } catch (error) {
      console.error("Failed to accept enquiry:", error);
      toast({ title: "Failed to accept" });
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async (e: any) => {
    stop(e);
    if (!task.id) return;
    setLoading(true);
    try {
      await apiFetch(`/tasks/${task.id}/actions/decline-enquiry`, { method: "POST" });
      toast({ title: "Enquiry declined" });
      await onChanged();
    } catch (error) {
      console.error("Failed to decline enquiry:", error);
      toast({ title: "Failed to decline" });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (e: any) => {
    stop(e);
    if (!task.id) return;
    setLoading(true);
    try {
      await apiFetch(`/tasks/${task.id}/actions/reject-enquiry`, { method: "POST" });
      toast({ title: "Enquiry rejected" });
      await onChanged();
    } catch (error) {
      console.error("Failed to reject enquiry:", error);
      toast({ title: "Failed to reject" });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (e: any) => {
    stop(e);
    if (!task.id) return;
    setLoading(true);
    try {
      await apiFetch(`/tasks/${task.id}/complete`, { method: "POST" });
      toast({ title: "Task completed" });
      await onChanged();
    } catch (error) {
      console.error("Failed to complete task:", error);
      toast({ title: "Failed to complete" });
    } finally {
      setLoading(false);
    }
  };

  if (isReviewEnquiryTask) {
    return (
      <div className="space-y-2" onClick={stop}>
        <div className="text-xs font-medium text-slate-700 truncate">{task.title}</div>
        {task.assigneeName ? (
          <div className="text-[11px] text-slate-500 truncate">Assigned: {task.assigneeName}</div>
        ) : null}
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={handleAccept} disabled={loading} className="h-7 px-2">
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={handleDecline} disabled={loading} className="h-7 px-2">
            Decline
          </Button>
          <Button size="sm" variant="outline" onClick={handleReject} disabled={loading} className="h-7 px-2">
            Reject
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2" onClick={stop}>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-700 truncate">{task.title}</div>
        {task.assigneeName ? <div className="text-[11px] text-slate-500 truncate">Assigned: {task.assigneeName}</div> : null}
        {task.description ? <div className="text-[11px] text-slate-500 truncate">{task.description}</div> : null}
      </div>
      <Button size="sm" onClick={handleComplete} disabled={loading} className="h-7 px-2 shrink-0">
        {loading ? "…" : "Complete"}
      </Button>
    </div>
  );
}
