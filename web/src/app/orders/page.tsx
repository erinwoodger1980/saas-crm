"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import dynamic from "next/dynamic";
// Lazy-load LeadModal with SSR disabled and a robust fallback
type LeadModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadPreview: any;
  onUpdated?: () => void | Promise<void>;
  initialStage?: 'client' | 'quote' | 'dates' | 'finance' | 'tasks' | 'order';
  showFollowUp?: boolean;
};

const LeadModalLazy = dynamic<LeadModalProps>(
  () =>
    import("../leads/LeadModal")
      .then((m) => ({ default: m.default }))
      .catch((err) => {
        console.error("LeadModal (orders) dynamic import failed:", err);
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
                <div className="text-sm font-semibold mb-2">Order modal failed to load</div>
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
import { CreateProjectModal } from "../opportunities/CreateProjectModal";
import { buildLeadDisplayName } from "@/lib/leadDisplayName";

type OrderStatus = "WON" | "COMPLETED";
type Order = {
  id: string;
  contactName: string;
  number?: string | null;
  description?: string | null;
  displayName?: string;
  email?: string | null;
  status: OrderStatus | string;
  nextAction?: string | null;
  nextActionAt?: string | null;
  custom?: Record<string, any>;
  opportunityId?: string | null;
  opportunityGroupId?: string | null;
  opportunityGroupName?: string | null;
  parentOpportunityId?: string | null;
  processPercentages?: Record<string, number>;
  manufacturingCompletionDate?: string | null;
  orderValueGBP?: number | string | null;
  assignedUserId?: string | null;
  assignedUser?: { id: string; name?: string | null; email?: string | null } | null;
  assignedUserName?: string | null;
};

type Grouped = Record<string, Order[]>;

const STATUS_LABELS: Record<OrderStatus, string> = {
  WON: "Won",
  COMPLETED: "Completed",
};

function formatCurrencyGBP(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function monthLabelFromIso(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown month";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function compareIsoDateAsc(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (Number.isNaN(a) && Number.isNaN(b)) return 0;
  if (Number.isNaN(a)) return 1;
  if (Number.isNaN(b)) return -1;
  return a - b;
}

export default function OrdersPage() {
  const [tab, setTab] = useState<OrderStatus>("WON");
  const [grouped, setGrouped] = useState<Grouped>({} as Grouped);
  const [rows, setRows] = useState<Order[]>([]);
  const { shortName } = useTenantBrand();
  const { toast } = useToast();
  const [tenantUsers, setTenantUsers] = useState<Array<{ id: string; name?: string | null; email?: string | null }>>([]);
  const [assignedUserFilter, setAssignedUserFilter] = useState<string>("all");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; name: string; email?: string | null }>>([]);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [workshopProcesses, setWorkshopProcesses] = useState<Array<{ code: string; name: string }>>([]);

  // view toggle state
  const [viewMode, setViewMode] = useState<'cards' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('orders-view-mode') as 'cards' | 'grid') || 'cards';
    }
    return 'cards';
  });

  // column configuration state
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [columnConfig, setColumnConfig] = useState<any[]>([]);

  // dropdown customization state
  const [customColors, setCustomColors] = useState<Record<string, { bg: string; text: string }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('orders-custom-colors');
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
      const saved = localStorage.getItem('orders-dropdown-options');
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

  // Dynamically build available fields including workshop processes
  const AVAILABLE_FIELDS = useMemo(() => {
    const baseFields = [
      { field: 'displayName', label: 'Name', type: 'text' },
      { field: 'contactName', label: 'Contact Name', type: 'text' },
      { field: 'email', label: 'Email', type: 'email' },
      { field: 'assignedUserName', label: 'Assigned User', type: 'text' },
      { field: 'status', label: 'Status', type: 'dropdown', dropdownOptions: ['WON', 'COMPLETED'] },
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
      normalized[k] = (g[k] || []).map((l) => ({
        ...l,
        status: String(l.status).toUpperCase(),
        displayName: buildLeadDisplayName({
          contactName: l.contactName,
          number: l.number,
          description: l.description,
          custom: l.custom,
          fallbackLabel: "Order",
        }),
        manufacturingCompletionDate: (l as any).manufacturingCompletionDate ?? null,
        orderValueGBP: (l as any).orderValueGBP ?? null,
      }));
    });
    setGrouped(normalized);
    setRows(normalized[tab] || []);

    // 2) Load workshop processes
    try {
      const processes = await apiFetch<Array<{ code: string; name: string }>>("/workshop-processes");
      setWorkshopProcesses(processes || []);
    } catch {
      setWorkshopProcesses([]);
    }

    // 3) Load clients for Create Project modal
    try {
      const clientsList = await apiFetch<Array<{ id: string; name: string; email?: string | null }>>("/clients");
      setClients(clientsList || []);
    } catch {
      setClients([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<any[]>("/tenant/users");
        if (cancelled) return;
        if (Array.isArray(data)) {
          setTenantUsers(
            data.map((u: any) => ({
              id: u.id,
              name: u.name || u.firstName || null,
              email: u.email || null,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load tenant users:", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Counts for all tabs
  const counts = useMemo(
    () => ({
      WON: (grouped.WON || []).length,
      COMPLETED: (grouped.COMPLETED || []).length,
    }),
    [grouped]
  );

  const filteredRows = useMemo(() => {
    if (assignedUserFilter === "all") return rows;
    return rows.filter((o: any) => {
      const assignedId = o?.assignedUserId || o?.assignedUser?.id || o?.client?.userId || o?.client?.user?.id || null;
      return assignedId === assignedUserFilter;
    });
  }, [assignedUserFilter, rows]);

  const sortedRows = useMemo(() => {
    const list = [...(filteredRows || [])];
    // Blank manufacturing completion dates first, then ascending by date.
    list.sort((a, b) => {
      const ad = a.manufacturingCompletionDate;
      const bd = b.manufacturingCompletionDate;
      const aBlank = !ad;
      const bBlank = !bd;
      if (aBlank && bBlank) return 0;
      if (aBlank) return -1;
      if (bBlank) return 1;
      return compareIsoDateAsc(ad!, bd!);
    });
    return list;
  }, [filteredRows]);

  const groupedForCards = useMemo(() => {
    const noDate: Order[] = [];
    const byMonth = new Map<string, Order[]>();
    for (const o of sortedRows) {
      if (!o.manufacturingCompletionDate) {
        noDate.push(o);
        continue;
      }
      const label = monthLabelFromIso(o.manufacturingCompletionDate);
      const bucket = byMonth.get(label) || [];
      bucket.push(o);
      byMonth.set(label, bucket);
    }

    const groupKey = (o: Order) => (o.opportunityGroupName || o.opportunityGroupId || "").toLowerCase();
    const nameKey = (o: Order) => (o.displayName || o.contactName || "").toLowerCase();

    noDate.sort((a, b) => {
      const ga = groupKey(a);
      const gb = groupKey(b);
      if (ga !== gb) return ga.localeCompare(gb);
      return nameKey(a).localeCompare(nameKey(b));
    });

    for (const [k, bucket] of byMonth.entries()) {
      bucket.sort((a, b) => {
        const ga = groupKey(a);
        const gb = groupKey(b);
        if (ga !== gb) return ga.localeCompare(gb);
        return nameKey(a).localeCompare(nameKey(b));
      });
      byMonth.set(k, bucket);
    }

    return { noDate, byMonth };
  }, [sortedRows]);

  // Load column config for current tab
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`orders-column-config-${tab}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const migrated = Array.isArray(parsed)
            ? parsed.map((col: any) => {
                if (col?.field === 'contactName' && col?.label === 'Name') {
                  return { ...col, field: 'displayName', type: 'text', render: undefined };
                }
                return col;
              })
            : parsed;
          const ensureAssignedUser = (cols: any[]) => {
            if (cols.some((c) => c?.field === 'assignedUserName')) return cols;
            const insertAfter = cols.findIndex((c) => c?.field === 'email');
            const next = [...cols];
            next.splice(Math.max(0, insertAfter + 1), 0, {
              field: 'assignedUserName',
              label: 'Assigned User',
              visible: true,
              frozen: false,
              width: 160,
            });
            return next;
          };
          setColumnConfig(Array.isArray(migrated) ? ensureAssignedUser(migrated) : migrated);
        } catch {
          setColumnConfig([
            { 
              field: 'displayName', 
              label: 'Name', 
              visible: true, 
              frozen: true, 
              width: 250, 
              type: 'text'
            },
            { field: 'email', label: 'Email', visible: true, frozen: false, width: 200 },
            { field: 'assignedUserName', label: 'Assigned User', visible: true, frozen: false, width: 160 },
            { field: 'status', label: 'Status', visible: true, frozen: false, width: 150, type: 'dropdown', dropdownOptions: ['WON', 'COMPLETED'] },
            { field: 'nextAction', label: 'Next Action', visible: true, frozen: false, width: 200 },
          ]);
        }
      } else {
        setColumnConfig([
          { 
            field: 'displayName', 
            label: 'Name', 
            visible: true, 
            frozen: true, 
            width: 250, 
            type: 'text'
          },
          { field: 'email', label: 'Email', visible: true, frozen: false, width: 200 },
          { field: 'assignedUserName', label: 'Assigned User', visible: true, frozen: false, width: 160 },
          { field: 'status', label: 'Status', visible: true, frozen: false, width: 150, type: 'dropdown', dropdownOptions: ['WON', 'COMPLETED'] },
          { field: 'nextAction', label: 'Next Action', visible: true, frozen: false, width: 200 },
        ]);
      }
    }
  }, [tab]);

  // Handle view mode toggle
  function handleViewModeToggle(newMode: 'cards' | 'grid') {
    setViewMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('orders-view-mode', newMode);
    }
  }

  // Handle column config save
  function handleSaveColumnConfig(newConfig: any[]) {
    setColumnConfig(newConfig);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`orders-column-config-${tab}`, JSON.stringify(newConfig));
    }
  }

  // Handle cell change in grid
  async function handleCellChange(orderId: string, field: string, value: any) {
    try {
      await apiFetch(`/leads/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      // Refresh data
      await load();
      toast({
        title: "Order updated",
        description: "Changes saved successfully",
      });
    } catch (e: any) {
      toast({
        title: "Update failed",
        description: e?.message || "Failed to update order",
        variant: "destructive",
      });
    }
  }

  // Handle saving custom colors and dropdown options
  function handleSaveDropdownOptions(field: string, options: string[], colors: Record<string, { bg: string; text: string }>) {
    // Save dropdown options
    const newOptions = { ...dropdownOptions, [field]: options };
    setDropdownOptions(newOptions);
    localStorage.setItem('orders-dropdown-options', JSON.stringify(newOptions));

    // Save custom colors
    setCustomColors(colors);
    localStorage.setItem('orders-custom-colors', JSON.stringify(colors));

    toast({
      title: "Options updated",
      description: `Dropdown options and colors saved for ${field}`,
    });
  }

  function openOrder(order: Order) {
    setSelected(order);
    setOpen(true);
  }

  // Tab button component
  const TabButton = ({ s }: { s: OrderStatus }) => {
    const active = tab === s;
    return (
      <button
        onClick={() => setTab(s)}
        className={`group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
          active
            ? "border-transparent bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-white shadow-[0_12px_28px_-14px_rgba(20,184,166,0.55)]"
            : "border-emerald-100/70 bg-white/70 text-slate-700 hover:border-emerald-200 hover:bg-white"
        }`}
      >
        {STATUS_LABELS[s]}
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold ${
            active
              ? "bg-white/30 text-white"
              : "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100"
          }`}
        >
          {counts[s]}
        </span>
      </button>
    );
  };

  return (
    <>
      <DeskSurface variant="indigo" innerClassName="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-500 shadow-sm"
            title="Won and completed orders"
          >
            <span aria-hidden="true">✅</span>
            Order desk
            {shortName && <span className="hidden sm:inline text-slate-400">· {shortName}</span>}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setCreateProjectOpen(true)}
              className="bg-gradient-to-r from-amber-400 via-rose-400 to-pink-400 text-white"
            >
              + Create Project
            </Button>
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => handleViewModeToggle('cards')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  viewMode === 'cards'
                    ? 'bg-emerald-100 text-emerald-900'
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
                    ? 'bg-emerald-100 text-emerald-900'
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <TabButton s="WON" />
            <TabButton s="COMPLETED" />
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
            <span className="text-[10px] uppercase tracking-wide text-emerald-400">Assignee</span>
            <select
              className="bg-transparent text-xs font-semibold text-emerald-900 outline-none"
              value={assignedUserFilter}
              onChange={(e) => setAssignedUserFilter(e.target.value)}
            >
              <option value="all">All</option>
              {tenantUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email || "User"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="space-y-2">
          {sortedRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-emerald-200 bg-white/70 py-10 text-center text-sm text-slate-500">
              No orders in "{STATUS_LABELS[tab]}".
            </div>
          ) : viewMode === 'grid' ? (
            <CustomizableGrid
              data={sortedRows}
              columns={columnConfig}
              onRowClick={openOrder}
              onCellChange={handleCellChange}
              customColors={customColors}
              customDropdownOptions={dropdownOptions}
              onEditColumnOptions={(field) => setEditingField(field)}
            />
          ) : (
            <div className="space-y-6">
              {groupedForCards.noDate.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">No manufacturing completion date</div>
                    <div className="text-xs text-slate-500">{groupedForCards.noDate.length} orders</div>
                  </div>
                  <div className="space-y-2">
                    {groupedForCards.noDate.map((order) => (
                      <CardRow
                        key={order.id}
                        order={order}
                        _statusLabel={STATUS_LABELS[tab]}
                        onOpen={() => {
                          setSelected(order);
                          setOpen(true);
                        }}
                        actionArea={
                          <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700">
                            {STATUS_LABELS[tab]}
                          </span>
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {Array.from(groupedForCards.byMonth.entries()).map(([monthLabel, orders]) => {
                const total = orders.reduce((sum, o) => {
                  const raw = o.orderValueGBP;
                  const num = typeof raw === "number" ? raw : raw == null ? 0 : Number(raw);
                  return sum + (Number.isFinite(num) ? num : 0);
                }, 0);

                return (
                  <div key={monthLabel} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-800">{monthLabel}</div>
                      <div className="text-xs text-slate-500">Total: {formatCurrencyGBP(total)}</div>
                    </div>
                    <div className="space-y-2">
                      {orders.map((order) => (
                        <CardRow
                          key={order.id}
                          order={order}
                          _statusLabel={STATUS_LABELS[tab]}
                          onOpen={() => {
                            setSelected(order);
                            setOpen(true);
                          }}
                          actionArea={
                            <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-700">
                              {STATUS_LABELS[tab]}
                            </span>
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </DeskSurface>
      <CreateProjectModal
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        clients={clients}
        onCreated={() => {
          setCreateProjectOpen(false);
          load();
        }}
      />

      {selected && (
        <ErrorBoundary fallback={<div className="p-6 text-sm text-red-600">Order modal failed to load.</div>}>
          <Suspense fallback={<div className="p-6 text-sm">Loading order...</div>}>
            <LeadModalLazy
              open={open}
              onOpenChange={(v: boolean) => {
                setOpen(v);
                if (!v) setSelected(null);
              }}
              leadPreview={{
                id: selected.id,
                opportunityId: selected.opportunityId || null,
                contactName: selected.contactName,
                email: selected.email,
                status: (selected.status as any) || "WON",
                custom: selected.custom
              }}
              onUpdated={load}
              initialStage="order"
              showFollowUp={false}
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
  order,
  _statusLabel,
  onOpen,
  actionArea,
}: {
  order: Order;
  _statusLabel: string;
  onOpen: () => void;
  actionArea?: React.ReactNode;
}) {
  const badge = "bg-emerald-100 text-emerald-900";
  const assignedUserLabel =
    order.assignedUserName || order.assignedUser?.name || order.assignedUser?.email || null;

  return (
    <div
      className="cursor-pointer rounded-2xl border bg-white/90 p-3 hover:shadow-[0_12px_30px_-18px_rgba(2,6,23,0.45)] transition"
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <span className={`inline-flex size-8 items-center justify-center rounded-full ${badge} text-[11px] font-semibold`}>
          {avatarText(order.contactName)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium">
            {buildLeadDisplayName({
              contactName: order.contactName,
              number: order.number,
              description: order.description,
              custom: order.custom,
              fallbackLabel: "Order",
            })}
          </div>
          <div className="text-[11px] text-slate-500">
            {order.custom?.source ? `Source: ${order.custom.source}` : "Source: —"}
            {order.nextAction ? ` · Next: ${order.nextAction}` : ""}
          </div>
          {assignedUserLabel && (
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                {assignedUserLabel}
              </span>
            </div>
          )}
          {(order.opportunityGroupName || order.opportunityGroupId) && (
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                Group: {order.opportunityGroupName || order.opportunityGroupId}
              </span>
            </div>
          )}
          {order.processPercentages && Object.keys(order.processPercentages).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(order.processPercentages).map(([code, percent]) => (
                <span key={code} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                  {code}: {percent}%
                </span>
              ))}
            </div>
          )}
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
  componentDidCatch(err: any, info: any) { console.error('Order modal error boundary caught:', err, info); }
  render() { if (this.state.hasError) return this.props.fallback; return this.props.children; }
}
