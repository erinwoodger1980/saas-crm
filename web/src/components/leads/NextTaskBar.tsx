"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  relatedType?: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  relatedId?: string | null;
  dueAt?: string | null;
  meta?: { key?: string } | null;
}

interface NextTaskBarProps {
  nextTask: Task | null;
  leadId: string | null;
  leadEmail?: string | null;
  leadName?: string | null;
  onTaskComplete: () => void;
}

export function NextTaskBar({
  nextTask,
  leadId,
  leadEmail,
  leadName,
  onTaskComplete,
}: NextTaskBarProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showDisqualifyForm, setShowDisqualifyForm] = useState(false);
  const [disqualifyMessage, setDisqualifyMessage] = useState(
    `Hi ${leadName || "there"},

Thank you for reaching out to us with your project enquiry. We appreciate the opportunity to work with you.

After reviewing your project details, we've determined that this type of work falls outside our current scope of services. We're unable to provide a quote for this project at this time.

We'd recommend reaching out to other specialists who may be better suited to your needs.

Best regards,
Our team`
  );

  if (!nextTask) return null;

  const isReviewEnquiryTask = String(nextTask.title || "")
    .trim()
    .toLowerCase() === "review enquiry";

  const isQualifyLeadTask = nextTask.title?.includes("Qualify Lead") || nextTask.title?.includes("qualify");

  const handleAccept = async () => {
    if (!nextTask.id) return;
    setLoading(true);
    try {
      await apiFetch(`/tasks/${nextTask.id}/actions/accept-enquiry`, {
        method: "POST",
      });
      toast({ title: "Enquiry accepted" });
      onTaskComplete();
    } catch (error) {
      console.error("Failed to accept lead:", error);
      toast({ title: "Failed to accept" });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!nextTask.id) return;
    setLoading(true);
    try {
      await apiFetch(`/tasks/${nextTask.id}/actions/reject-enquiry`, {
        method: "POST",
      });
      toast({ title: "Enquiry rejected" });
      onTaskComplete();
    } catch (error) {
      console.error("Failed to reject lead:", error);
      toast({ title: "Failed to reject" });
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!nextTask.id) return;
    setLoading(true);
    try {
      await apiFetch(`/tasks/${nextTask.id}/actions/decline-enquiry`, {
        method: "POST",
      });
      toast({ title: "Enquiry declined" });
      onTaskComplete();
    } catch (error) {
      console.error("Failed to decline enquiry:", error);
      toast({ title: "Failed to decline" });
    } finally {
      setLoading(false);
    }
  };

  if (isReviewEnquiryTask) {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50/50 backdrop-blur p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sky-950 mb-1">Next Task: Review enquiry</h3>
            <p className="text-sm text-sky-800">
              {leadName || "New lead"} ({leadEmail})
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={handleAccept} disabled={loading} className="bg-sky-600 hover:bg-sky-700 text-white">
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={handleDecline} disabled={loading}>
              Decline
            </Button>
            <Button size="sm" variant="outline" onClick={handleReject} disabled={loading}>
              Reject
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleDisqualify = async () => {
    if (!nextTask.id || !leadId) return;
    setLoading(true);
    try {
      await apiFetch(`/leads/${leadId}/disqualify`, {
        method: "POST",
        json: {
          message: disqualifyMessage,
          taskId: nextTask.id,
        },
      });
      toast({ title: "Disqualified", description: "Email sent" });
      setShowDisqualifyForm(false);
      onTaskComplete();
    } catch (error) {
      console.error("Failed to disqualify lead:", error);
      toast({ title: "Failed to disqualify" });
    } finally {
      setLoading(false);
    }
  };

  if (isQualifyLeadTask) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 backdrop-blur p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-amber-950 mb-1">Next Task: Qualify Lead</h3>
            <p className="text-sm text-amber-800">
              {leadName || "New lead"} ({leadEmail}) - Should we proceed with this enquiry?
            </p>
          </div>

          {!showDisqualifyForm && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReject}
                disabled={loading}
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDisqualifyForm(true)}
                disabled={loading}
                className="border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                Disqualify
              </Button>
            </div>
          )}
        </div>

        {showDisqualifyForm && (
          <div className="mt-4 space-y-3 border-t border-amber-200 pt-4">
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-2">
                Email to send to client:
              </label>
              <textarea
                value={disqualifyMessage}
                onChange={(e) => setDisqualifyMessage(e.target.value)}
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm placeholder-amber-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                rows={6}
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDisqualifyForm(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDisqualify}
                disabled={loading}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {loading ? "Sending..." : "Send & Disqualify"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // For other tasks, just show a simple completion button
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/50 backdrop-blur p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-sky-950">{nextTask.title}</h3>
          {nextTask.description && (
            <p className="text-sm text-sky-800 mt-1">{nextTask.description}</p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => {
            setLoading(true);
            apiFetch(`/tasks/${nextTask.id}/complete`, { method: "POST" })
              .then(() => {
                toast({ title: "Task completed" });
                onTaskComplete();
              })
              .catch(() => {
                toast({ title: "Failed to complete task" });
              })
              .finally(() => setLoading(false));
          }}
          disabled={loading}
          className="bg-sky-600 hover:bg-sky-700 text-white shrink-0"
        >
          {loading ? "Completing..." : "Complete"}
        </Button>
      </div>
    </div>
  );
}
