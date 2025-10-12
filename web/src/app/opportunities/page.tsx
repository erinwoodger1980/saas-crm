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
  const [rows, setRows] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string; whenISO: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [oppRows, setOppRows] = useState<Opp[]>([]);

  async function load() {
    setError(null);
    const ok = await ensureDemoAuth();
    if (!ok) return setError("Not authenticated");

    const g = await apiFetch<Grouped>("/leads/grouped");
    const leads = (g?.[tab] as Lead[]) || [];

    setRows(
      leads.map((l) => ({
        ...l,
        status: (l.status as string).toUpperCase(),
      }))
    );

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
  }, [tab]);

  const counts = useMemo(() => {
    return {
      QUOTE_SENT: tab === "QUOTE_SENT" ? rows.length : undefined,
      WON: tab === "WON" ? rows.length : undefined,
      LOST: tab === "LOST" ? rows.length : undefined,
    };
  }, [rows, tab]);

  async function planFollowUp(id: string) {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/opportunities/${id}/next-followup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      setDraft({ subject: j.subject, body: j.body, whenISO: j.whenISO });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Opportunities</h1>
          <p className="text-sm text-slate-500">
            Follow up, email thread, and auto A/B testing.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["QUOTE_SENT", "WON", "LOST"] as LeadStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full border px-3 py-1 text-sm ${
              tab === s
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-700"
            }`}
          >
            {STATUS_LABELS[s]}
            {counts[s] !== undefined ? (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1 text-xs text-slate-600">
                {counts[s]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Leads Rows */}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-slate-50 py-10 text-center text-sm text-slate-500">
            No opportunities in “{STATUS_LABELS[tab]}”.
          </div>
        ) : (
          rows.map((l) => (
            <div
              key={l.id}
              className="rounded-xl border bg-white p-3 hover:shadow-sm transition cursor-pointer"
              onClick={() => {
                setSelected(l);
                setOpen(true);
              }}
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                  {avatarText(l.contactName)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">
                    {l.contactName || "Lead"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {l.custom?.source ? `Source: ${l.custom.source}` : "Source: —"}
                    {l.nextAction ? ` · Next: ${l.nextAction}` : ""}
                  </div>
                </div>
                <div className="text-xs text-slate-500">{STATUS_LABELS[tab]}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Opportunities Follow-up Cards */}
      <div className="mt-8 space-y-3">
        {oppRows.map((o) => (
          <div key={o.id} className="rounded-xl border bg-white p-4 flex items-start justify-between">
            <div className="min-w-0">
              <div className="font-medium">{o.title}</div>
              <div className="text-xs text-slate-500">
                {o.lead?.contactName} {o.lead?.email ? `· ${o.lead.email}` : ""}
              </div>
            </div>
            <button
              onClick={() => planFollowUp(o.id)}
              className="rounded-md border px-3 py-2 text-sm"
              disabled={loading}
            >
              {loading ? "Planning…" : "Plan follow-up"}
            </button>
          </div>
        ))}
      </div>

      {draft && (
        <div className="mt-6 rounded-xl border bg-white p-4 space-y-2">
          <div className="text-sm text-slate-600">Suggested next follow-up (scheduled): {new Date(draft.whenISO).toLocaleString()}</div>
          <div className="text-sm font-medium">Subject</div>
          <div className="text-sm rounded-md border p-2 bg-slate-50">{draft.subject}</div>
          <div className="text-sm font-medium">Body</div>
          <pre className="text-sm rounded-md border p-3 bg-slate-50 whitespace-pre-wrap">{draft.body}</pre>
          <div className="text-xs text-slate-500">
            Tip: we’ll A/B test variants and learn optimal cadence automatically based on replies and wins.
          </div>
        </div>
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

function avatarText(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
