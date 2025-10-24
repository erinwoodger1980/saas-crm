// web/src/app/leads/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import LeadModal, { Lead } from "./LeadModal";
import { on } from "@/lib/events";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
import { DeskSurface } from "@/components/DeskSurface";
import { useTenantBrand } from "@/lib/use-tenant-brand";

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

  const { shortName } = useTenantBrand();

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

      const contactNameCandidate =
        typeof l.contactName === "string" && l.contactName.trim() !== ""
          ? l.contactName.trim()
          : typeof l.contact?.name === "string" && l.contact.name.trim() !== ""
            ? l.contact.name.trim()
            : undefined;

      const emailCandidate =
        typeof l.email === "string" && l.email.trim() !== ""
          ? l.email.trim()
          : typeof l.contact?.email === "string" && l.contact.email.trim() !== ""
            ? l.contact.email.trim()
            : undefined;

      const descriptionCandidate =
        typeof l.description === "string" && l.description.trim() !== ""
          ? l.description.trim()
          : typeof l.custom?.description === "string" && l.custom.description.trim() !== ""
            ? l.custom.description.trim()
            : typeof l.custom?.bodyText === "string" && l.custom.bodyText.trim() !== ""
              ? l.custom.bodyText.trim()
              : undefined;

      const normalized: Lead = {
        ...(l as Lead),
        id: l.id,
        status: s,
        contactName: contactNameCandidate ?? l.contactName ?? null,
        email: emailCandidate ?? l.email ?? null,
        custom: (l.custom ?? l.briefJson ?? null) as Lead["custom"],
        description: descriptionCandidate ?? null,
      };

      out[s].push(normalized);
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

  async function handleCreateLead() {
    const input = prompt("Enter lead name:");
    const contactName = input?.trim();
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
          description:
            (typeof lead.description === "string" && lead.description.trim() !== ""
              ? lead.description.trim()
              : typeof lead.custom?.description === "string"
                ? lead.custom.description.trim()
                : null) ?? null,
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
  }

  /* ------------------------------ Render ------------------------------ */

  return (
    <>
      <DeskSurface innerClassName="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-500 shadow-sm"
              title="Capture and triage enquiries with a little Joinery pixie dust. Opportunities carry the quote journey through to win."
            >
              <span aria-hidden="true">✨</span>
              Lead desk
              {shortName && <span className="hidden sm:inline text-slate-400">· {shortName}</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              className="rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(37,99,235,0.55)] hover:from-sky-600 hover:via-indigo-600 hover:to-rose-500 hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              type="button"
              onClick={handleCreateLead}
            >
              + New Lead
            </Button>
            <Button
              variant="ghost"
              className="rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              type="button"
              onClick={refreshGrouped}
            >
              Refresh
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {ACTIVE_TABS.map((s) => {
            const active = tab === s;
            return (
              <button
                  key={s}
                  onClick={() => setTab(s)}
                  className={`group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? "border-transparent bg-gradient-to-r from-sky-500 via-indigo-500 to-rose-500 text-white shadow-[0_14px_34px_-18px_rgba(37,99,235,0.6)]"
                      : "border-slate-200/70 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white"
                  }`}
                  type="button"
                >
                  <span>{STATUS_LABELS[s]}</span>
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                      active
                        ? "bg-white/30 text-white"
                        : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                    }`}
                  >
                    {grouped[s].length}
                  </span>
                </button>
              );
            })}
        </div>

        <SectionCard
          title="Inbox"
          action={
            <span className="text-xs font-medium text-slate-500">
              {loading ? "Syncing…" : `${rows.length} in “${STATUS_LABELS[tab]}”`}
            </span>
          }
        >
          {error && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 shadow-sm">
              {error}
            </div>
          )}

          {loading ? (
            <RowsSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              title={`No leads in “${STATUS_LABELS[tab]}”.`}
              action={
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-white"
                  onClick={refreshGrouped}
                  type="button"
                >
                  Refresh inbox
                </button>
              }
            />
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
      </DeskSurface>

      <LeadModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setLeadPreview(null);
        }}
        leadPreview={leadPreview}
        onUpdated={refreshGrouped}
      />
    </>
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
    <section className="relative overflow-hidden rounded-3xl border border-sky-100/70 bg-white/80 shadow-[0_26px_60px_-38px_rgba(30,64,175,0.45)] backdrop-blur">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-16 h-44 w-44 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute -bottom-28 -right-14 h-52 w-52 rounded-full bg-amber-200/30 blur-3xl" />
      </div>
      <div className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-sky-100/60">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span aria-hidden="true">📥</span>
          {title}
        </h2>
        {action}
      </div>
      <div className="relative z-10 p-5">{children}</div>
    </section>
  );
}

function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-sky-200/70 bg-white/70 px-6 py-10 text-center text-sm text-slate-500 shadow-inner">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-lg">🌟</div>
      <div className="text-sm font-medium text-slate-600">{title}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-2xl border border-slate-200/60 bg-gradient-to-r from-slate-100/70 via-white/80 to-slate-100/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] animate-pulse"
        />
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
  const description =
    typeof lead.description === "string" && lead.description.trim() !== ""
      ? lead.description.trim()
      : typeof lead.custom?.description === "string" && lead.custom.description.trim() !== ""
        ? lead.custom.description.trim()
        : typeof lead.custom?.bodyText === "string" && lead.custom.bodyText.trim() !== ""
          ? lead.custom.bodyText.trim()
          : undefined;
  const statusLabel = STATUS_LABELS[lead.status as LeadStatus] || "—";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-sky-100/70 bg-white/85 p-4 shadow-[0_20px_45px_-36px_rgba(30,64,175,0.55)] backdrop-blur transition-transform hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-32px_rgba(30,64,175,0.55)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-24 h-40 w-40 rounded-full bg-sky-200/40 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-80"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-24 h-40 w-40 rounded-full bg-rose-200/35 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-70"
      />

      <div className="relative z-10 flex items-start gap-3">
        <button onClick={onOpen} className="flex-1 min-w-0 text-left" type="button">
          <div className="flex items-center gap-3">
            <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-sky-200/80 bg-white/70 text-[12px] font-semibold text-slate-700 shadow-sm">
              {avatarText(lead.contactName)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {lead.contactName || "Lead"}
              </div>
              {lead.email && <div className="truncate text-xs text-slate-500">{lead.email}</div>}
            </div>
          </div>

          {(subject || summary || description) && (
            <div className="mt-2 space-y-1">
              {subject && <div className="text-xs font-semibold text-slate-700 line-clamp-1">{subject}</div>}
              {summary && <div className="text-[12px] text-slate-600 line-clamp-2">{summary}</div>}
              {description && (
                <div className="text-[12px] text-slate-500/90 italic line-clamp-2">{description}</div>
              )}
            </div>
          )}
        </button>

        <div className="shrink-0 flex flex-col items-end gap-2 text-right">
          {lead.status === "NEW_ENQUIRY" && (
            <button
              className="rounded-full border border-rose-200/70 bg-rose-50/70 px-3 py-1 text-[11px] font-medium text-rose-600 shadow-sm transition hover:bg-rose-100"
              onClick={(e) => {
                e.stopPropagation();
                onReject();
              }}
              type="button"
            >
              ✕ Reject
            </button>
          )}

          <span
            className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm"
            title="Status (change inside the lead modal)"
          >
            {statusLabel}
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