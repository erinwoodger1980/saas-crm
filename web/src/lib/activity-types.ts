/**
 * Unified Activity Event System
 * 
 * Combines tasks, communications, follow-ups, status changes, and quote events
 * into a single, type-safe activity timeline.
 */

export type UserSummary = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type ActivityEvent =
  | NoteActivity
  | TaskActivity
  | EmailActivity
  | CallActivity
  | StatusChangeActivity
  | QuoteActivity
  | FollowUpScheduledActivity;

export type NoteActivity = {
  type: "note";
  id: string;
  createdAt: string;
  author?: UserSummary;
  text: string;
};

export type TaskActivity = {
  type: "task";
  id: string;
  createdAt: string;
  dueAt?: string | null;
  completedAt?: string | null;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  meta?: {
    type?: string; // email_followup, phone_followup, etc.
    leadEmail?: string;
  };
};

export type EmailActivity = {
  type: "email";
  id: string;
  direction: "outbound" | "inbound";
  subject?: string;
  summary?: string;
  sentAt: string;
  status?: "queued" | "sent" | "failed" | "bounced";
  from?: string;
  to?: string;
};

export type CallActivity = {
  type: "call";
  id: string;
  direction: "outbound" | "inbound";
  loggedAt: string;
  summary?: string;
  duration?: number; // in seconds
};

export type StatusChangeActivity = {
  type: "status_change";
  id: string;
  from: string;
  to: string;
  at: string;
  reason?: string;
};

export type QuoteActivity = {
  type: "quote_event";
  id: string;
  kind: "quote_created" | "quote_sent" | "quote_viewed" | "quote_accepted" | "quote_rejected" | "quote_updated";
  at: string;
  quoteId: string;
  quoteTitle?: string;
  amount?: number;
};

export type FollowUpScheduledActivity = {
  type: "followup_scheduled";
  id: string;
  scheduledAt: string;
  scheduledFor: string;
  kind: "email" | "phone" | "meeting" | "auto_sequence";
  details?: string;
};

/**
 * Helper to get the primary timestamp for sorting
 */
export function getActivityTimestamp(event: ActivityEvent): string {
  switch (event.type) {
    case "note":
      return event.createdAt;
    case "task":
      return event.createdAt;
    case "email":
      return event.sentAt;
    case "call":
      return event.loggedAt;
    case "status_change":
      return event.at;
    case "quote_event":
      return event.at;
    case "followup_scheduled":
      return event.scheduledAt;
  }
}

/**
 * Sort activities by timestamp descending (newest first)
 */
export function sortActivities(activities: ActivityEvent[]): ActivityEvent[] {
  return [...activities].sort((a, b) => {
    const timeA = new Date(getActivityTimestamp(a)).getTime();
    const timeB = new Date(getActivityTimestamp(b)).getTime();
    return timeB - timeA;
  });
}

/**
 * Group activities by date
 */
export function groupActivitiesByDate(activities: ActivityEvent[]): { date: string; label: string; events: ActivityEvent[] }[] {
  const sorted = sortActivities(activities);
  const groups = new Map<string, ActivityEvent[]>();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  sorted.forEach((event) => {
    const timestamp = new Date(getActivityTimestamp(event));
    timestamp.setHours(0, 0, 0, 0);
    const dateKey = timestamp.toISOString().split('T')[0];

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(event);
  });

  return Array.from(groups.entries()).map(([date, events]) => {
    const eventDate = new Date(date);
    let label: string;

    if (eventDate.getTime() === today.getTime()) {
      label = "Today";
    } else if (eventDate.getTime() === yesterday.getTime()) {
      label = "Yesterday";
    } else if (eventDate >= lastWeek) {
      label = "Last 7 days";
    } else {
      label = eventDate.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }

    return { date, label, events };
  });
}
