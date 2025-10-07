"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ---------------- Types ---------------- */
type Lead = {
  id: string;
  contactName: string;
  email?: string | null;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "DISQUALIFIED";
  nextAction?: string | null;
  nextActionAt?: string | null;
  custom?: Record<string, any>;
};

type Grouped = {
  NEW: Lead[];
  CONTACTED: Lead[];
  QUALIFIED: Lead[];
  DISQUALIFIED: Lead[];
};

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

const STATUSES: Lead["status"][] = ["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED"];

/* --------------- Page --------------- */
export default function LeadsPage() {
  const [grouped, setGrouped] = useState<Grouped>({
    NEW: [],
    CONTACTED: [],
    QUALIFIED: [],
    DISQUALIFIED: [],
  });

  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // modal state
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [details, setDetails] = useState<Lead | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    contactName: string;
    email: string;
    status: Lead["status"];
    nextAction: string;
    nextActionAt: string;
    custom: Record<string, any>;
  } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /* ---------- initial data (guarded by ensureDemoAuth) ---------- */
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
        if (!cancel) setGrouped(data);
      } catch (e: any) {
        if (!cancel) setError(`Failed to load: ${e?.message ?? "unknown"}`);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  /* ---------- field defs (also wait for auth) ---------- */
  useEffect(() => {
    let cancel = false;

    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;

      try {
        const defs = await apiFetch<FieldDef[]>("/leads/fields");
        if (!cancel) setFieldDefs(defs);
      } catch {
        if (!cancel) setFieldDefs([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  /* ---------- load details when selected ---------- */
  useEffect(() => {
    if (!selectedId) return;

    // 1) Seed from preview immediately so modal isn’t blank
    if (previewLead) {
      setForm({
        contactName: previewLead.contactName ?? "",
        email: previewLead.email ?? "",
        status: previewLead.status,
        nextAction: previewLead.nextAction ?? "",
        nextActionAt: previewLead.nextActionAt
          ? new Date(previewLead.nextActionAt).toISOString().slice(0, 16)
          : "",
        custom: { ...(previewLead.custom || {}) },
      });
    }

    // 2) Fetch authoritative details
    setLoadingDetails(true);
    setDetails(null);

    apiFetch<any>(`/leads/${selectedId}`)
      .then((raw) => {
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
      })
      .catch((e) => console.error("Lead details fetch failed:", e))
      .finally(() => setLoadingDetails(false));
  }, [selectedId, previewLead]);

  const allIds = useMemo(
    () => ({
      NEW: grouped.NEW.map((l) => l.id),
      CONTACTED: grouped.CONTACTED.map((l) => l.id),
      QUALIFIED: grouped.QUALIFIED.map((l) => l.id),
      DISQUALIFIED: grouped.DISQUALIFIED.map((l) => l.id),
    }),
    [grouped]
  );

  const activeLead = useMemo(
    () =>
      (activeId &&
        (grouped.NEW.find((l) => l.id === activeId) ||
          grouped.CONTACTED.find((l) => l.id === activeId) ||
          grouped.QUALIFIED.find((l) => l.id === activeId) ||
          grouped.DISQUALIFIED.find((l) => l.id === activeId))) ||
      null,
    [activeId, grouped]
  );

  /* ---------- DnD helpers ---------- */
  function getContainerOf(id: string | null): Lead["status"] | null {
    if (!id) return null;
    if (STATUSES.includes(id as Lead["status"])) return id as Lead["status"];
    for (const s of STATUSES) {
      if (allIds[s].includes(id)) return s;
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const from = getContainerOf(activeId);
    const to = getContainerOf(overId);
    if (!from || !to) return;

    const fromList = grouped[from];
    const toList = grouped[to];
    const activeIndex = fromList.findIndex((l) => l.id === activeId);

    let overIndex: number;
    if (STATUSES.includes(overId as any)) {
      overIndex = toList.length;
    } else {
      const idxInTo = toList.findIndex((l) => l.id === overId);
      overIndex = idxInTo < 0 ? toList.length : idxInTo;
    }

    if (from === to && activeIndex === overIndex) return;

    const prev = structuredClone(grouped) as Grouped;

    setGrouped((g) => {
      const next: Grouped = {
        ...g,
        [from]: [...g[from]],
        [to]: [...g[to]],
      };
      const [moved] = next[from].splice(activeIndex, 1);
      const movedUpdated = from === to ? moved : { ...moved, status: to };
      next[to].splice(overIndex, 0, movedUpdated);

      if (from === to) {
        next[to] = arrayMove(
          next[to],
          next[to].findIndex((l) => l.id === activeId),
          overIndex
        );
      }
      return next;
    });

    if (from !== to) {
      try {
        await apiFetch(`/leads/${activeId}`, { method: "PATCH", json: { status: to } });
      } catch {
        setGrouped(prev); // rollback
      }
    }
  }

  /* ---------- AI Feedback (confirm / reject) ---------- */
  async function sendFeedback(lead: Lead, isLead: boolean) {
    const provider = lead.custom?.provider ?? "gmail";
    const messageId = lead.custom?.messageId ?? undefined;

    // optimistic tiny flag
    setGrouped((g) => {
      const next = structuredClone(g) as Grouped;
      for (const s of STATUSES) {
        const i = next[s].findIndex((l) => l.id === lead.id);
        if (i >= 0) {
          const custom = { ...(next[s][i].custom || {}) };
          custom.aiFeedback = { isLead, at: new Date().toISOString() };
          next[s][i] = { ...next[s][i], custom };
          break;
        }
      }
      return next;
    });

    try {
      await apiFetch("/leads/ai/feedback", {
        method: "POST",
        json: {
          provider,
          messageId,
          leadId: lead.id,
          isLead,
          snapshot: {
            subject: lead.custom?.subject ?? null,
            summary: lead.custom?.summary ?? null,
            emailOnCard: lead.email ?? null,
          },
        },
      });
    } catch (e) {
      console.error("feedback failed:", e);
    }
  }

  /* ---------- Save (modal) ---------- */
  async function saveEdits() {
    const targetId = details?.id ?? previewLead?.id ?? selectedId ?? null;
    const fromStatus = details?.status ?? previewLead?.status ?? form?.status ?? null;
    const toStatus = form?.status ?? fromStatus;
    if (!targetId || !toStatus || !STATUSES.includes(toStatus)) {
      alert("Missing or invalid data; please try again.");
      return;
    }

    setSaving(true);

    const payload = {
      contactName: form?.contactName.trim() ?? "",
      email: form?.email.trim() || null,
      status: toStatus,
      nextAction: form?.nextAction.trim() || null,
      nextActionAt: form?.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
      custom: form?.custom ?? {},
    };

    const prev = structuredClone(grouped) as Grouped;

    try {
      setGrouped((g) => {
        const next = structuredClone(g) as Grouped;
        const safeFrom = (fromStatus && STATUSES.includes(fromStatus) ? fromStatus : toStatus)!;
        const safeTo = toStatus;

        if (!next[safeFrom]) (next as any)[safeFrom] = [];
        if (!next[safeTo]) (next as any)[safeTo] = [];

        if (safeFrom === safeTo) {
          const list = next[safeTo];
          const idx = list.findIndex((l) => l.id === targetId);
          if (idx >= 0) list[idx] = { ...list[idx], ...payload } as Lead;
        } else {
          const fromList = next[safeFrom];
          const toList = next[safeTo];
          const idx = fromList.findIndex((l) => l.id === targetId);
          if (idx >= 0) {
            const updated = { ...fromList[idx], ...payload } as Lead;
            fromList.splice(idx, 1);
            toList.unshift(updated);
          } else {
            toList.unshift({ id: targetId, ...payload } as Lead);
          }
        }
        return next;
      });

      await apiFetch(`/leads/${targetId}`, { method: "PATCH", json: payload });

      setDetails((d) => (d ? ({ ...d, ...payload } as Lead) : d));
      setPreviewLead((p) => (p ? ({ ...p, ...payload } as Lead) : p));
    } catch (e) {
      setGrouped(prev);
      console.error(e);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Logout ---------- */
  function handleLogout() {
    try {
      localStorage.removeItem("jwt");
    } catch {}
    window.location.href = "/login";
  }

  return (
    <div className="p-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-slate-500">
            Drag cards using the handle ⋮⋮ to move between columns. Click a card to view & edit.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button className="btn">Import</Button>
          <Button className="btn btn-primary">New Lead</Button>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((status) => (
            <Column
              key={status}
              id={status}
              title={labelFor(status)}
              count={grouped[status].length}
              items={grouped[status]}
              onOpen={(lead) => {
                setSelectedId(lead.id);
                setPreviewLead(lead);
                setForm({
                  contactName: lead.contactName ?? "",
                  email: lead.email ?? "",
                  status: lead.status,
                  nextAction: lead.nextAction ?? "",
                  nextActionAt: lead.nextActionAt
                    ? new Date(lead.nextActionAt).toISOString().slice(0, 16)
                    : "",
                  custom: { ...(lead.custom || {}) },
                });
                setOpen(true);
              }}
              onFeedback={sendFeedback}
            />
          ))}
        </div>

        <DragOverlay>{activeLead ? <Card lead={activeLead} isOverlay /> : null}</DragOverlay>
      </DndContext>

      {/* Details modal */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setSelectedId(null);
            setPreviewLead(null);
            setDetails(null);
            setForm(null);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-sm font-medium">
                {avatarText(form?.contactName ?? previewLead?.contactName)}
              </span>
              <input
                className="w-full max-w-full rounded-md border p-2 text-base outline-none focus:ring-2"
                placeholder="Name"
                value={form?.contactName ?? ""}
                onChange={(e) => setForm((f) => (f ? { ...f, contactName: e.target.value } : f))}
              />
            </DialogTitle>
            <DialogDescription>Full details for this lead.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loadingDetails && <div className="text-sm text-slate-500">Loading details…</div>}

            {(form?.custom?.subject || form?.custom?.summary) && (
              <Section title="Email">
                <div className="space-y-1">
                  {form?.custom?.subject && (
                    <div className="text-sm font-medium line-clamp-2">{form.custom.subject}</div>
                  )}
                  {form?.custom?.summary && (
                    <div className="text-xs text-slate-600 line-clamp-4">{form.custom.summary}</div>
                  )}
                </div>
              </Section>
            )}

            {form && (
              <>
                <Section title="Contact">
                  <div className="grid grid-cols-2 gap-3">
                    <LabeledInput
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={(v) => setForm((f) => (f ? { ...f, email: v } : f))}
                    />
                    <LabeledSelect
                      label="Status"
                      value={form.status}
                      onChange={(v) =>
                        setForm((f) => (f ? ({ ...f, status: v as Lead["status"] } as any) : f))
                      }
                      options={STATUSES.map((s) => ({ label: labelFor(s), value: s }))}
                    />
                    <LabeledInput
                      label="Next Action"
                      value={form.nextAction}
                      onChange={(v) => setForm((f) => (f ? { ...f, nextAction: v } : f))}
                    />
                    <LabeledInput
                      label="Next Action At"
                      type="datetime-local"
                      value={form.nextActionAt}
                      onChange={(v) => setForm((f) => (f ? { ...f, nextActionAt: v } : f))}
                    />
                  </div>
                </Section>

                <Section title="Custom Fields">
                  <div className="grid grid-cols-2 gap-3">
                    {fieldDefs.length === 0 && (
                      <div className="col-span-2 text-xs text-slate-500">No custom fields yet.</div>
                    )}
                    {fieldDefs.map((def) => (
                      <DynamicFieldEditor
                        key={def.id}
                        def={def}
                        value={form.custom?.[def.key] ?? ""}
                        onChange={(v) =>
                          setForm((f) =>
                            f ? { ...f, custom: { ...(f.custom || {}), [def.key]: v } } : f
                          )
                        }
                      />
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>

          <DialogFooter className="mt-2 gap-2">
            {selectedId && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const target =
                      details ?? previewLead ?? (grouped.NEW.find((l) => l.id === selectedId) as Lead | undefined);
                    if (target) sendFeedback(target, true);
                  }}
                >
                  ✓ Confirm
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    const target =
                      details ?? previewLead ?? (grouped.NEW.find((l) => l.id === selectedId) as Lead | undefined);
                    if (target) sendFeedback(target, false);
                  }}
                >
                  ✕ Reject
                </Button>
              </>
            )}
            <div className="flex-1" />
            <Button onClick={() => setOpen(false)} className="btn">
              Close
            </Button>
            <Button disabled={saving || !form} onClick={saveEdits} className="btn btn-primary">
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------- Column --------------- */
function Column({
  id,
  title,
  count,
  items,
  onOpen,
  onFeedback,
}: {
  id: Lead["status"];
  title: string;
  count: number;
  items: Lead[];
  onOpen: (lead: Lead) => void;
  onFeedback: (lead: Lead, isLead: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { columnId: id } });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border bg-white p-3 transition-colors ${
        isOver ? "border-blue-400 bg-blue-50/40" : "border-[rgb(var(--border))]"
      } min-h-[180px]`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold tracking-wide text-slate-600">{title}</div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {count}
        </span>
      </div>

      <SortableContext items={items.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-xs text-slate-400">
              Drop leads here
            </div>
          )}
          {items.map((lead) => (
            <SortableCard key={lead.id} lead={lead} columnId={id} onOpen={onOpen} onFeedback={onFeedback} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

/* --------------- Cards --------------- */
function SortableCard({
  lead,
  columnId,
  onOpen,
  onFeedback,
}: {
  lead: Lead;
  columnId: Lead["status"];
  onOpen: (lead: Lead) => void;
  onFeedback: (lead: Lead, isLead: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: lead.id,
      data: { type: "card", columnId },
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    boxShadow: isDragging ? "0 10px 20px rgba(0,0,0,0.12)" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card lead={lead} onOpen={() => onOpen(lead)} dragListeners={listeners} onFeedback={onFeedback} />
    </div>
  );
}

function Card({
  lead,
  onOpen,
  dragListeners,
  onFeedback,
  isOverlay = false,
}: {
  lead: Lead;
  onOpen?: () => void;
  dragListeners?: any;
  onFeedback?: (lead: Lead, isLead: boolean) => void;
  isOverlay?: boolean;
}) {
  const subject = lead.custom?.subject as string | undefined;
  const summary = lead.custom?.summary as string | undefined;
  const aiFb = lead.custom?.aiFeedback as { isLead?: boolean; at?: string } | undefined;

  return (
    <div
      className={`card card-hover w-full px-3 py-2 ${isOverlay ? "ring-2 ring-blue-400" : ""}`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          type="button"
          aria-label="Drag"
          {...dragListeners}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-md border bg-white text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        >
          ⋮⋮
        </button>

        {/* Clickable area opens modal */}
        <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
              {avatarText(lead.contactName)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {lead.contactName || "Lead"}
              </div>
              {lead.email && (
                <div className="truncate text-xs text-slate-500 max-w-full">
                  {lead.email}
                </div>
              )}
            </div>
          </div>

          {(subject || summary) && (
            <div className="mt-1 space-y-1">
              {subject && <div className="text-xs font-medium line-clamp-1">{subject}</div>}
              {summary && <div className="text-[11px] text-slate-600 line-clamp-2">{summary}</div>}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={lead.status} />
            {lead.nextAction && (
              <span className="truncate rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                {lead.nextAction}
              </span>
            )}
            {aiFb && (
              <span
                className={`ml-1 rounded-full border px-1.5 py-0.5 text-[10px] ${
                  aiFb.isLead ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-rose-300 text-rose-700 bg-rose-50"
                }`}
              >
                {aiFb.isLead ? "✓ confirmed" : "✕ rejected"}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Confirm / Reject buttons inline */}
      {onFeedback && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="secondary"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onFeedback(lead, true);
            }}
          >
            ✓ Confirm
          </Button>
          <Button
            variant="destructive"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onFeedback(lead, false);
            }}
          >
            ✕ Reject
          </Button>
        </div>
      )}
    </div>
  );
}

/* --------------- Pretty bits --------------- */
function StatusBadge({ status }: { status: Lead["status"] }) {
  const map: Record<Lead["status"], string> = {
    NEW: "bg-blue-50 text-blue-700 border-blue-200",
    CONTACTED: "bg-amber-50 text-amber-700 border-amber-200",
    QUALIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    DISQUALIFIED: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${map[status]}`}
    >
      {labelFor(status)}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-600">
        {title}
      </div>
      {children}
    </div>
  );
}

function LabeledInput({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <input
        className="w-full max-w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <select
        className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
}: {
  def: FieldDef;
  value: any;
  onChange: (v: any) => void;
}) {
  const wrap = (node: React.ReactNode) => (
    <label className="space-y-1.5">
      <div className="text-xs text-slate-600">{def.label}</div>
      {node}
    </label>
  );

  switch (def.type) {
    case "number":
      return wrap(
        <input
          className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
    case "date":
      return wrap(
        <input
          className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return wrap(
        <select
          className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
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
        />
      );
  }
}

/* --------------- Helpers --------------- */
function labelFor(s: Lead["status"]) {
  switch (s) {
    case "NEW":
      return "New";
    case "CONTACTED":
      return "Contacted";
    case "QUALIFIED":
      return "Qualified";
    case "DISQUALIFIED":
      return "Disqualified";
  }
}

function avatarText(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}