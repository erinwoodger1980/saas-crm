"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import LeadModal, { Lead } from "./LeadModal";

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

// Leads now focuses on intake+triage only:
const ACTIVE_TABS: LeadStatus[] = [
  "NEW_ENQUIRY",
  "INFO_REQUESTED",
  "DISQUALIFIED",
  "REJECTED",
  "READY_TO_QUOTE",
];

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

  // modal
  const [open, setOpen] = useState(false);
  const [leadPreview, setLeadPreview] = useState<Lead | null>(null);

  // background auto-import watcher (controlled by settings toggle in localStorage)
  useEffect(() => {
    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;
      await refreshGrouped();
    })();
  }, []);

  // periodic refresh + optional auto-import every 10 minutes
  useEffect(() => {
    const id = setInterval(async () => {
      const auto = localStorage.getItem("autoImportInbox") === "true";
      try {
        if (auto) {
          // Soft import (Gmail + 365). Failures are ignored.
          await Promise.allSettled([
            apiFetch("/gmail/import", { method: "POST", json: { max: 10, q: "newer_than:30d" } }),
            apiFetch("/ms365/import", { method: "POST", json: { max: 10 } }),
          ]);
        }
      } finally {
        await refreshGrouped();
      }
    }, 10 * 60 * 1000); // 10 minutes
    return () => clearInterval(id);
  }, []);

  async function refreshGrouped() {
    try {
      const data = await apiFetch<Grouped>("/leads/grouped");
      setGrouped(normaliseToNewStatuses(data));
    } catch (e: any) {
      setError(`Failed to load: ${e?.message ?? "unknown"}`);
    }
  }

  function openLead(l: Lead) {
    setLeadPreview(l);
    setOpen(true);
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
        case "NEW": return "NEW_ENQUIRY";
        case "CONTACTED": return "INFO_REQUESTED";
        case "QUALIFIED": return "READY_TO_QUOTE";
        case "DISQUALIFIED": return "DISQUALIFIED";
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
      if (!l?.id) return;
      if (seen.has(l.id)) return;
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

  // PATCH helper used by modal
  async function autoSave(leadId: string, patch: Partial<Lead>) {
    // optimistic update
    setGrouped((g) => {
      const next = structuredClone(g);
      const statuses = Object.keys(next) as LeadStatus[];
      for (const s of statuses) {
        const idx = next[s].findIndex((x) => x.id === leadId);
        if (idx >= 0) {
          const current = next[s][idx];
          const newCustom =
            patch.custom !== undefined
              ? { ...(current.custom || {}), ...(patch.custom as any) }
              : current.custom;
          const updated: Lead = { ...current, ...(patch as any), custom: newCustom };

          if (patch.status && patch.status !== s) {
            next[s].splice(idx, 1);
            next[patch.status].unshift(updated);
          } else {
            next[s][idx] = updated;
          }
          break;
        }
      }
      return next;
    });

    try {
      await apiFetch(`/leads/${leadId}`, { method: "PATCH", json: patch });
    } catch (e) {
      // swallow; modal shows saving state
      console.error("autoSave failed:", e);
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

  return (
    <div className="p-6">
      <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-slate-500">Capture and triage enquiries. Quote lifecycle is in Opportunities.</p>
        </div>

        <div className="flex gap-2 items-center">
          <Button
            className="btn"
            onClick={async () => {
              const contactName = prompt("Enter lead name:");
              if (!contactName) return;
              try {
                const lead = await apiFetch<any>("/leads", {
                  method: "POST",
                  json: { contactName, email: "", custom: { provider: "manual" } },
                });
                await refreshGrouped();
                if (lead?.id) openLead({
                  id: lead.id,
                  contactName: lead.contactName ?? contactName,
                  email: lead.email ?? "",
                  status: (lead.status as LeadStatus) ?? "NEW_ENQUIRY",
                  custom: lead.custom ?? { provider: "manual" },
                });
              } catch (e: any) {
                alert("Failed to create lead: " + (e?.message || "unknown error"));
              }
            }}
          >
            + New Lead
          </Button>
          <Button variant="outline" onClick={refreshGrouped}>Refresh</Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs (intake only) */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ACTIVE_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full border px-3 py-1 text-sm ${
              tab === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700"
            }`}
          >
            {STATUS_LABELS[s]}{" "}
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1 text-xs text-slate-600">
              {grouped[s].length}
            </span>
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed bg-slate-50 py-10 text-center text-sm text-slate-500">
            No leads in “{STATUS_LABELS[tab]}”.
          </div>
        )}
        {rows.map((lead) => (
          <Row
            key={lead.id}
            lead={lead}
            onOpen={() => openLead(lead)}
            onStatus={(s) => autoSave(lead.id, { status: s })}
          />
        ))}
      </div>

      {/* Modal */}
      <LeadModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setLeadPreview(null);
        }}
        leadPreview={leadPreview}
        onAutoSave={autoSave}
      />
    </div>
  );
}

/* ---------------- Row ---------------- */
function Row({
  lead,
  onOpen,
  onStatus,
}: {
  lead: Lead;
  onOpen: () => void;
  onStatus: (s: LeadStatus) => void;
}) {
  const subject = lead.custom?.subject as string | undefined;
  const summary = lead.custom?.summary as string | undefined;

  return (
    <div className="rounded-xl border bg-white p-3 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="flex-1 text-left min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
              {avatarText(lead.contactName)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
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
              {summary && <div className="text-[11px] text-slate-600 line-clamp-2">{summary}</div>}
              {lead.custom?.description && (
                <div className="text-[11px] text-slate-500 line-clamp-2 italic">
                  {lead.custom.description}
                </div>
              )}
            </div>
          )}
        </button>

        <div className="shrink-0 flex flex-col items-end gap-1">
          <button
            className="rounded-md border border-red-300 text-red-600 px-2 py-1 text-[11px] hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              onStatus("REJECTED");
            }}
          >
            ✕ Reject
          </button>
          <button
            className="rounded-md border border-amber-300 text-amber-600 px-2 py-1 text-[11px] hover:bg-amber-50"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await apiFetch(`/leads/${lead.id}/request-info`, { method: "POST" });
                onStatus("INFO_REQUESTED");
                alert("Questionnaire link sent ✔");
              } catch {
                alert("Failed to request info");
              }
            }}
          >
            📋 Info
          </button>
          <button
            className="rounded-md border border-green-300 text-green-600 px-2 py-1 text-[11px] hover:bg-green-50"
            onClick={(e) => {
              e.stopPropagation();
              onStatus("READY_TO_QUOTE");
            }}
          >
            ✅ Ready
          </button>

          <select
            className="rounded-md border bg-white p-2 text-xs mt-1"
            value={lead.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onStatus(e.target.value.toUpperCase() as LeadStatus)}
          >
            {(["NEW_ENQUIRY","INFO_REQUESTED","DISQUALIFIED","REJECTED","READY_TO_QUOTE"] as LeadStatus[])
              .map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
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