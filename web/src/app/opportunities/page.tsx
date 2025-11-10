"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import dynamic from "next/dynamic";
// Lazy-load LeadModal with SSR disabled to prevent hydration/TDZ issues
const LeadModalLazy = dynamic(() => import("../leads/LeadModal"), { ssr: false });
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { DeskSurface } from "@/components/DeskSurface";
import { useTenantBrand } from "@/lib/use-tenant-brand";

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
  const { shortName } = useTenantBrand();

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
      const res = await apiFetch<{ opportunities?: Opp[] }>("/reports/opportunities");
      setOppRows(res.opportunities || []);
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
      await apiFetch(`/opportunities/${id}/next-followup`, {
        method: "POST",
        json: {}, // keep body explicit
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
        className={`group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
          active
            ? "border-transparent bg-gradient-to-r from-amber-400 via-rose-400 to-pink-400 text-white shadow-[0_12px_28px_-14px_rgba(244,114,182,0.55)]"
            : "border-amber-100/70 bg-white/70 text-slate-700 hover:border-amber-200 hover:bg-white"
        }`}
      >
        {STATUS_LABELS[s]}
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold ${
            active
              ? "bg-white/30 text-white"
              : "bg-amber-50 text-amber-700 group-hover:bg-amber-100"
          }`}
        >
          {counts[s]}
        </span>
      </button>
    );
  };

  return (
    <>
      <DeskSurface variant="amber" innerClassName="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-500 shadow-sm"
            title="Follow up, replies, and A/B testing."
          >
            <span aria-hidden="true">🎯</span>
            Opportunity desk
            {shortName && <span className="hidden sm:inline text-slate-400">· {shortName}</span>}
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          <TabButton s="QUOTE_SENT" />
          <TabButton s="WON" />
          <TabButton s="LOST" />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {tab === "QUOTE_SENT" && repliedNow.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-[0_10px_30px_-20px_rgba(217,119,6,0.35)]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              Needs attention (replied)
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {repliedNow.map((l) => (
                  <CardRow
                  key={l.id}
                  lead={l}
                    accent="amber"
                    _statusLabel="Replied · Quote sent"
                  onOpen={() => {
                    setSelected(l);
                    setOpen(true);
                  }}
                  actionArea={
                    <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900">
                      {STATUS_LABELS.QUOTE_SENT}
                    </span>
                  }
                />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          {(tab === "QUOTE_SENT" ? notReplied : rows).length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-200 bg-white/70 py-10 text-center text-sm text-slate-500">
              No opportunities in “{STATUS_LABELS[tab]}”.
            </div>
          ) : (
            (tab === "QUOTE_SENT" ? notReplied : rows).map((l) => (
              <CardRow
                key={l.id}
                lead={l}
                _statusLabel={STATUS_LABELS[tab]}
                onOpen={() => {
                  setSelected(l);
                  setOpen(true);
                }}
                actionArea={
                  <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700">
                    {STATUS_LABELS[tab]}
                  </span>
                }
              />
            ))
          )}
        </section>

        {oppRows.length > 0 && (
          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Opportunities (report)
            </div>
            <div className="grid grid-cols-1 gap-3">
              {oppRows.map((o) => (
                <div
                  key={o.id}
                  className="flex items-start justify-between rounded-2xl border border-amber-100/70 bg-white/90 p-4 shadow-[0_12px_30px_-18px_rgba(2,6,23,0.35)]"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{o.title}</div>
                    <div className="text-xs text-slate-500">
                      {o.lead?.contactName} {o.lead?.email ? `· ${o.lead.email}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => planFollowUp(o.id)}
                    className="rounded-full border border-amber-200/70 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-50"
                    disabled={loadingPlan}
                  >
                    {loadingPlan ? "Planning…" : "Plan follow-up"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </DeskSurface>

      {selected && (
        <ErrorBoundary fallback={<div className="p-6 text-sm text-red-600">Follow-up modal failed to load.</div>}>
          <Suspense fallback={<div className="p-6 text-sm">Loading follow-up...</div>}>
            <LeadModalLazy
              open={open}
              onOpenChange={(v: boolean) => {
                setOpen(v);
                if (!v) setSelected(null);
              }}
              leadPreview={{
                id: selected.id,
                contactName: selected.contactName,
                email: selected.email,
                status: (selected.status as any) || "QUOTE_SENT",
                custom: selected.custom
              }}
              onUpdated={load}
              initialStage="follow-up"
              showFollowUp={true}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}

/* ---------- Presentational row card ---------- */
function CardRow({
  lead,
  _statusLabel,
  onOpen,
  actionArea,
  accent,
}: {
  lead: Lead;
  _statusLabel: string;
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

// Simple client-side error boundary for the modal
class ErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: any, info: any) { console.error('Opportunity modal error boundary caught:', err, info); }
  render() { if (this.state.hasError) return this.props.fallback; return this.props.children; }
}