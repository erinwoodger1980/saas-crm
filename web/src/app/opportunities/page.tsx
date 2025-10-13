// web/src/app/opportunities/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import OpportunityModal from "./OpportunityModal";
import { apiFetch, ensureDemoAuth } from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

type LeadStatus = "QUOTE_SENT" | "WON" | "LOST";
type Lead = {
  id: string;
  contactName: string;
  email?: string | null;
  status: LeadStatus | string;
  nextAction?: string | null;
  nextActionAt?: string | null;
  custom?: Record<string, any>;
};

type Grouped = Record<string, Lead[]>;

type Opp = {
  id: string;
  title: string;
  lead?: { contactName?: string; email?: string | null; custom?: any } | null;
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  QUOTE_SENT: "Quote sent",
  WON: "Won",
  LOST: "Lost",
};

export default function OpportunitiesPage() {
  const [tab, setTab] = useState<LeadStatus>("QUOTE_SENT");
  const [grouped, setGrouped] = useState<Grouped>({} as Grouped);
  const [rows, setRows] = useState<Lead[]>([]);
  const [repliedIds, setRepliedIds] = useState<Set<string>>(new Set());

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [oppRows, setOppRows] = useState<Opp[]>([]);

  async function load() {
    setError(null);
    const ok = await ensureDemoAuth();
    if (!ok) return setError("Not authenticated");

    // 1) Grouped leads
    const g = await apiFetch<Grouped>("/leads/grouped");
    const normalized: Grouped = {};
    Object.keys(g || {}).forEach((k) => {
      normalized[k] = (g[k] || []).map((l) => ({ ...l, status: String(l.status).toUpperCase() }));
    });
    setGrouped(normalized);
    setRows(normalized[tab] || []);

    // 2) Replied-since
    try {
      const r = await apiFetch<{ replied: { leadId: string; at: string }[] }>(
        "/opportunities/replied-since?days=30"
      );
      setRepliedIds(new Set((r.replied || []).map((x) => x.leadId)));
    } catch {
      setRepliedIds(new Set());
    }

    // 3) Optional extra opp cards
    try {
      const res = await fetch(`${API_BASE}/reports/opportunities`, { credentials: "include" });
      const d = await res.json();
      setOppRows(d.opportunities || []);
    } catch {
      setOppRows([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Counts for all tabs
  const counts = useMemo(
    () => ({
      QUOTE_SENT: (grouped.QUOTE_SENT || []).length,
      WON: (grouped.WON || []).length,
      LOST: (grouped.LOST || []).length,
    }),
    [grouped]
  );

  // Split attention for QUOTE_SENT
  const repliedNow = useMemo(
    () => (tab === "QUOTE_SENT" ? rows.filter((l) => repliedIds.has(l.id)) : []),
    [rows, tab, repliedIds]
  );
  const notReplied = useMemo(
    () => (tab === "QUOTE_SENT" ? rows.filter((l) => !repliedIds.has(l.id)) : rows),
    [rows, tab, repliedIds]
  );

  async function planFollowUp(id: string) {
    setLoadingPlan(true);
    try {
      await fetch(`${API_BASE}/opportunities/${id}/next-followup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } finally {
      setLoadingPlan(false);
    }
  }

  const TabButton = ({ s }: { s: LeadStatus }) => {
    const active = tab === s;
    return (
      <button
        onClick={() => setTab(s)}
        className={`rounded-full px-3 py-1 text-sm border transition ${
          active
            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
            : "bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {STATUS_LABELS[s]}
        <span
          className={`ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          {counts[s]}
        </span>
      </button>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Opportunities</h1>
          <p className="text-sm text-slate-500">Follow up, replies, and A/B testing.</p>
        </div>
        <div className="text-[11px] text-slate-400">v0.1</div>
      </header>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton s="QUOTE_SENT" />
        <TabButton s="WON" />
        <TabButton s="LOST" />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* QUOTE_SENT: Attention section */}
      {tab === "QUOTE_SENT" && repliedNow.length > 0 && (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-[0_10px_30px_-20px_rgba(217,119,6,0.35)]">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Needs attention (replied)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {repliedNow.map((l) => (
              <CardRow
                key={l.id}
                lead={l}
                accent="amber"
                statusLabel="Replied · Quote sent"
                onOpen={() => {
                  setSelected(l);
                  setOpen(true);
                }}
                actionArea={
                  <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 text-[11px]">
                    {STATUS_LABELS.QUOTE_SENT}
                  </span>
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Main list */}
      <section className="space-y-2">
        {(tab === "QUOTE_SENT" ? notReplied : rows).length === 0 ? (
          <div className="rounded-xl border border-dashed bg-slate-50 py-10 text-center text-sm text-slate-500">
            No opportunities in “{STATUS_LABELS[tab]}”.
          </div>
        ) : (
          (tab === "QUOTE_SENT" ? notReplied : rows).map((l) => (
            <CardRow
              key={l.id}
              lead={l}
              statusLabel={STATUS_LABELS[tab]}
              onOpen={() => {
                setSelected(l);
                setOpen(true);
              }}
              actionArea={
                <span className="rounded-full bg-slate-100 text-slate-700 border px-2 py-0.5 text-[11px]">
                  {STATUS_LABELS[tab]}
                </span>
              }
            />
          ))
        )}
      </section>

      {/* Optional additional opps */}
      {oppRows.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Opportunities (report)
          </div>
          <div className="grid grid-cols-1 gap-3">
            {oppRows.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl border bg-white/90 p-4 shadow-[0_12px_30px_-18px_rgba(2,6,23,0.35)] flex items-start justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium">{o.title}</div>
                  <div className="text-xs text-slate-500">
                    {o.lead?.contactName} {o.lead?.email ? `· ${o.lead.email}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => planFollowUp(o.id)}
                  className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
                  disabled={loadingPlan}
                >
                  {loadingPlan ? "Planning…" : "Plan follow-up"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal */}
      {selected && (
        <OpportunityModal
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setSelected(null);
          }}
          leadId={selected.id}
          leadName={selected.contactName}
          leadEmail={(selected.email ?? "") as string}
          onAfterSend={load}
        />
      )}
    </div>
  );
}

/* ---------- Presentational row card ---------- */
function CardRow({
  lead,
  statusLabel,
  onOpen,
  actionArea,
  accent,
}: {
  lead: Lead;
  statusLabel: string;
  onOpen: () => void;
  actionArea?: React.ReactNode;
  accent?: "amber";
}) {
  const badge =
    accent === "amber"
      ? "bg-amber-100 text-amber-900"
      : "bg-slate-100 text-slate-700";

  return (
    <div
      className="cursor-pointer rounded-2xl border bg-white/90 p-3 hover:shadow-[0_12px_30px_-18px_rgba(2,6,23,0.45)] transition"
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <span className={`inline-flex size-8 items-center justify-center rounded-full ${badge} text-[11px] font-semibold`}>
          {avatarText(lead.contactName)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium">{lead.contactName || "Lead"}</div>
          <div className="text-[11px] text-slate-500">
            {lead.custom?.source ? `Source: ${lead.custom.source}` : "Source: —"}
            {lead.nextAction ? ` · Next: ${lead.nextAction}` : ""}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {actionArea}
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