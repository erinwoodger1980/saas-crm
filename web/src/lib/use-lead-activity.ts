/**
 * Unified Activity Hook
 * 
 * Fetches and combines all activity data for a lead:
 * - Communication logs (notes, calls, emails)
 * - Tasks and follow-ups
 * - Status changes
 * - Quote events
 * 
 * Provides live updates via SWR mutation
 */

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import {
  ActivityEvent,
  NoteActivity,
  TaskActivity,
  EmailActivity,
  CallActivity,
  StatusChangeActivity,
  QuoteActivity,
  FollowUpScheduledActivity,
  sortActivities,
} from "@/lib/activity-types";

type Lead = {
  id: string;
  status: string;
  communicationLog?: Array<{
    id: string;
    type: 'call' | 'email' | 'note';
    content: string;
    timestamp: string;
  }>;
  statusHistory?: Array<{
    from: string;
    to: string;
    at: string;
    reason?: string;
  }>;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueAt?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  meta?: any;
};

export function useLeadActivity(leadId: string | null) {
  // Fetch lead data (includes communication log and status history)
  const { data: lead, error: leadError, mutate: mutateLead } = useSWR<Lead>(
    leadId ? `/leads/${leadId}` : null,
    (url: string) => apiFetch<{ lead: Lead }>(url).then(res => res.lead || res)
  );

  // Fetch tasks
  const { data: tasksData, error: tasksError, mutate: mutateTasks } = useSWR<{ items: Task[] }>(
    leadId ? `/tasks?relatedType=LEAD&relatedId=${leadId}` : null,
    (url: string) => apiFetch<{ items: Task[] }>(url)
  );

  // Fetch quote events (if we have a quote)
  const { data: quoteEvents, mutate: mutateQuotes } = useSWR<QuoteActivity[]>(
    lead?.id ? `/leads/${lead.id}/quote-events` : null,
    async (url: string) => {
      try {
        const response = await apiFetch<{ events: any[] }>(url);
        return (response.events || []).map(transformQuoteEvent);
      } catch {
        // Quote events endpoint might not exist yet - gracefully handle
        return [];
      }
    }
  );

  // Transform communication log to activities
  const communicationActivities: ActivityEvent[] = useMemo(() => {
    if (!lead?.communicationLog) return [];

    return lead.communicationLog.map((comm): NoteActivity | EmailActivity | CallActivity => {
      const baseId = comm.id || `comm-${Date.now()}-${Math.random()}`;

      if (comm.type === 'note') {
        return {
          type: "note",
          id: baseId,
          createdAt: comm.timestamp,
          text: comm.content,
        };
      }

      if (comm.type === 'email') {
        return {
          type: "email",
          id: baseId,
          direction: "outbound", // Default, could be parsed from content
          summary: comm.content,
          sentAt: comm.timestamp,
          status: "sent",
        };
      }

      if (comm.type === 'call') {
        return {
          type: "call",
          id: baseId,
          direction: "outbound", // Default
          loggedAt: comm.timestamp,
          summary: comm.content,
        };
      }

      // Fallback to note
      return {
        type: "note",
        id: baseId,
        createdAt: comm.timestamp,
        text: comm.content,
      };
    });
  }, [lead?.communicationLog]);

  // Transform tasks to activities
  const taskActivities: TaskActivity[] = useMemo(() => {
    if (!tasksData?.items) return [];

    return tasksData.items.map((task): TaskActivity => ({
      type: "task",
      id: task.id,
      createdAt: task.createdAt || new Date().toISOString(),
      dueAt: task.dueAt,
      completedAt: task.completedAt,
      title: task.title,
      description: task.description || undefined,
      status: task.status,
      priority: task.priority,
      meta: task.meta,
    }));
  }, [tasksData]);

  // Transform status changes to activities
  const statusChangeActivities: StatusChangeActivity[] = useMemo(() => {
    if (!lead?.statusHistory) return [];

    return lead.statusHistory.map((change, idx): StatusChangeActivity => ({
      type: "status_change",
      id: `status-${lead.id}-${idx}`,
      from: change.from,
      to: change.to,
      at: change.at,
      reason: change.reason,
    }));
  }, [lead?.statusHistory, lead?.id]);

  // Combine all activities
  const allActivities: ActivityEvent[] = useMemo(() => {
    return sortActivities([
      ...communicationActivities,
      ...taskActivities,
      ...statusChangeActivities,
      ...(quoteEvents || []),
    ]);
  }, [communicationActivities, taskActivities, statusChangeActivities, quoteEvents]);

  // Mutate all data sources
  const refreshAll = useCallback(async () => {
    await Promise.all([
      mutateLead(),
      mutateTasks(),
      mutateQuotes(),
    ]);
  }, [mutateLead, mutateTasks, mutateQuotes]);

  // Add a new activity optimistically
  const addActivityOptimistic = useCallback((newActivity: ActivityEvent) => {
    // Optimistically update the relevant data source
    if (newActivity.type === "note" || newActivity.type === "email" || newActivity.type === "call") {
      mutateLead(
        (current) => {
          if (!current) return current;
          const newComm = {
            id: newActivity.id,
            type: newActivity.type,
            content: newActivity.type === "note" ? newActivity.text : 
                     newActivity.type === "email" ? (newActivity.summary || "") :
                     (newActivity.summary || ""),
            timestamp: newActivity.type === "note" ? newActivity.createdAt :
                      newActivity.type === "email" ? newActivity.sentAt :
                      newActivity.loggedAt,
          };
          return {
            ...current,
            communicationLog: [newComm, ...(current.communicationLog || [])],
          };
        },
        { revalidate: false }
      );
    }

    if (newActivity.type === "task") {
      mutateTasks(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            items: [newActivity as any, ...(current.items || [])],
          };
        },
        { revalidate: false }
      );
    }

    // After optimistic update, revalidate in the background
    setTimeout(() => refreshAll(), 100);
  }, [mutateLead, mutateTasks, refreshAll]);

  return {
    activities: allActivities,
    isLoading: !lead && !leadError,
    isError: leadError || tasksError,
    refresh: refreshAll,
    addActivityOptimistic,
    mutateLead,
    mutateTasks,
  };
}

// Helper to transform quote events from API format
function transformQuoteEvent(event: any): QuoteActivity {
  return {
    type: "quote_event",
    id: event.id || `quote-event-${Date.now()}`,
    kind: event.kind || "quote_created",
    at: event.at || event.createdAt || new Date().toISOString(),
    quoteId: event.quoteId,
    quoteTitle: event.quoteTitle,
    amount: event.amount,
  };
}
