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
  const [showDisqualifyForm, setShowDisqualifyForm] = useState(false);
  const [disqualifyMessage, setDisqualifyMessage] = useState(
    `Hi ${lead?.contactName || "there"},\n\nThank you for reaching out to us with your project enquiry. We appreciate the opportunity to work with you.\n\nAfter reviewing your project details, we've determined that this type of work falls outside our current scope of services. We're unable to provide a quote for this project at this time.\n\nWe'd recommend reaching out to other specialists who may be better suited to your needs.\n\nBest regards,\nOur team`
  );

  const isQualifyTask = useMemo(() => {
    const t = String(task?.title || "").toLowerCase();
    return t.includes("qualify");
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

  const handleDisqualify = async (e: any) => {
    stop(e);
    if (!task.id || !lead?.id) return;
    setLoading(true);
    try {
      await apiFetch(`/leads/${lead.id}/disqualify`, {
        method: "POST",
        json: { message: disqualifyMessage, taskId: task.id },
      });
      toast({ title: "Disqualified", description: "Email sent" });
      setShowDisqualifyForm(false);
      await onChanged();
    } catch (error) {
      console.error("Failed to disqualify enquiry:", error);
      toast({ title: "Failed to disqualify" });
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

  if (isQualifyTask) {
    return (
      <div className="space-y-2" onClick={stop}>
        <div className="text-xs font-medium text-slate-700 truncate">{task.title}</div>
        {!showDisqualifyForm ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={handleAccept} disabled={loading} className="h-7 px-2">
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={handleReject} disabled={loading} className="h-7 px-2">
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                stop(e);
                setShowDisqualifyForm(true);
              }}
              disabled={loading}
              className="h-7 px-2"
            >
              Disqualify
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={disqualifyMessage}
              onChange={(e) => setDisqualifyMessage(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-200"
              rows={4}
            />
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  stop(e);
                  setShowDisqualifyForm(false);
                }}
                disabled={loading}
                className="h-7 px-2"
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleDisqualify} disabled={loading} className="h-7 px-2">
                {loading ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2" onClick={stop}>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-700 truncate">{task.title}</div>
        {task.description ? <div className="text-[11px] text-slate-500 truncate">{task.description}</div> : null}
      </div>
      <Button size="sm" onClick={handleComplete} disabled={loading} className="h-7 px-2 shrink-0">
        {loading ? "…" : "Complete"}
      </Button>
    </div>
  );
}
