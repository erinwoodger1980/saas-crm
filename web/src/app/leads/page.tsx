// web/src/app/leads/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import LeadModal, { Lead } from "./LeadModal";
import { on } from "@/lib/events";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";

/* -------------------------------- Types -------------------------------- */

type LeadStatus =
  | "NEW_ENQUIRY"
  | "INFO_REQUESTED"
  | "DISQUALIFIED"
  | "REJECTED"
  | "READY_TO_QUOTE"
  | "QUOTE_SENT"
  | "WON"
  | "LOST";

type Grouped = Record<LeadStatus, Lead[]>;

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW_ENQUIRY: "New enquiry",
  INFO_REQUESTED: "Info requested",
  DISQUALIFIED: "Disqualified",
  REJECTED: "Rejected",
  READY_TO_QUOTE: "Ready to quote",
  QUOTE_SENT: "Quote sent",
  WON: "Won",
  LOST: "Lost",
};

// Intake-focused tabs
const ACTIVE_TABS: LeadStatus[] = [
  "NEW_ENQUIRY",
  "INFO_REQUESTED",
  "DISQUALIFIED",
  "REJECTED",
  "READY_TO_QUOTE",
];

/* -------------------------------- Page -------------------------------- */

export default function LeadsPage() {
  const empty: Grouped = {
    NEW_ENQUIRY: [],
    INFO_REQUESTED: [],
    DISQUALIFIED: [],
    REJECTED: [],
    READY_TO_QUOTE: [],
    QUOTE_SENT: [],
    WON: [],
    LOST: [],
  };

  const [grouped, setGrouped] = useState<Grouped>(empty);
  const [tab, setTab] = useState<LeadStatus>("NEW_ENQUIRY");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // modal
  const [open, setOpen] = useState(false);
  const [leadPreview, setLeadPreview] = useState<Lead | null>(null);
  const { toast } = useToast();

  const buildAuthHeaders = (): HeadersInit | undefined => {
    const ids = getAuthIdsFromJwt();
    if (!ids?.tenantId || !ids?.userId) return undefined;
    return { "x-tenant-id": ids.tenantId, "x-user-id": ids.userId };
  };

  useEffect(() => {
    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;
      await refreshGrouped();
    })();
  }, []);

  // 🔗 Listen for "open-lead" from the My Tasks drawer
  useEffect(() => {
    return on("open-lead", ({ leadId }) => openLeadById(leadId));
  }, [grouped]); // grouped in deps so we can search current lists

  // periodic refresh + optional auto-import every 10 minutes
  useEffect(() => {
    const id = setInterval(async () => {
      const auto = localStorage.getItem("autoImportInbox") === "true";
      try {
        if (auto) {
          const headers = buildAuthHeaders();
          await Promise.allSettled([
            apiFetch("/gmail/import", {
              method: "POST",
              headers,
              json: { max: 10, q: "newer_than:30d" },
            }),
            apiFetch("/ms365/import", { method: "POST", headers, json: { max: 10 } }),
          ]);
        }
      } finally {
        await refreshGrouped();
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  async function refreshGrouped() {
    setLoading(true);
    try {
      const data = await apiFetch<Grouped>("/leads/grouped", {
        headers: buildAuthHeaders(),
      });
      setGrouped(normaliseToNewStatuses(data));
      setError(null);
    } catch (e: any) {
      setError(`Failed to load: ${e?.message ?? "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  function openLead(l: Lead) {
    setLeadPreview(l);
    setOpen(true);
  }

  // 🔍 Helper: open by id (search current buckets, else fetch)
  async function openLeadById(leadId: string) {
    let found: Lead | null = null;
    (Object.keys(grouped) as LeadStatus[]).some((s) => {
      const hit = grouped[s].find((x) => x.id === leadId);
      if (hit) {
        found = hit;
        return true;
      }
      return false;
    });

    if (found) {
      openLead(found);
      return;
    }
    try {
      const l = await apiFetch<Lead>(`/leads/${leadId}`, {
        headers: buildAuthHeaders(),
      });
      if (l?.id) openLead(l);
    } catch {
      // ignore
    }
  }

  // Normalize server buckets to new statuses and de-dupe by id
  function normaliseToNewStatuses(g: any): Grouped {
    const out: Grouped = {
      NEW_ENQUIRY: [],
      INFO_REQUESTED: [],
      DISQUALIFIED: [],
      REJECTED: [],
      READY_TO_QUOTE: [],
      QUOTE_SENT: [],
      WON: [],
      LOST: [],
    };

    const mapLegacyToNew = (legacy: string | undefined): LeadStatus => {
      switch ((legacy || "").toUpperCase()) {
        case "NEW":
          return "NEW_ENQUIRY";
        case "CONTACTED":
          return "INFO_REQUESTED";
        case "QUALIFIED":
          return "READY_TO_QUOTE";
        case "DISQUALIFIED":
          return "DISQUALIFIED";
        case "NEW_ENQUIRY":
        case "INFO_REQUESTED":
        case "REJECTED":
        case "READY_TO_QUOTE":
        case "QUOTE_SENT":
        case "WON":
        case "LOST":
          return legacy as LeadStatus;
        default:
          return "NEW_ENQUIRY";
      }
    };

    const seen = new Set<string>();
    const insert = (l: any) => {
      if (!l?.id || seen.has(l.id)) return;
      seen.add(l.id);
      const s = mapLegacyToNew(l.status as string);
      out[s].push({ ...l, status: s } as Lead);
    };

    (g?.NEW || []).forEach(insert);
    (g?.CONTACTED || []).forEach(insert);
    (g?.QUALIFIED || []).forEach(insert);
    (g?.DISQUALIFIED || []).forEach(insert);
    (Object.keys(STATUS_LABELS) as LeadStatus[]).forEach((s) => (g?.[s] || []).forEach(insert));

    return out;
  }

  // PATCH helper used by modal (we keep only “Reject” here)
  async function setRejected(leadId: string) {
    // optimistic update to REJECTED
    setGrouped((g) => {
      const next = structuredClone(g);
      (Object.keys(next) as LeadStatus[]).forEach((s) => {
        const i = next[s].findIndex((x) => x.id === leadId);
        if (i >= 0) {
          const current = next[s][i];
          const updated: Lead = { ...current, status: "REJECTED" };
          next[s].splice(i, 1);
          next.REJECTED.unshift(updated);
        }
      });
      return next;
    });
    try {
      await apiFetch(`/leads/${leadId}`, {
        method: "PATCH",
        headers: buildAuthHeaders(),
        json: { status: "REJECTED" },
      });
    } catch (e) {
      console.error("reject failed:", e);
      refreshGrouped();
    }
  }

  // Only show intake tabs
  const rows = useMemo(() => {
    const list = grouped[tab as LeadStatus] || [];
    const seen = new Set<string>();
    return list.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [grouped, tab]);

  /* ------------------------------ Render ------------------------------ */

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            Capture and triage enquiries. Quote lifecycle is managed in Opportunities.
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <Button
            onClick={async () => {
              const contactName = prompt("Enter lead name:");
              if (!contactName) return;
              try {
                const lead = await apiFetch<any>("/leads", {
                  method: "POST",
                  headers: buildAuthHeaders(),
                  json: { contactName, email: "", custom: { provider: "manual" } },
                });
                await refreshGrouped();
                if (lead?.id) {
                  openLead({
                    id: lead.id,
                    contactName: lead.contactName ?? contactName,
                    email: lead.email ?? "",
                    status: (lead.status as LeadStatus) ?? "NEW_ENQUIRY",
                    custom: lead.custom ?? { provider: "manual" },
                  });
                }
                toast({
                  title: "Lead created",
                  description: `${lead?.contactName ?? contactName} added to your inbox.`,
                });
              } catch (e: any) {
                const rawMessage = typeof e?.message === "string" ? e.message : "Please try again.";
                const cleaned = rawMessage.replace(/\sfor\shttps?:\/\/\S+/, "").trim();
                toast({
                  title: "Failed to create lead",
                  description: cleaned || "Please try again.",
                  variant: "destructive",
                });
              }
            }}
          >
            + New Lead
          </Button>
          <Button variant="outline" onClick={refreshGrouped}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {ACTIVE_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              tab === s
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {STATUS_LABELS[s]}
            <span
              className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                tab === s ? "bg-white/20" : "bg-slate-100 text-slate-600"
              }`}
            >
              {grouped[s].length}
            </span>
          </button>
        ))}
      </div>

      {/* Card Section */}
      <SectionCard
        title="Inbox"
        action={
          <span className="text-xs text-slate-500">
            {loading ? "Syncing…" : `${rows.length} in “${STATUS_LABELS[tab]}”`}
          </span>
        }
      >
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <RowsSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title={`No leads in “${STATUS_LABELS[tab]}”.`} />
        ) : (
          <div className="grid gap-3">
            {rows.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onOpen={() => openLead(lead)}
                onReject={() => setRejected(lead.id)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Modal */}
      <LeadModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setLeadPreview(null);
        }}
        leadPreview={leadPreview}
        onUpdated={refreshGrouped}
      />
    </div>
  );
}

/* ============================== UI Bits =============================== */

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-slate-50 py-10 text-center text-sm text-slate-500">
      <div>{title}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

/* ---------------- Row/Card ---------------- */

function LeadCard({
  lead,
  onOpen,
  onReject,
}: {
  lead: Lead;
  onOpen: () => void;
  onReject: () => void;
}) {
  const subject = lead.custom?.subject as string | undefined;
  const summary = lead.custom?.summary as string | undefined;

  return (
    <div className="group rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] hover:shadow-md transition">
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="flex-1 text-left min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-grid place-items-center h-9 w-9 rounded-xl bg-slate-100 text-[11px] font-semibold text-slate-700 border">
              {avatarText(lead.contactName)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">
                {lead.contactName || "Lead"}
              </div>
              {lead.email && (
                <div className="truncate text-xs text-slate-500">{lead.email}</div>
              )}
            </div>
          </div>

          {(subject || summary || lead.custom?.description) && (
            <div className="mt-1 space-y-1">
              {subject && <div className="text-xs font-medium line-clamp-1">{subject}</div>}
              {summary && (
                <div className="text-[12px] text-slate-600 line-clamp-2">{summary}</div>
              )}
              {lead.custom?.description && (
                <div className="text-[12px] text-slate-500 line-clamp-2 italic">
                  {lead.custom.description}
                </div>
              )}
            </div>
          )}
        </button>

        {/* Quick actions: Reject + status pill (read-only) */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <button
            className="rounded-md border border-red-300 text-red-600 px-2 py-1 text-[11px] hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
          >
            ✕ Reject
          </button>

          <span
            className="mt-1 inline-flex items-center rounded-full border px-2 py-1 text-[11px] text-slate-700 bg-slate-50"
            title="Status (change inside the lead modal)"
          >
            {STATUS_LABELS[lead.status as LeadStatus] || "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function avatarText(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}