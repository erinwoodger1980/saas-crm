"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, ensureDemoAuth } from "@/lib/api";

type FeedbackStatus = "OPEN" | "RESOLVED";

type FeedbackUser = {
  id: string;
  email: string;
  name?: string | null;
};

type FeedbackItem = {
  id: string;
  feature: string;
  comment: string | null;
  sourceUrl: string | null;
  status: FeedbackStatus;
  devResponse: string | null;
  devScreenshotUrl: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  user?: FeedbackUser | null;
  resolvedBy?: FeedbackUser | null;
};

type FeedbackResponse = {
  ok: boolean;
  items: FeedbackItem[];
};

const FILTER_TABS: { value: FilterValue; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ALL", label: "All" },
];

type FilterValue = FeedbackStatus | "ALL";

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
};

function formatDate(date: string | null) {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

function formatSubmittedBy(user: FeedbackUser | null | undefined) {
  if (!user) return "Unknown";
  if (user.name && user.name.trim().length > 0) {
    return user.name;
  }
  return user.email;
}

function friendlyFeature(feature: string) {
  if (!feature) return "—";
  const match: Record<string, string> = {
    dashboard: "Dashboard",
    leads: "Leads",
    opportunities: "Opportunities",
    workshop: "Workshop",
    reports: "Reports",
    settings: "Settings",
    tasks: "Tasks",
    billing: "Billing",
    "feedback-admin": "Feedback",
    "marketing-home": "Marketing",
  };
  if (match[feature]) return match[feature];
  const cleaned = feature.replace(/[_/]/g, "-");
  return cleaned
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();
}

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("OPEN");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      const ok = await ensureDemoAuth();
      if (!ok) {
        if (!cancelled) {
          setError("You need to sign in to view feedback.");
        }
        setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (filter !== "ALL") {
          params.set("status", filter);
        }
        const data = await apiFetch<FeedbackResponse>(`/feedback?${params.toString()}`);
        if (!cancelled) {
          setItems(data.items || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load feedback");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const openCount = useMemo(() => items.filter((item) => item.status === "OPEN").length, [items]);

  async function toggleStatus(item: FeedbackItem) {
    const nextStatus: FeedbackStatus = item.status === "RESOLVED" ? "OPEN" : "RESOLVED";
    setUpdatingId(item.id);
    setError(null);
    try {
      const response = await apiFetch<{ ok: boolean; feedback: FeedbackItem }>(`/feedback/${item.id}`, {
        method: "PATCH",
        json: { status: nextStatus },
      });
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...response.feedback } : row)));
    } catch (err: any) {
      setError(err?.message || "Could not update feedback");
    } finally {
      setUpdatingId(null);
    }
  }

  const visibleItems = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((item) => item.status === filter);
  }, [items, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Feedback inbox</h1>
          <p className="text-sm text-slate-600">
            Track what early adopters are seeing and mark items off as they&apos;re delivered.
          </p>
        </div>
        <Badge variant={openCount > 0 ? "destructive" : "secondary"} className="text-sm">
          {openCount} open
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={filter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[14rem]">Area</TableHead>
              <TableHead>Feedback</TableHead>
              <TableHead className="w-[12rem]">Submitted by</TableHead>
              <TableHead className="w-[10rem]">Status</TableHead>
              <TableHead className="w-[10rem]">Received</TableHead>
              <TableHead className="w-[10rem]">Resolved</TableHead>
              <TableHead className="w-[1%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && visibleItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                  No feedback yet in this view.
                </TableCell>
              </TableRow>
            )}

            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                  Loading feedback…
                </TableCell>
              </TableRow>
            )}

            {visibleItems.map((item) => {
              const submitting = updatingId === item.id;
              return (
                <TableRow key={item.id} className={item.status === "OPEN" ? "bg-orange-50/50" : undefined}>
                  <TableCell className="align-top text-sm font-medium text-slate-700">
                    <div>{friendlyFeature(item.feature)}</div>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block text-xs text-blue-600 hover:underline"
                      >
                        View page ↗
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-sm text-slate-700">
                    <div>{item.comment ? item.comment : <span className="text-slate-400">No notes provided.</span>}</div>
                    {item.devResponse && (
                      <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2">
                        <div className="text-xs font-medium text-blue-700 mb-1">Developer Response:</div>
                        <div className="text-sm text-blue-900 whitespace-pre-wrap">{item.devResponse}</div>
                      </div>
                    )}
                    {item.devScreenshotUrl && (
                      <div className="mt-2">
                        <a href={item.devScreenshotUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                          View screenshot ↗
                        </a>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-sm text-slate-600">
                    {formatSubmittedBy(item.user ?? null)}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={item.status === "OPEN" ? "destructive" : "secondary"}>{STATUS_LABEL[item.status]}</Badge>
                    {item.resolvedBy && item.status === "RESOLVED" && (
                      <div className="mt-1 text-xs text-slate-500">by {formatSubmittedBy(item.resolvedBy)}</div>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-sm text-slate-600">{formatDate(item.createdAt)}</TableCell>
                  <TableCell className="align-top text-sm text-slate-600">{formatDate(item.resolvedAt)}</TableCell>
                  <TableCell className="align-top text-right">
                    <Button
                      variant={item.status === "RESOLVED" ? "outline" : "default"}
                      size="sm"
                      disabled={submitting}
                      onClick={() => toggleStatus(item)}
                    >
                      {submitting
                        ? "Updating…"
                        : item.status === "RESOLVED"
                        ? "Re-open"
                        : "Mark resolved"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
