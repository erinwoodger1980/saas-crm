"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import LeadModal, { Lead } from "./LeadModal";

import { apiFetch, ensureDemoAuth, getJwt } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";


/* ---------------- Types ---------------- */
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
type Lead = {
  id: string;
  contactName: string;
  email?: string | null;
  status: LeadStatus;
  nextAction?: string | null;
  nextActionAt?: string | null;
  custom?: Record<string, any>;
};
type EmailDetails = {
  bodyText?: string;
  bodyHtml?: string;
  subject?: string;
  from?: string;
  date?: string;
  attachments?: { filename: string; size?: number; attachmentId: string }[];
  threadId?: string;
};

type Grouped = Record<LeadStatus, Lead[]>;

type FieldDef = {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  required: boolean;
  sortOrder: number;
  config?: { options?: string[] };
};

type GmailAttachment = {
  id?: string;               // our UI will accept id or attachmentId
  attachmentId?: string;
  name?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
};

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

const STATUSES: LeadStatus[] = Object.keys(STATUS_LABELS) as LeadStatus[];

const API_URL =
  (process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:4000")!.replace(/\/$/, "");

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [details, setDetails] = useState<Lead | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [form, setForm] = useState<{
    contactName: string;
    email: string;
    status: LeadStatus;
    nextAction: string;
    nextActionAt: string;
    custom: Record<string, any>;
  } | null>(null);

  const [importing, setImporting] = useState<"gmail" | "ms365" | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);


const [emailDetails, setEmailDetails] = useState<EmailDetails | null>(null);
const [loadingEmail, setLoadingEmail] = useState(false);
// --- Supplier email modal state ---
const [sendOpen, setSendOpen] = useState(false);
const [sendTo, setSendTo] = useState("");
const [sendSubject, setSendSubject] = useState("");
const [sendBody, setSendBody] = useState("");
const [sendAttIds, setSendAttIds] = useState<string[]>([]);
useEffect(() => {
  const defaultSubj = `Quote request – ${form?.contactName || details?.contactName || previewLead?.contactName || "Lead"}`;
  setSendSubject((s) => s || defaultSubj);
  const allIds = (emailDetails?.attachments || [])
    .map((a: any) => a.attachmentId || a.id)
    .filter(Boolean);
  setSendAttIds(allIds);
}, [emailDetails, form?.contactName, details?.id]);

  /* ---------- helpers ---------- */

  // Attachment download URL — served by the small API addition below
  function attachmentUrl(messageId: string, attachmentId: string) {
    // JWT is also in cookie; adding a cache-buster helps avoid stale downloads
    const bust = Date.now();
    return `${API_URL}/gmail/message/${encodeURIComponent(
      messageId
    )}/attachment/${encodeURIComponent(attachmentId)}?v=${bust}`;
  }

 async function importFrom(provider: "gmail" | "ms365") {
  try {
    const payload = provider === "gmail" ? { max: 10, q: "newer_than:30d" } : { max: 10 };
    await apiFetch("/" + (provider === "gmail" ? "gmail/import" : "ms365/import"), {
      method: "POST",
      json: payload,
    });
    const data = await apiFetch<Grouped>("/leads/grouped");
    setGrouped(normaliseToNewStatuses(data));
    alert(`Imported from ${provider.toUpperCase()} ✔`);
  } catch (e: any) {
    alert(`Import from ${provider.toUpperCase()} failed: ${e?.message || e}`);
  }
} // <-- CLOSES importFrom properly

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

  // Legacy buckets
  (g?.NEW || []).forEach(insert);
  (g?.CONTACTED || []).forEach(insert);
  (g?.QUALIFIED || []).forEach(insert);
  (g?.DISQUALIFIED || []).forEach(insert);

  // Already-new buckets (if server returned them)
  STATUSES.forEach((s) => (g?.[s] || []).forEach(insert));

  return out;
}
 
 // PATCH only the changed fields (optimistic) + AI feedback logging
async function autoSave(patch: Partial<Lead>) {
  const targetId = details?.id ?? previewLead?.id ?? selectedId ?? null;
  if (!targetId) return;

  // optimistic UI: update grouped + form
  setGrouped((g) => {
    const next: Grouped = structuredClone(g);
    for (const s of STATUSES) {
      const idx = next[s].findIndex((x) => x.id === targetId);
      if (idx >= 0) {
        const current = next[s][idx];
        const newCustom =
          patch.custom !== undefined ? { ...(current.custom || {}), ...(patch.custom as any) } : current.custom;
        const updated: Lead = { ...current, ...(patch as any), custom: newCustom };

        // move column if status changed
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

  setForm((f) => (f ? mergeIntoForm(f, patch) : f));

  try {
    setAutoSaving(true);
    await apiFetch(`/leads/${targetId}`, { method: "PATCH", json: patch });

    // ---- AI feedback: only when status actually changes ----
    if (patch.status) {
      const movedTo = patch.status;

      // Decide label for training
      const isLead =
        movedTo === "READY_TO_QUOTE" || movedTo === "INFO_REQUESTED" ? true :
        movedTo === "REJECTED" ? false :
        undefined;

      if (isLead !== undefined) {
        const meta = details ?? previewLead ?? null;
        const custom = (meta?.custom || {}) as Record<string, any>;
        try {
          await apiFetch("/leads/ai/feedback", {
            method: "POST",
            json: {
              provider: custom.provider ?? "gmail",
              messageId: custom.messageId ?? "",
              leadId: targetId,
              isLead,
              snapshot: {
                subject: custom.subject ?? null,
                summary: custom.summary ?? null,
                emailOnCard: meta?.email ?? null,
                movedTo,
              },
            },
          });
        } catch {
          // non-fatal — ignore feedback errors in UI
        }
      }
    }
  } catch (e) {
    console.error("autosave failed:", e);
  } finally {
    setAutoSaving(false);
  }
}

  function mergeIntoForm(
    f: {
      contactName: string;
      email: string;
      status: LeadStatus;
      nextAction: string;
      nextActionAt: string;
      custom: Record<string, any>;
    } | null,
    patch: Partial<Lead>
  ) {
    if (!f) return f;
    const mergedCustom =
      patch.custom !== undefined ? { ...(f.custom || {}), ...(patch.custom as Record<string, any>) } : f.custom;
    return { ...f, ...(patch as any), custom: mergedCustom || f.custom };
  }

function openLead(lead: Lead) {
  // seed the modal form immediately
  setSelectedId(lead.id);
  setPreviewLead(lead);
  setForm({
    contactName: lead.contactName ?? "",
    email: (lead.email ?? "") as string,
    status: lead.status,
    nextAction: lead.nextAction ?? "",
    nextActionAt: lead.nextActionAt
      ? new Date(lead.nextActionAt).toISOString().slice(0, 16)
      : "",
    custom: { ...(lead.custom || {}) },
  });
  setOpen(true);

  // reset email details
  setEmailDetails(null);
  setLoadingEmail(false);

// fetch authoritative details (also brings in full body / attachments if present)
setLoadingDetails(true);
apiFetch<any>(`/leads/${lead.id}`)
  .then(async (raw) => {
    const d: Lead = (raw && (raw.lead ?? raw)) as Lead;
    setDetails(d);
    setForm({
      contactName: d.contactName ?? "",
      email: d.email ?? "",
      status: d.status,
      nextAction: d.nextAction ?? "",
      nextActionAt: d.nextActionAt
        ? new Date(d.nextActionAt).toISOString().slice(0, 16)
        : "",
      custom: { ...(d.custom || {}) },
    });

    // --- Fetch full Gmail message if present ---
    const provider = d.custom?.provider;
    const messageId = d.custom?.messageId as string | undefined;
    if (provider === "gmail" && messageId) {
      try {
        setLoadingEmail(true);
const msg = await apiFetch<EmailDetails>(`/gmail/message/${messageId}`);
setEmailDetails(msg);
      } catch (err) {
        console.error("Email details fetch failed:", err);
        setEmailDetails(null);
      } finally {
        setLoadingEmail(false);
      }
    } else {
      setEmailDetails(null);
    }
  })
  .catch((e) => console.error("Lead details fetch failed:", e))
  .finally(() => setLoadingDetails(false));
}
  /* ---------- initial data ---------- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      setError(null);
      const ok = await ensureDemoAuth();
      if (!ok) {
        if (!cancel) setError("Not authenticated");
        return;
      }
      try {
        const data = await apiFetch<Grouped>("/leads/grouped");
        if (!cancel) setGrouped(normaliseToNewStatuses(data));
      } catch (e: any) {
        if (!cancel) setError(`Failed to load: ${e?.message ?? "unknown"}`);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  /* ---------- field defs ---------- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;
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
    })();
    return () => {
      cancel = true;
    };
  }, []);

  /* ---------- UI ---------- */
  function handleLogout() {
    try {
      localStorage.removeItem("jwt");
    } catch {}
    window.location.href = "/login";
  }

// De-dupe any accidental duplicates in the active tab
const rows = useMemo(() => {
  const seen = new Set<string>();
  return grouped[tab].filter((l) => {
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
          <p className="text-sm text-slate-500">Tabbed list. Click a row to view & edit.</p>
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
            disabled={importing !== null}
            onClick={async () => {
              setImporting("gmail");
              try {
                await importFrom("gmail");
              } finally {
                setImporting(null);
              }
            }}
            title="Import recent emails from Gmail"
          >
            <span className="mr-2 inline-flex items-center">
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 11L4 24v14h8V23l12-8 12 8v15h8V24z" />
                <path fill="#FBBC04" d="M44 38h-8V23l8 5z" />
                <path fill="#34A853" d="M4 38h8V23l-8 5z" />
                <path fill="#4285F4" d="M24 11l12 8 8-5-20-13-20 13 8 5z" />
              </svg>
            </span>
            {importing === "gmail" ? "Importing…" : "Import Gmail"}
          </Button>

          <Button
            className="btn"
            disabled={importing !== null}
            onClick={async () => {
              setImporting("ms365");
              try {
                await importFrom("ms365");
              } finally {
                setImporting(null);
              }
            }}
            title="Import recent emails from Outlook 365"
          >
            <span className="mr-2 inline-flex items-center">
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#0078D4" d="M6 14h22v20H6z" />
                <path fill="#106EBE" d="M28 14h14v20H28z" />
                <path fill="#0359A6" d="M42 16v16l4 2V14z" />
                <rect x="10" y="18" width="14" height="12" fill="#fff" rx="2" />
              </svg>
            </span>
            {importing === "ms365" ? "Importing…" : "Import Outlook"}
          </Button>

          <Button
  className="btn btn-primary"
  onClick={async () => {
    const name = prompt("Enter lead name:");
    if (!name) return;
    try {
      const lead = await apiFetch("/leads", {
        method: "POST",
        json: { contactName: name, email: "", status: "NEW_ENQUIRY" },
      });
      // Refresh data
      const data = await apiFetch<Grouped>("/leads/grouped");
      setGrouped(normaliseToNewStatuses(data));
      alert("Lead created ✔");
    } catch (e) {
      alert("Failed to create lead: " + (e as any).message);
    }
  }}
>
  + New Lead
</Button>
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
      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
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
          <Row key={lead.id} lead={lead} onOpen={() => openLead(lead)} onStatus={(s) => autoSave({ status: s })} />
        ))}
      </div>

      {/* Modal */}
      <LeadModal
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setLeadPreview(null);
        }}
        leadPreview={leadPreview}
        onAutoSave={autoSave}
      />
      >
        <DialogContent className="w-[95vw] max-w-4xl md:max-w-5xl p-0">
          <div className="max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="p-4 md:p-6 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-sm font-medium">
                  {avatarText(form?.contactName ?? previewLead?.contactName)}
                </span>
                <input
                  className="w-full max-w-full rounded-md border p-2 text-base outline-none focus:ring-2"
                  placeholder="Name"
                  value={form?.contactName ?? ""}
                  onChange={(e) => setForm((f) => (f ? { ...f, contactName: e.target.value } : f))}
                  onBlur={(e) => autoSave({ contactName: e.target.value })}
                />
              </DialogTitle>
              <DialogDescription className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {autoSaving ? "Saving…" : "Changes are saved automatically"}
                </span>
              </DialogDescription>
            </DialogHeader>

{/* Scrollable content */}
<div className="px-4 md:px-6 pb-6 overflow-y-auto">
{/* ---- EMAIL ---- */}
<Section title="Email">
  {/* Summary */}
  {form?.custom?.summary ? (
    <div className="text-sm text-slate-700 mb-2">{form.custom.summary}</div>
  ) : null}

  {/* Meta (From / Date / Subject) */}
  {(emailDetails?.from ||
    emailDetails?.date ||
    emailDetails?.subject ||
    form?.custom?.from ||
    form?.custom?.date ||
    form?.custom?.subject) && (
    <div className="mb-2 text-[11px] text-slate-500 space-y-0.5">
      {(emailDetails?.from ?? form?.custom?.from) && (
        <div>From: {emailDetails?.from ?? form?.custom?.from}</div>
      )}
      {(emailDetails?.date ?? form?.custom?.date) && (
        <div>Date: {emailDetails?.date ?? form?.custom?.date}</div>
      )}
      {(emailDetails?.subject ?? form?.custom?.subject) && (
        <div>Subject: {emailDetails?.subject ?? form?.custom?.subject}</div>
      )}
    </div>
  )}

{/* Body with toggle */}
{(() => {
  const [showFull, setShowFull] = useState(false);
  const bodyText =
    emailDetails?.bodyText ??
    (form?.custom?.full as string | undefined) ??
    (form?.custom?.body as string | undefined) ??
    "No email body captured for this message.";

  return (
    <div className="mb-3">
      <button
        className="text-xs text-blue-600 underline mb-2"
        onClick={() => setShowFull(!showFull)}
      >
        {showFull ? "Hide full email" : "Show full email"}
      </button>
      {showFull && (
        <div className="rounded-md border bg-white/60 p-3 text-sm leading-relaxed shadow-inner max-h-[50vh] overflow-auto whitespace-pre-wrap break-words">
          {bodyText}
        </div>
      )}
    </div>
  );
})()}

  {/* Attachments (open inline) */}
{(() => {
  const atts = emailDetails?.attachments ?? [];
  const messageId = form?.custom?.messageId as string | undefined;
  if (!atts.length || !messageId) return null;

  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
      {atts.map((att: any) => {
        const attachmentId = att.attachmentId || att.id;
        if (!attachmentId) return null;

        const href = `${API_URL}/gmail/message/${messageId}/attachments/${attachmentId}?v=${Date.now()}`;

        const sizeLabel =
          typeof att.size === "number" ? ` (${Math.round(att.size / 1024)} KB)` : "";

        return (
          <a
            key={attachmentId}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border p-2 hover:bg-slate-50"
            title={att.filename || "Attachment"}
          >
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-slate-100">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M20.5 12.5l-7.78 7.78a5.5 5.5 0 01-7.78-7.78L12 5.22a3.5 3.5 0 114.95 4.95L9.64 17.48a1.5 1.5 0 01-2.12-2.12l7.07-7.07"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="truncate text-xs">
              {att.filename || "Attachment"}
              {sizeLabel}
            </span>
          </a>
        );
      })}
    </div>
  );
})()}
</Section>
              {/* CONTACT */}
              {form && (
                <>
                  <Section title="Contact">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <LabeledInput
                        label="Email"
                        type="email"
                        value={form.email}
                        onChange={(v) => setForm((f) => (f ? { ...f, email: v } : f))}
                        onBlurCommit={(v) => autoSave({ email: v || null })}
                      />

                      <LabeledSelect
                        label="Status"
                        value={form.status}
                        options={STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s }))}
                        onChange={(v) => setForm((f) => (f ? ({ ...f, status: v as LeadStatus } as any) : f))}
                        onCommit={(v) => autoSave({ status: v as LeadStatus })}
                      />

                      <LabeledInput
                        label="Next Action"
                        value={form.nextAction}
                        onChange={(v) => setForm((f) => (f ? { ...f, nextAction: v } : f))}
                        onBlurCommit={(v) => autoSave({ nextAction: v || null })}
                      />

                      <LabeledInput
                        label="Next Action At"
                        type="datetime-local"
                        value={form.nextActionAt}
                        onChange={(v) => setForm((f) => (f ? { ...f, nextActionAt: v } : f))}
                        onBlurCommit={(v) => autoSave({ nextActionAt: v ? new Date(v).toISOString() : null })}
                      />
                    </div>
                  </Section>

                  <Section title="Custom Fields">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {fieldDefs.length === 0 && (
                        <div className="col-span-2 text-xs text-slate-500">No custom fields yet.</div>
                      )}
                      {fieldDefs.map((def) => (
                        <DynamicFieldEditor
                          key={def.id}
                          def={def}
                          value={form.custom?.[def.key] ?? ""}
                          onChange={(v) =>
                            setForm((f) => (f ? { ...f, custom: { ...(f.custom || {}), [def.key]: v } } : f))
                          }
                          onCommit={(v) =>
                            autoSave({ custom: { ...(form?.custom || {}), [def.key]: v } as any })
                          }
                        />
                      ))}
                    </div>
                  </Section>
                </>
              )}
            </div>

            {/* Footer: confirm/reject visible only until you pick one */}
            <DialogFooter className="gap-2 p-4 border-t bg-white">
              {selectedId &&
                !(details?.custom?.aiFeedback || previewLead?.custom?.aiFeedback) && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        const t = details ?? previewLead!;
                        await autoSave({ status: "READY_TO_QUOTE" });
                        try {
                          await apiFetch("/leads/ai/feedback", {
                            method: "POST",
                            json: {
                              provider: t.custom?.provider ?? "gmail",
                              messageId: t.custom?.messageId,
                              leadId: t.id,
                              isLead: true,
                              snapshot: {
                                subject: t.custom?.subject ?? null,
                                summary: t.custom?.summary ?? null,
                                emailOnCard: t.email ?? null,
                              },
                            },
                          });
                        } catch {}
                      }}
                    >
                      ✓ Confirm
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={async () => {
                        const t = details ?? previewLead!;
                        await autoSave({ status: "REJECTED" });
                        try {
                          await apiFetch("/leads/ai/feedback", {
                            method: "POST",
                            json: {
                              provider: t.custom?.provider ?? "gmail",
                              messageId: t.custom?.messageId,
                              leadId: t.id,
                              isLead: false,
                              snapshot: {
                                subject: t.custom?.subject ?? null,
                                summary: t.custom?.summary ?? null,
                                emailOnCard: t.email ?? null,
                              },
                            },
                          });
                        } catch {}
                      }}
                    >
                      ✕ Reject
                    </Button>
                  </>
                )}
                
           
<Button
  variant="outline"
  onClick={() => setSendOpen(true)}
>
  ✉️ Send to Supplier
</Button>
   <div className="flex-1" />
              <Button onClick={() => setOpen(false)} className="btn">
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
        </Dialog>
        {/* --- Send to Supplier modal --- */}
<Dialog open={sendOpen} onOpenChange={setSendOpen}>
  <DialogContent className="w-[95vw] max-w-xl p-0">
    <div className="p-4 md:p-6">
      <DialogHeader className="p-0 mb-3">
        <DialogTitle>Send to Supplier</DialogTitle>
        <DialogDescription>Choose recipient, include notes, and pick attachments.</DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <label className="block">
          <div className="text-xs text-slate-600 mb-1">To (supplier email)</div>
          <input
            type="email"
            className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder="supplier@example.com"
          />
        </label>

        <label className="block">
          <div className="text-xs text-slate-600 mb-1">Subject</div>
          <input
            className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
            value={sendSubject}
            onChange={(e) => setSendSubject(e.target.value)}
          />
        </label>

        <label className="block">
          <div className="text-xs text-slate-600 mb-1">Message to supplier</div>
          <textarea
            className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2 min-h-[90px]"
            value={sendBody}
            onChange={(e) => setSendBody(e.target.value)}
            placeholder="Any extra context or notes…"
          />
        </label>

        {/* Questionnaire preview (all custom fields except system ones) */}
        <div className="rounded-md border p-3">
          <div className="text-xs font-semibold text-slate-600 mb-2">Questionnaire fields to include</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(form?.custom || {})
              .filter(([k]) => !["provider","messageId","subject","from","summary","full","body","date"].includes(k))
              .map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-slate-600 truncate">{k}</span>
                  <span className="text-slate-900 truncate max-w-[12rem]">{String(v)}</span>
                </div>
              ))}
            {Object.keys(form?.custom || {})
              .filter((k) => !["provider","messageId","subject","from","summary","full","body","date"].includes(k))
              .length === 0 && (
                <div className="text-xs text-slate-500">No extra fields yet.</div>
              )}
          </div>
        </div>

        {/* Attachments picker */}
        <div className="rounded-md border p-3">
          <div className="text-xs font-semibold text-slate-600 mb-2">Include attachments</div>
          {(emailDetails?.attachments?.length ?? 0) === 0 ? (
            <div className="text-xs text-slate-500">No attachments available</div>
          ) : (
            <div className="space-y-2">
              {emailDetails!.attachments!.map((att: any) => {
                const id = att.attachmentId || att.id;
                if (!id) return null;
                const checked = sendAttIds.includes(id);
                return (
                  <label key={id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSendAttIds((prev) =>
                          e.target.checked ? [...prev, id] : prev.filter((x) => x !== id)
                        )
                      }
                    />
                    <span className="truncate">
                      {att.filename || "Attachment"}{" "}
                      {typeof att.size === "number" ? `(${Math.round(att.size / 1024)} KB)` : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

<DialogFooter className="mt-4 p-0 pt-4">
  <div className="flex-1" />

  <Button variant="outline" onClick={() => setSendOpen(false)}>
    Cancel
  </Button>

  <Button
    onClick={async () => {
      try {
        const leadId = details?.id ?? previewLead?.id;
        if (!leadId) {
          alert("No lead loaded");
          return;
        }
        if (!sendTo) {
          alert("Please enter a supplier email address");
          return;
        }

        // Build questionnaire payload (exclude system/meta keys)
        const fields: Record<string, any> = {};
        Object.entries(form?.custom || {}).forEach(([k, v]) => {
          if (!["provider", "messageId", "subject", "from", "summary", "full", "body", "date"].includes(k)) {
            fields[k] = v;
          }
        });

        // Build attachment refs for backend (Gmail source)
        const attachments = sendAttIds.map((attachmentId) => ({
          source: "gmail" as const,
          messageId: form?.custom?.messageId as string | undefined,
          attachmentId,
        }));

        // Fallback subject if empty
        const subj =
          sendSubject?.trim() ||
          `Quote request – ${
            form?.contactName || details?.contactName || previewLead?.contactName || "Lead"
          }`;

        // --- Call backend and type response to avoid TS errors ---
        const resp = await apiFetch<{ ok?: boolean; sent?: boolean; aiBody?: string; aiSubject?: string }>(
          `/leads/${leadId}/request-supplier-quote`,
          {
            method: "POST",
            json: {
              to: sendTo,
              subject: subj,
              text: sendBody,
              fields,
              attachments,
            },
          }
        );

        // --- Handle backend response ---
        if (resp?.ok || resp?.sent) {
          alert("Supplier quote request sent ✔");
          setSendOpen(false);
        } else if (resp?.aiBody) {
          // The backend returned an AI-suggested draft — show it to the user for review
          setSendBody(resp.aiBody);
          if (resp.aiSubject) setSendSubject(resp.aiSubject);
          alert("AI has improved your email draft. Please review and send again.");
        } else {
          alert("Send completed, but response was unexpected.");
          setSendOpen(false);
        }
      } catch (e: any) {
        console.error(e);
        const msg = e?.message || "unknown error";
        alert("Failed to send: " + msg);
      }
    }}
  >
    Send
  </Button>
</DialogFooter>
    </div>
  </DialogContent>
</Dialog>
    
    </div>
  );
}

/* ---------------- Row ---------------- */
/* ---------------- Row (full-width) ---------------- */
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
        {/* Clicking the left side opens modal */}
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
        {/* --- Quick actions + dropdown --- */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          {/* Reject */}
          <button
            className="rounded-md border border-red-300 text-red-600 px-2 py-1 text-[11px] hover:bg-red-50"
            title="Reject this enquiry"
            onClick={(e) => {
              e.stopPropagation();
              onStatus("REJECTED");
            }}
          >
            ✕ Reject
          </button>
          <button
            className="rounded-md border border-amber-300 text-amber-600 px-2 py-1 text-[11px] hover:bg-amber-50"

          {/* Ask for info */}
          <button
            className="rounded-md border border-amber-300 text-amber-600 px-2 py-1 text-[11px] hover:bg-amber-50"
            title="Request more information"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await apiFetch(`/leads/${lead.id}/request-info`, { method: "POST" });
                onStatus("INFO_REQUESTED");
                alert("Questionnaire link sent ✔");
              } catch {
                alert("Questionnaire link sent to customer ✔");
              } catch (err) {
                alert("Failed to request info");
              }
            }}
          >
            📋 Info
          </button>
          <button
            className="rounded-md border border-green-300 text-green-600 px-2 py-1 text-[11px] hover:bg-green-50"

          {/* Ready to quote */}
          <button
            className="rounded-md border border-green-300 text-green-600 px-2 py-1 text-[11px] hover:bg-green-50"
            title="Mark as ready to quote"
            onClick={(e) => {
              e.stopPropagation();
              onStatus("READY_TO_QUOTE");
            }}
          >
            ✅ Ready
          </button>

          {/* Optional: keep dropdown */}
          <select
            className="rounded-md border bg-white p-2 text-xs mt-1"
            value={lead.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onStatus(e.target.value.toUpperCase() as LeadStatus)}
          >
            {(["NEW_ENQUIRY","INFO_REQUESTED","DISQUALIFIED","REJECTED","READY_TO_QUOTE"] as LeadStatus[])
              .map((s) => (
            {STATUSES.map((s) => (
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

/* ---------------- Pretty bits & inputs ---------------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3 mb-3">
      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-600">{title}</div>
      {children}
    </div>
  );
}

function LabeledInput({
  label,
  type = "text",
  value,
  onChange,
  onBlurCommit,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onBlurCommit?: (v: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <input
        className="w-full max-w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlurCommit?.(e.target.value)}
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  onCommit?: (v: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <select
        className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit?.(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DynamicFieldEditor({
  def,
  value,
  onChange,
  onCommit,
}: {
  def: FieldDef;
  value: any;
  onChange: (v: any) => void;
  onCommit?: (v: any) => void;
}) {
  const wrap = (node: React.ReactNode) => (
    <label className="space-y-1.5">
      <div className="text-xs text-slate-600">{def.label}</div>
      {node}
    </label>
  );

  const common = { onBlur: (e: any) => onCommit?.(e.target.value) };

  switch (def.type) {
    case "number":
      return wrap(
        <input
          className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          {...common}
        />
      );
    case "date":
      return wrap(
        <input
          className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      );
    case "select":
      return wrap(
        <select
          className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit?.(e.target.value)}
        >
          <option value=""></option>
          {(def.config?.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    default:
      return wrap(
        <input
          className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      );
  }
}

/* --------------- Helpers --------------- */
function avatarText(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}