"use client";

import React, { useEffect, useMemo, useState, Suspense, useRef } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
// Lazy-load LeadModal with SSR disabled and a robust fallback
type LeadModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadPreview: any;
  onUpdated?: () => void | Promise<void>;
  initialStage?: 'overview' | 'details' | 'questionnaire' | 'tasks' | 'follow-up';
  showFollowUp?: boolean;
};

const LeadModalLazy = dynamic<LeadModalProps>(
  () =>
    import("../leads/LeadModal")
      .then((m) => ({ default: m.default }))
      .catch((err) => {
        console.error("LeadModal (opportunities) dynamic import failed:", err);
        const Fallback: React.FC<LeadModalProps> = (props) => {
          if (!props.open) return null;
          return (
            <div
              className="fixed inset-0 z-[60] bg-black/20 backdrop-blur flex items-center justify-center p-6"
              role="dialog"
              aria-modal="true"
              onClick={() => props.onOpenChange(false)}
            >
              <div className="max-w-lg w-full rounded-xl bg-white shadow p-6 border border-slate-200" onClick={(e) => e.stopPropagation()}>
                <div className="text-sm font-semibold mb-2">Follow-up modal failed to load</div>
                <div className="text-sm text-slate-600 mb-4">Please retry or refresh the page.</div>
                <div className="flex justify-end">
                  <button className="rounded-md border px-3 py-2 text-sm" onClick={() => props.onOpenChange(false)} type="button">
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        };
        return { default: Fallback } as any;
      }),
  { ssr: false, loading: () => null }
);
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { DeskSurface } from "@/components/DeskSurface";
import { useTenantBrand } from "@/lib/use-tenant-brand";
import { Button } from "@/components/ui/button";
import { CustomizableGrid } from "@/components/CustomizableGrid";
import { ColumnConfigModal } from "@/components/ColumnConfigModal";
import DropdownOptionsEditor from "@/components/DropdownOptionsEditor";
import { Table, LayoutGrid } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type QuoteStatus = "READY_TO_QUOTE" | "ESTIMATE" | "QUOTE_SENT" | "LOST";
type Lead = {
  id: string;
  contactName: string;
  email?: string | null;
  status: QuoteStatus | string;
  nextAction?: string | null;
  nextActionAt?: string | null;
  custom?: Record<string, any>;
  opportunityId?: string | null;
};

type Grouped = Record<string, Lead[]>;

type Opp = {
  id: string;
  title: string;
  lead?: { contactName?: string; email?: string | null; custom?: any } | null;
};

const STATUS_LABELS: Record<QuoteStatus, string> = {
  READY_TO_QUOTE: "Ready to quote",
  ESTIMATE: "Estimate",
  QUOTE_SENT: "Quote sent",
  LOST: "Lost",
};

export default function OpportunitiesPage() {
  const [tab, setTab] = useState<QuoteStatus>("QUOTE_SENT");
  const [grouped, setGrouped] = useState<Grouped>({} as Grouped);
  const [rows, setRows] = useState<Lead[]>([]);
  const [repliedIds, setRepliedIds] = useState<Set<string>>(new Set());
  const { shortName } = useTenantBrand();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [oppRows, setOppRows] = useState<Opp[]>([]);
  const [workshopProcesses, setWorkshopProcesses] = useState<Array<{ code: string; name: string }>>([]);

  // view toggle state
  const [viewMode, setViewMode] = useState<'cards' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('opportunities-view-mode') as 'cards' | 'grid') || 'cards';
    }
    return 'cards';
  });

  // column configuration state
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [columnConfig, setColumnConfig] = useState<any[]>([]);

  // dropdown customization state
  const [customColors, setCustomColors] = useState<Record<string, { bg: string; text: string }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('opportunities-custom-colors');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });

  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('opportunities-dropdown-options');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });

  const [editingField, setEditingField] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const hasAutoOpened = useRef(false);

  // Dynamically build available fields including workshop processes
  const AVAILABLE_FIELDS = useMemo(() => {
    const baseFields = [
      { field: 'contactName', label: 'Contact Name', type: 'text' },
      { field: 'email', label: 'Email', type: 'email' },
      { field: 'status', label: 'Status', type: 'dropdown', dropdownOptions: ['READY_TO_QUOTE', 'ESTIMATE', 'QUOTE_SENT', 'LOST'] },
      { field: 'nextAction', label: 'Next Action', type: 'text' },
      { field: 'nextActionAt', label: 'Next Action Date', type: 'date' },
    ];

    // Add workshop process percentage fields dynamically
    const processFields = workshopProcesses.map(proc => ({
      field: proc.code,
      label: `${proc.name} %`,
      type: 'progress'
    }));

    return [...baseFields, ...processFields];
  }, [workshopProcesses]);

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

    // 4) Load workshop processes
    try {
      const processes = await apiFetch<Array<{ code: string; name: string }>>("/workshop-processes");
      setWorkshopProcesses(processes || []);
    } catch {
      setWorkshopProcesses([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (hasAutoOpened.current) return;

    const modal = searchParams?.get('modal');
    const opportunityId = searchParams?.get('opportunityId');
    const leadId = searchParams?.get('leadId');

    if (modal !== 'opportunity' || (!opportunityId && !leadId)) return;

    const allLeads: Lead[] = Object.values(grouped || {}).flat();
    const matched = allLeads.find((l) => {
      if (opportunityId && l.opportunityId === opportunityId) return true;
      if (leadId && l.id === leadId) return true;
      return false;
    });

    if (matched) {
      hasAutoOpened.current = true;
      if (matched.status) {
        setTab(String(matched.status).toUpperCase() as QuoteStatus);
      }
      openLead(matched);
    }
  }, [searchParams, grouped]);

  // Counts for all tabs
  const counts = useMemo(
    () => ({
      READY_TO_QUOTE: (grouped.READY_TO_QUOTE || []).length,
      ESTIMATE: (grouped.ESTIMATE || []).length,
      QUOTE_SENT: (grouped.QUOTE_SENT || []).length,
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

  // Load column config for current tab
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`opportunities-column-config-${tab}`);
      if (saved) {
        try {
          setColumnConfig(JSON.parse(saved));
        } catch {
          setColumnConfig([
            { field: 'contactName', label: 'Contact Name', visible: true, frozen: true, width: 200 },
            { field: 'email', label: 'Email', visible: true, frozen: false, width: 200 },
            { field: 'status', label: 'Status', visible: true, frozen: false, width: 150, type: 'dropdown', dropdownOptions: ['READY_TO_QUOTE', 'ESTIMATE', 'QUOTE_SENT', 'LOST'] },
            { field: 'nextAction', label: 'Next Action', visible: true, frozen: false, width: 200 },
          ]);
        }
      } else {
        setColumnConfig([
          { field: 'contactName', label: 'Contact Name', visible: true, frozen: true, width: 200 },
          { field: 'email', label: 'Email', visible: true, frozen: false, width: 200 },
          { field: 'status', label: 'Status', visible: true, frozen: false, width: 150, type: 'dropdown', dropdownOptions: ['READY_TO_QUOTE', 'ESTIMATE', 'QUOTE_SENT', 'LOST'] },
          { field: 'nextAction', label: 'Next Action', visible: true, frozen: false, width: 200 },
        ]);
      }
    }
  }, [tab]);

  // Handle view mode toggle
  function handleViewModeToggle(newMode: 'cards' | 'grid') {
    setViewMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('opportunities-view-mode', newMode);
    }
  }

  // Handle column config save
  function handleSaveColumnConfig(newConfig: any[]) {
    setColumnConfig(newConfig);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`opportunities-column-config-${tab}`, JSON.stringify(newConfig));
    }
  }

  // Handle cell change in grid
  async function handleCellChange(leadId: string, field: string, value: any) {
    try {
      await apiFetch(`/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      // Refresh data
      await load();
      toast({
        title: "Opportunity updated",
        description: "Changes saved successfully",
      });
    } catch (e: any) {
      toast({
        title: "Update failed",
        description: e?.message || "Failed to update opportunity",
        variant: "destructive",
      });
    }
  }

  // Handle saving custom colors and dropdown options
  function handleSaveDropdownOptions(field: string, options: string[], colors: Record<string, { bg: string; text: string }>) {
    // Save dropdown options
    const newOptions = { ...dropdownOptions, [field]: options };
    setDropdownOptions(newOptions);
    localStorage.setItem('opportunities-dropdown-options', JSON.stringify(newOptions));

    // Save custom colors
    setCustomColors(colors);
    localStorage.setItem('opportunities-custom-colors', JSON.stringify(colors));

    toast({
      title: "Options updated",
      description: `Dropdown options and colors saved for ${field}`,
    });
  }

  function openLead(lead: Lead) {
    setSelected(lead);
    setOpen(true);
  }

  // Available fields for column configuration
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
            title="Estimates and quotes in progress"
          >
            <span aria-hidden="true">📝</span>
            Quote desk
            {shortName && <span className="hidden sm:inline text-slate-400">· {shortName}</span>}
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => handleViewModeToggle('cards')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  viewMode === 'cards'
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleViewModeToggle('grid')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  viewMode === 'grid'
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Grid view"
              >
                <Table className="w-4 h-4" />
              </button>
            </div>
            {viewMode === 'grid' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColumnConfig(true)}
              >
                Configure Columns
              </Button>
            )}
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          <TabButton s="READY_TO_QUOTE" />
          <TabButton s="ESTIMATE" />
          <TabButton s="QUOTE_SENT" />
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
              No quotes in "{STATUS_LABELS[tab]}".
            </div>
          ) : viewMode === 'grid' ? (
            <CustomizableGrid
              data={tab === "QUOTE_SENT" ? notReplied : rows}
              columns={columnConfig}
              onRowClick={openLead}
              onCellChange={handleCellChange}
              customColors={customColors}
              customDropdownOptions={dropdownOptions}
              onEditColumnOptions={(field) => setEditingField(field)}
            />
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
                id: selected.opportunityId || selected.id, // Use opportunity ID if available, fallback to lead ID
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

      <ColumnConfigModal
        open={showColumnConfig}
        onClose={() => setShowColumnConfig(false)}
        availableFields={AVAILABLE_FIELDS}
        currentConfig={columnConfig}
        onSave={handleSaveColumnConfig}
      />

      {editingField && (
        <DropdownOptionsEditor
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          fieldName={editingField}
          fieldLabel={columnConfig.find(c => c.field === editingField)?.label || editingField}
          currentOptions={dropdownOptions[editingField] || columnConfig.find(c => c.field === editingField)?.dropdownOptions || []}
          currentColors={customColors}
          onSave={(options, colors) => handleSaveDropdownOptions(editingField, options, colors)}
        />
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