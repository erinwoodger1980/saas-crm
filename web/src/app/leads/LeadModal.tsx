// web/src/app/leads/LeadModal.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";

/* ----------------------------- Types ----------------------------- */

export type Lead = {
  id: string;
  contactName?: string | null;
  email?: string | null;
  status:
    | "NEW_ENQUIRY"
    | "INFO_REQUESTED"
    | "DISQUALIFIED"
    | "REJECTED"
    | "READY_TO_QUOTE"
    | "QUOTE_SENT"
    | "WON"
    | "LOST";
  custom?: any;
  description?: string | null;
};

type Task = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  relatedType?: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  relatedId?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
};

type TenantSettings = {
  slug: string;
  questionnaire?: {
    title?: string;
    questions?: Array<{ id: string; label: string }>;
  };
};

const STATUS_LABELS: Record<Lead["status"], string> = {
  NEW_ENQUIRY: "New enquiry",
  INFO_REQUESTED: "Info requested",
  DISQUALIFIED: "Disqualified",
  REJECTED: "Rejected",
  READY_TO_QUOTE: "Ready to quote",
  QUOTE_SENT: "Quote sent",
  WON: "Won",
  LOST: "Lost",
};

/* ---------------- Status mapping ---------------- */

const uiToServerStatus: Record<Lead["status"], string> = {
  NEW_ENQUIRY: "NEW",
  INFO_REQUESTED: "INFO_REQUESTED",
  DISQUALIFIED: "DISQUALIFIED",
  REJECTED: "REJECTED",
  READY_TO_QUOTE: "READY_TO_QUOTE",
  QUOTE_SENT: "QUOTE_SENT",
  WON: "WON",
  LOST: "LOST",
};

function serverToUiStatus(s?: string | null): Lead["status"] {
  switch ((s || "").toUpperCase()) {
    case "NEW":
      return "NEW_ENQUIRY";
    case "CONTACTED":
    case "INFO_REQUESTED":
      return "INFO_REQUESTED";
    case "QUALIFIED":
    case "READY_TO_QUOTE":
      return "READY_TO_QUOTE";
    case "QUOTE_SENT":
      return "QUOTE_SENT";
    case "DISQUALIFIED":
      return "DISQUALIFIED";
    case "REJECTED":
      return "REJECTED";
    case "WON":
      return "WON";
    case "LOST":
      return "LOST";
    default:
      return "NEW_ENQUIRY";
  }
}

/* ----------------------------- Utils ----------------------------- */

function get(obj: any, path: string) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}
function pickFirst<T>(...vals: Array<T | null | undefined>): T | undefined {
  for (const v of vals) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      if (v.trim() !== "") return v as T;
    } else return v as T;
  }
  return undefined;
}
function avatarText(name?: string | null) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1]?.[0] || p[0][1] || "")).toUpperCase();
}
function toast(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.className =
    "fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-xl shadow-lg z-[1000]";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

/* ----------------------------- Component ----------------------------- */

export default function LeadModal({
  open,
  onOpenChange,
  leadPreview,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadPreview: Lead | null;
  onUpdated?: () => void;
}) {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";
  const userId = ids?.userId || "";

  const authHeaders = useMemo(
    () => ({ "x-tenant-id": tenantId, "x-user-id": userId }),
    [tenantId, userId]
  );

  const [lead, setLead] = useState<Lead | null>(leadPreview);
  const [uiStatus, setUiStatus] = useState<Lead["status"]>("NEW_ENQUIRY");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<TenantSettings | null>(null);

  // editable fields
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [descInput, setDescInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTask, setBusyTask] = useState(false);

  const lastSavedServerStatusRef = useRef<string | null>(null);

  const showEstimateCta = useMemo(
    () => uiStatus === "READY_TO_QUOTE" || uiStatus === "QUOTE_SENT" || uiStatus === "WON",
    [uiStatus]
  );

  // keep preview visible immediately
  useEffect(() => {
    if (!leadPreview?.id) return;
    setLead((prev) =>
      !prev || prev.id !== leadPreview.id
        ? {
            id: leadPreview.id,
            contactName: leadPreview.contactName ?? null,
            email: leadPreview.email ?? null,
            status: leadPreview.status ?? "NEW_ENQUIRY",
            custom: leadPreview.custom ?? null,
            description: leadPreview.description ?? null,
          }
        : prev
    );
  }, [leadPreview?.id]);

  // load full lead + tasks + settings
  useEffect(() => {
    if (!open || !leadPreview?.id) return;
    let stop = false;

    (async () => {
      setLoading(true);
      try {
        const [one, tlist, s] = await Promise.all([
          apiFetch<{ lead?: any } | any>(`/leads/${leadPreview.id}`, { headers: authHeaders }),
          apiFetch<{ items: Task[]; total: number }>(
            `/tasks?relatedType=LEAD&relatedId=${encodeURIComponent(leadPreview.id)}&mine=false`,
            { headers: authHeaders }
          ),
          apiFetch<TenantSettings>("/tenant/settings", { headers: authHeaders }).catch(() => null as any),
        ]);
        if (stop) return;

        // tolerate either shape: {lead} or the row directly
        const row = (one && "lead" in one ? one.lead : one) ?? {};
        const sUi = serverToUiStatus(row.status);
        lastSavedServerStatusRef.current = row.status ?? null;

        const contactName =
          pickFirst<string>(row.contactName, get(row, "contact.name"), leadPreview.contactName) ?? null;
        const email =
          pickFirst<string>(row.email, get(row, "contact.email"), get(row, "custom.fromEmail"), leadPreview.email) ??
          null;
        const description =
          pickFirst<string>(row.description, get(row, "custom.description"), get(row, "custom.bodyText")) ?? null;

        const normalized: Lead = {
          id: row.id || leadPreview.id,
          contactName,
          email,
          status: sUi,
          custom: row.custom ?? row.briefJson ?? null,
          description,
        };
        setLead(normalized);
        setUiStatus(sUi);

        // seed inputs
        setNameInput(contactName || "");
        setEmailInput(email || "");
        setDescInput(description || "");

        s// After fetching full lead + tasks list:
setTasks(tlist?.items ?? []);
if (s) setSettings(s);

// Seed only for brand-new enquiries (idempotent on server)
if (sUi === "NEW_ENQUIRY") {
  await ensureTaskOnce("Review enquiry", { dueDays: 1, priority: "MEDIUM" });
  await reloadTasks();
}

// Seed only if it doesn't already exist in the freshly fetched list
async function ensureTaskOnce(
  title: string,
  opts?: { dueDays?: number; priority?: Task["priority"]; relatedType?: Task["relatedType"] }
) {
  if (!lead?.id) return;
  const dueAt =
    (opts?.dueDays ?? 0) > 0
      ? new Date(Date.now() + (opts!.dueDays! * 86_400_000)).toISOString()
      : undefined;

  await apiFetch("/tasks/ensure", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    json: {
      title,
      priority: opts?.priority ?? "MEDIUM",
      relatedType: opts?.relatedType ?? "LEAD",
      relatedId: lead.id,
      dueAt,
      meta: { source: "lead_modal_seed" },
    },
  });
}
      } finally {
        if (!stop) setLoading(false);
      }
    })();

    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadPreview?.id]);

  /* ----------------------------- Save helpers ----------------------------- */

  async function saveStatus(nextUi: Lead["status"]) {
    if (!lead?.id) return;
    const nextServer = uiToServerStatus[nextUi];
    if (lastSavedServerStatusRef.current === nextServer) return;

    setSaving(true);
    try {
      await apiFetch(`/leads/${lead.id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        json: { status: nextServer },
      });
      lastSavedServerStatusRef.current = nextServer;
      setLead((l) => (l ? { ...l, status: nextUi } : l));
      setUiStatus(nextUi);
      onUpdated?.();

      // status-driven task seeds
      if (nextUi === "READY_TO_QUOTE") {
        await ensureTaskOnce("Create quote", { dueDays: 2, priority: "HIGH" });
        await reloadTasks();
      }
      toast("Saved. One step closer.");
    } catch (e: any) {
      console.error("status save failed", e?.message || e);
      setUiStatus(serverToUiStatus(lastSavedServerStatusRef.current));
      alert(`Failed to save status: ${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function savePatch(patch: any) {
    if (!lead?.id) return;
    try {
      await apiFetch(`/leads/${lead.id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        json: patch,
      });
      onUpdated?.();
    } catch (e: any) {
      console.error("patch failed", e?.message || e);
      alert("Failed to save changes");
    }
  }

  async function reloadTasks() {
    if (!lead?.id) return;
    const data = await apiFetch<{ items: Task[]; total: number }>(
      `/tasks?relatedType=LEAD&relatedId=${encodeURIComponent(lead.id)}&mine=false`,
      { headers: authHeaders }
    );
    setTasks(data.items || []);
  }

// Replace both hasTask + ensureTaskOnce with this pair
function taskExists(list: Task[] | undefined, leadId: string | undefined, title: string) {
  if (!list || !leadId) return false;
  const t = title.trim().toLowerCase();
  return list.some(
    (x) =>
      x.relatedType === "LEAD" &&
      x.relatedId === leadId &&
      x.status !== "CANCELLED" &&
      x.title.trim().toLowerCase() === t
  );
}

async function ensureTaskOnce(
  title: string,
  opts?: Partial<Task> & { dueDays?: number; relatedType?: Task["relatedType"]; existing?: Task[] }
) {
  if (!lead?.id) return;
  const exists = taskExists(opts?.existing ?? tasks, lead?.id, title);
  if (exists) return;

  const dueAt =
    (opts?.dueDays ?? 0) > 0
      ? new Date(Date.now() + (opts!.dueDays! * 86_400_000)).toISOString()
      : undefined;

  await apiFetch("/tasks", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    json: {
      title,
      priority: opts?.priority ?? "MEDIUM",
      relatedType: opts?.relatedType ?? "LEAD",
      relatedId: lead.id,
      dueAt,
      assignees: [{ userId, role: "OWNER" }],
      meta: { source: "lead_modal_seed" },
    },
  });
}

  async function toggleTaskComplete(t: Task) {
    const url = t.status === "DONE" ? `/tasks/${t.id}/reopen` : `/tasks/${t.id}/complete`;
    await apiFetch(url, { method: "POST", headers: authHeaders });
    await reloadTasks();
  }

  /* ----------------------------- Actions ----------------------------- */

  async function rejectEnquiry() {
    setUiStatus("REJECTED");
    await saveStatus("REJECTED");
  }

  async function sendQuestionnaire() {
    if (!lead?.id) return;
    setBusyTask(true);
    try {
      // we don't create a "Send questionnaire" task; we create the follow-up the user will do later
      await ensureTaskOnce("Review questionnaire", { dueDays: 2, priority: "MEDIUM" });

      // move to Info requested
      setUiStatus("INFO_REQUESTED");
      await saveStatus("INFO_REQUESTED");

      // open mailto with public link if we have a slug
      if (lead.email && settings?.slug) {
        const link = `${window.location.origin}/q/${settings.slug}/${encodeURIComponent(lead.id)}`;
        const body =
          `Hi${lead.contactName ? " " + lead.contactName : ""},\n\n` +
          `Please fill in this short questionnaire so we can prepare your estimate:\n${link}\n\n` +
          `Thanks!`;
        openMailTo(lead.email, "Questionnaire for your estimate", body);
      }
      await reloadTasks();
      toast("Questionnaire sent. Follow-up added.");
    } finally {
      setBusyTask(false);
    }
  }

  async function requestSupplierPrice() {
    if (!lead?.id) return;
    setBusyTask(true);
    try {
      await ensureTaskOnce("Chase supplier price", { dueDays: 3, priority: "MEDIUM" });

      const supplier = prompt("Supplier email (optional):");
      if (supplier) {
        openMailTo(
          supplier,
          `Price request: ${lead.contactName || "Project"}`,
          "Hi,\n\nCould you price the attached items?\n\nThanks!"
        );
      }
      await reloadTasks();
      toast("Supplier request sent. Follow-up added.");
    } finally {
      setBusyTask(false);
    }
  }

  async function createDraftEstimate() {
    if (!lead?.id) return;
    setSaving(true);
    try {
      const quote = await apiFetch<any>("/quotes", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        json: {
          leadId: lead.id,
          title: `Estimate for ${lead.contactName || lead.email || "Lead"}`,
          notes: "Draft created from Lead.",
        },
      });

      await ensureTaskOnce("Complete draft estimate", {
        priority: "HIGH",
        relatedType: "QUOTE",
        relatedId: quote?.id,
        dueDays: 1,
      } as any);

      await reloadTasks();
      toast("Draft estimate created.");
    } catch (e) {
      console.error(e);
      alert("Failed to create draft estimate");
    } finally {
      setSaving(false);
    }
  }

  function openMailTo(to: string, subject: string, body?: string) {
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}${
      body ? `&body=${encodeURIComponent(body)}` : ""
    }`;
    window.open(url, "_blank");
  }

  /* ----------------------------- Email context ----------------------------- */

  const emailSubject = pickFirst<string>(get(lead?.custom, "subject"));
  const emailSnippet = pickFirst<string>(get(lead?.custom, "snippet"), get(lead?.custom, "summary"));
  const fromEmail = pickFirst<string>(get(lead?.custom, "fromEmail"), lead?.email);
  const openTasks = tasks.filter(t => t.status !== "DONE");
const completedToday = tasks.filter(t =>
  t.status === "DONE" &&
  t.completedAt &&
  new Date(t.completedAt).toDateString() === new Date().toDateString()
);

  /* ----------------------------- Render ----------------------------- */

  if (!open || !lead) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div className="w-[min(1000px,92vw)] max-h-[88vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 sm:px-6 py-3">
          <div className="inline-grid place-items-center h-9 w-9 rounded-xl bg-slate-100 text-[11px] font-semibold text-slate-700 border">
            {avatarText(lead.contactName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{lead.contactName || lead.email || "Lead"}</div>
            <div className="text-xs text-slate-500 truncate">{lead.email || ""}</div>
          </div>

          <label className="text-xs text-slate-500 mr-2">Status</label>
          <select
            value={uiStatus}
            className="rounded-lg border px-2 py-1 text-sm"
            onChange={(e) => {
              const nextUi = e.target.value as Lead["status"];
              setUiStatus(nextUi);
              saveStatus(nextUi);
            }}
            disabled={saving}
          >
            {(Object.keys(STATUS_LABELS) as Lead["status"][]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          {showEstimateCta && (
            <button
              className="ml-3 rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm hover:bg-emerald-700"
              onClick={createDraftEstimate}
              disabled={saving}
            >
              Create Draft Estimate
            </button>
          )}

          <button
            className="ml-2 rounded-lg border px-3 py-1.5 text-sm"
            onClick={() => onOpenChange(false)}
            disabled={saving || loading}
          >
            Close
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2 border-b bg-slate-50/50">
          <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-white" onClick={rejectEnquiry} disabled={saving}>
            ✕ Reject enquiry
          </button>

          <button
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-white"
            onClick={sendQuestionnaire}
            disabled={busyTask || saving}
          >
            📄 Send questionnaire
          </button>

          <button
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-white"
            onClick={requestSupplierPrice}
            disabled={busyTask}
          >
            📨 Request supplier price
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {/* Left – Details */}
          <div className="md:col-span-2 border-r min-h-[60vh] overflow-auto p-4 sm:p-6 space-y-4">
            <section className="rounded-xl border bg-white p-4 space-y-3">
              <div className="text-sm font-medium text-slate-900">Details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block text-xs text-slate-500 mb-1">Name</span>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={() => {
                      setLead((l) => (l ? { ...l, contactName: nameInput || null } : l));
                      savePatch({ contactName: nameInput || null });
                    }}
                    placeholder="Client name"
                  />
                </label>

                <label className="text-sm">
                  <span className="block text-xs text-slate-500 mb-1">Email</span>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onBlur={() => {
                      setLead((l) => (l ? { ...l, email: emailInput || null } : l));
                      savePatch({ email: emailInput || null });
                    }}
                    placeholder="client@email.com"
                  />
                </label>
              </div>

              <label className="text-sm block">
                <span className="block text-xs text-slate-500 mb-1">Client notes</span>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 min-h-28"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  onBlur={() => {
                    setLead((l) => (l ? { ...l, description: descInput || null } : l));
                    savePatch({ description: descInput || null });
                  }}
                  placeholder="Project background, requirements, constraints…"
                />
              </label>
            </section>

            {(emailSubject || emailSnippet || fromEmail) && (
              <section className="rounded-xl border bg-white p-4">
                <div className="text-sm font-medium text-slate-900">Email</div>
                <div className="mt-2 text-sm text-slate-700 space-y-1">
                  {fromEmail && (
                    <div>
                      <span className="text-slate-500">From:</span> {String(fromEmail)}
                    </div>
                  )}
                  {emailSubject && (
                    <div>
                      <span className="text-slate-500">Subject:</span> {emailSubject}
                    </div>
                  )}
                  {emailSnippet && <div className="text-slate-600">{emailSnippet}</div>}
                </div>
              </section>
            )}

            {settings?.slug && settings?.questionnaire?.questions?.length ? (
              <section className="rounded-xl border bg-white p-4">
                <div className="text-sm font-medium text-slate-900">
                  {settings?.questionnaire?.title || "Questionnaire"}
                </div>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {settings.questionnaire.questions.map((q) => (
                    <li key={q.id} className="list-disc ml-5">
                      {q.label}
                    </li>
                  ))}
                </ul>
                <a
                  href={`${window.location.origin}/q/${settings.slug}/${encodeURIComponent(lead.id)}`}
                  className="inline-block mt-3 text-sm underline text-blue-700"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open public questionnaire
                </a>
              </section>
            ) : null}
          </div>

          {/* Right – Tasks */}
          <aside className="md:col-span-1 min-h-[60vh] overflow-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">Tasks</div>
              <div className="text-xs text-slate-500">
                {tasks.filter((t) => t.status !== "DONE").length} open
              </div>
            </div>

            <div className="space-y-2">
              {loading && <div className="text-sm text-slate-500">Loading…</div>}
              {!loading && tasks.length === 0 && (
                <div className="text-sm text-slate-500">No tasks yet.</div>
              )}
              {tasks.map((t) => {
                const done = t.status === "DONE";
                const doneToday =
                  done && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString();
                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border p-3 bg-white flex items-start gap-3 ${doneToday ? "opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleTaskComplete(t)}
                      className="mt-1"
                      aria-label={`Complete ${t.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{done ? "✓ " : ""}{t.title}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {t.dueAt ? new Date(t.dueAt).toLocaleString() : "No due date"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-slate-500">
              Tip: Completing a lead action will tick the task automatically.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}