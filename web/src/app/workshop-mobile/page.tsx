"use client";

import { useEffect, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import WorkshopTimer from "@/components/workshop/WorkshopTimer";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Project = {
  id: string;
  title: string;
  startDate?: string | null;
  deliveryDate?: string | null;
  installationStartDate?: string | null;
  installationEndDate?: string | null;
  totalProjectHours?: number;
};

type ProcessDef = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isGeneric?: boolean;
};

type UserLite = {
  id: string;
  name: string | null;
  email: string;
  workshopColor?: string | null;
};

type SupplierLite = {
  id: string;
  name: string;
};

type TimberMaterial = {
  id: string;
  code: string;
  name: string;
  category: string;
  thickness?: any;
  width?: any;
  unitCost?: any;
  currency?: string;
  unit?: string;
};

type TimberUsageTotals = {
  totalMillimeters: number;
  totalMeters: number;
  totalCost: number;
  currency: string;
};

type TimberUsageResponse = {
  ok: boolean;
  totals?: TimberUsageTotals;
};

export default function MobileWorkshopPage() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [processes, setProcesses] = useState<ProcessDef[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [timberMaterials, setTimberMaterials] = useState<TimberMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [timberTotalsLoading, setTimberTotalsLoading] = useState(false);
  const [timberTotalsError, setTimberTotalsError] = useState<string | null>(null);
  const [timberTotals, setTimberTotals] = useState<TimberUsageTotals | null>(null);
  const [timberProjectId, setTimberProjectId] = useState<string>('');
  const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month' | 'year'>('month');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showTimberLog, setShowTimberLog] = useState(false);
  const [showTimberDeliveryLog, setShowTimberDeliveryLog] = useState(false);
  const [quickLogForm, setQuickLogForm] = useState({
    projectId: '',
    process: '',
    hours: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [timberLogForm, setTimberLogForm] = useState({
    opportunityId: '',
    materialId: '',
    lengthMm: '',
    quantity: '1',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [timberDeliveryForm, setTimberDeliveryForm] = useState({
    supplierId: '__none__',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    lines: [
      {
        materialId: '',
        lengthMmTotal: '',
        totalCost: '',
      },
    ],
  });

  async function loadAll() {
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        const host = window.location.hostname;
        if (host === "localhost" || host === "127.0.0.1") {
          try { await ensureDemoAuth(); } catch {}
        }
      }

      const [schedR, procsR, usersR, timberR, suppliersR] = await Promise.allSettled([
        apiFetch<{ ok: boolean; projects: Project[] }>("/workshop/schedule?weeks=4"),
        apiFetch<ProcessDef[]>("/workshop-processes"),
        apiFetch<{ ok: boolean; items: UserLite[] }>("/workshop/users"),
        apiFetch<{ ok: boolean; items: TimberMaterial[] }>("/workshop/timber/materials"),
        apiFetch<{ ok?: boolean; items?: SupplierLite[] } | SupplierLite[]>('/suppliers'),
      ]);

      if (schedR.status === 'fulfilled' && schedR.value?.ok) {
        const raw = (schedR.value.projects || []) as Project[];
        const byId = new Map<string, Project>();
        for (const p of raw) byId.set(p.id, p);
        setProjects(Array.from(byId.values()));
      }

      if (procsR.status === 'fulfilled' && Array.isArray(procsR.value)) {
        setProcesses(procsR.value.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)));
      }

      if (usersR.status === 'fulfilled' && usersR.value?.ok) {
        setUsers(usersR.value.items);
      }

      if (timberR.status === 'fulfilled' && timberR.value?.ok) {
        setTimberMaterials((timberR.value.items || []).filter((m) => m));
      }

      if (suppliersR.status === 'fulfilled') {
        const v: any = suppliersR.value;
        const items = Array.isArray(v) ? v : (v?.items ?? []);
        if (Array.isArray(items)) {
          setSuppliers(items.filter((s) => s && s.id && s.name));
        }
      }
    } catch (e) {
      console.error("Failed to load workshop:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const refreshTimberTotals = async (opportunityId: string) => {
    if (!opportunityId) return;
    setTimberTotalsLoading(true);
    setTimberTotalsError(null);
    try {
      const r = await apiFetch<TimberUsageResponse>(
        `/workshop/timber/usage?opportunityId=${encodeURIComponent(opportunityId)}`
      );
      if (!r?.ok) {
        setTimberTotals(null);
        setTimberTotalsError('Failed to load timber totals');
        return;
      }
      setTimberTotals(r.totals ?? null);
    } catch (e: any) {
      setTimberTotals(null);
      setTimberTotalsError(e?.message || 'Failed to load timber totals');
    } finally {
      setTimberTotalsLoading(false);
    }
  };

  useEffect(() => {
    const opportunityId = timberProjectId;
    if (!opportunityId) {
      setTimberTotals(null);
      setTimberTotalsError(null);
      setTimberTotalsLoading(false);
      return;
    }

    refreshTimberTotals(opportunityId).catch(() => {});
  }, [timberProjectId]);

  const formatCurrency = (value: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
    } catch {
      return `£${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
    }
  };

  async function handleQuickLog() {
    if (!quickLogForm.projectId || !quickLogForm.process || !quickLogForm.hours) return;
    
    try {
      await apiFetch('/workshop/time', {
        method: 'POST',
        json: {
          projectId: quickLogForm.projectId,
          userId: user?.id,
          process: quickLogForm.process,
          date: quickLogForm.date,
          hours: Number(quickLogForm.hours),
          notes: quickLogForm.notes || undefined,
        },
      });
      setShowQuickLog(false);
      setQuickLogForm({
        projectId: '',
        process: '',
        hours: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      await loadAll();
    } catch (e: any) {
      alert('Failed to log hours: ' + (e?.message || 'Unknown error'));
    }
  }

  async function handleTimberLog() {
    const opportunityId = timberProjectId || timberLogForm.opportunityId;
    if (!opportunityId || !timberLogForm.materialId || !timberLogForm.lengthMm) return;
    const lengthMm = Number(timberLogForm.lengthMm);
    const quantity = Number(timberLogForm.quantity || '1');
    if (!Number.isFinite(lengthMm) || lengthMm <= 0) return;
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    try {
      await apiFetch('/workshop/timber/usage', {
        method: 'POST',
        json: {
          opportunityId,
          materialId: timberLogForm.materialId,
          lengthMm,
          quantity,
          usedAt: timberLogForm.date ? new Date(`${timberLogForm.date}T12:00:00.000Z`).toISOString() : undefined,
          notes: timberLogForm.notes || undefined,
        },
      });

      await refreshTimberTotals(opportunityId);
      setTimberLogForm({
        opportunityId,
        materialId: timberLogForm.materialId,
        lengthMm: '',
        quantity: '1',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      await loadAll();
    } catch (e: any) {
      alert('Failed to log timber: ' + (e?.message || 'Unknown error'));
    }
  }

  async function handleTimberDeliveryLog() {
    const lines = timberDeliveryForm.lines
      .map((l) => ({
        materialId: l.materialId,
        lengthMmTotal: Number(l.lengthMmTotal),
        totalCost: Number(l.totalCost),
      }))
      .filter((l) => l.materialId && Number.isFinite(l.lengthMmTotal) && l.lengthMmTotal > 0);

    if (lines.length < 1) return;
    for (const l of lines) {
      if (!Number.isFinite(l.totalCost) || l.totalCost < 0) return;
    }

    try {
      await apiFetch('/workshop/timber/deliveries', {
        method: 'POST',
        json: {
          supplierId: timberDeliveryForm.supplierId === '__none__' ? undefined : timberDeliveryForm.supplierId,
          reference: timberDeliveryForm.reference || undefined,
          deliveredAt: timberDeliveryForm.date ? new Date(`${timberDeliveryForm.date}T12:00:00.000Z`).toISOString() : undefined,
          notes: timberDeliveryForm.notes || undefined,
          lines: lines.map((l) => ({
            materialId: l.materialId,
            lengthMmTotal: l.lengthMmTotal,
            totalCost: l.totalCost,
            currency: 'GBP',
          })),
        },
      });

      if (timberProjectId) {
        await refreshTimberTotals(timberProjectId);
      }

      setTimberDeliveryForm({
        supplierId: timberDeliveryForm.supplierId,
        reference: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        lines: [
          {
            materialId: '',
            lengthMmTotal: '',
            totalCost: '',
          },
        ],
      });
    } catch (e: any) {
      alert('Failed to log delivery: ' + (e?.message || 'Unknown error'));
    }
  }

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const mondayBasedOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const days = [];
    for (let i = 0; i < mondayBasedOffset; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const getProjectsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return projects.filter(proj => {
      if (!proj.startDate || !proj.deliveryDate) return false;
      const start = proj.startDate.split('T')[0];
      const end = proj.deliveryDate.split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  };

  const getUserColor = (userId: string): string => {
    const u = users.find(user => user.id === userId);
    return u?.workshopColor || '#60a5fa';
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setCurrentWeek(new Date());
    setCurrentYear(new Date().getFullYear());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Fixed header with timer */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="p-4 max-w-2xl mx-auto">
          <WorkshopTimer
            projects={projects.map(p => ({ id: p.id, title: p.title }))}
            processes={processes.map(p => ({ code: p.code, name: p.name, isGeneric: p.isGeneric }))}
            onTimerChange={loadAll}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Timber totals (always visible) */}
        <Card className="p-4 space-y-3">
          <div className="font-semibold">Timber totals</div>
          <div>
            <label className="text-sm font-medium mb-1 block">Project</label>
            <Select
              value={timberProjectId}
              onValueChange={(v) => {
                setTimberProjectId(v);
                setTimberLogForm((f) => ({ ...f, opportunityId: v }));
              }}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!timberProjectId ? (
            <div className="text-sm text-muted-foreground">Select a project to view totals</div>
          ) : timberTotalsLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : timberTotalsError ? (
            <div className="text-sm text-muted-foreground">{timberTotalsError}</div>
          ) : timberTotals ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Total metres</div>
                <div className="text-sm font-semibold">{Number(timberTotals.totalMeters || 0).toFixed(2)}m</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total cost</div>
                <div className="text-sm font-semibold">
                  {formatCurrency(Number(timberTotals.totalCost || 0), timberTotals.currency || 'GBP')}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No usage yet</div>
          )}
        </Card>
        {/* View tabs */}
        <Tabs value={calendarViewMode} onValueChange={(v) => setCalendarViewMode(v as 'week' | 'month' | 'year')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>

          {/* Month View */}
          <TabsContent value="month" className="mt-4">
            <Card className="p-4">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-lg font-semibold">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={nextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Calendar grid */}
              <div className="space-y-2">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-600 mb-2">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <div key={i}>{day}</div>
                  ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth(currentMonth).map((date, idx) => {
                    const isToday = date && 
                      date.getDate() === new Date().getDate() &&
                      date.getMonth() === new Date().getMonth() &&
                      date.getFullYear() === new Date().getFullYear();
                    
                    const isWeekend = date && (date.getDay() === 0 || date.getDay() === 6);
                    const projectsOnDate = date ? getProjectsForDate(date) : [];

                    return (
                      <div
                        key={idx}
                        className={`min-h-12 p-1 text-xs rounded ${
                          !date ? 'bg-slate-50' : 
                          isWeekend ? 'bg-slate-100' :
                          isToday ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-white'
                        }`}
                      >
                        {date && (
                          <>
                            <div className={`font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                              {date.getDate()}
                            </div>
                            {projectsOnDate.length > 0 && (
                              <div className="w-2 h-2 rounded-full bg-green-500 mx-auto" />
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Week View */}
          <TabsContent value="week" className="mt-4">
            <Card className="p-4">
              <div className="text-center text-muted-foreground">
                Week view coming soon
              </div>
            </Card>
          </TabsContent>

          {/* Year View */}
          <TabsContent value="year" className="mt-4">
            <Card className="p-4">
              <div className="text-center text-muted-foreground">
                Year view coming soon
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick log hours button */}
        <Button
          onClick={() => setShowQuickLog(!showQuickLog)}
          variant="outline"
          className="w-full"
          size="lg"
        >
          {showQuickLog ? 'Cancel' : 'Log Hours Manually'}
        </Button>

        {/* Quick log timber button */}
        <Button
          onClick={() => setShowTimberLog(!showTimberLog)}
          variant="outline"
          className="w-full"
          size="lg"
        >
          {showTimberLog ? 'Cancel' : 'Log Timber Used'}
        </Button>

        {/* Quick log timber delivery button */}
        <Button
          onClick={() => setShowTimberDeliveryLog(!showTimberDeliveryLog)}
          variant="outline"
          className="w-full"
          size="lg"
        >
          {showTimberDeliveryLog ? 'Cancel' : 'Log Timber Delivery'}
        </Button>

        {/* Quick log form */}
        {showQuickLog && (
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold">Log Hours</h3>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Project</label>
              <Select value={quickLogForm.projectId} onValueChange={(v) => setQuickLogForm(f => ({ ...f, projectId: v }))}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Process</label>
              <Select value={quickLogForm.process} onValueChange={(v) => setQuickLogForm(f => ({ ...f, process: v }))}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select process" />
                </SelectTrigger>
                <SelectContent>
                  {processes.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Date</label>
              <Input
                type="date"
                value={quickLogForm.date}
                onChange={(e) => setQuickLogForm(f => ({ ...f, date: e.target.value }))}
                className="h-12"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Hours</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={quickLogForm.hours}
                onChange={(e) => setQuickLogForm(f => ({ ...f, hours: e.target.value }))}
                placeholder="e.g. 8 or 7.5"
                className="h-12"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
              <Input
                value={quickLogForm.notes}
                onChange={(e) => setQuickLogForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Add a note..."
                className="h-12"
              />
            </div>

            <Button
              onClick={handleQuickLog}
              disabled={!quickLogForm.projectId || !quickLogForm.process || !quickLogForm.hours}
              className="w-full"
              size="lg"
            >
              Log Hours
            </Button>
          </Card>
        )}

        {/* Timber log form */}
        {showTimberLog && (
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold">Log Timber Used</h3>

            <div>
              <label className="text-sm font-medium mb-1 block">Project</label>
              <Select
                value={timberProjectId}
                onValueChange={(v) => {
                  setTimberProjectId(v);
                  setTimberLogForm((f) => ({ ...f, opportunityId: v }));
                }}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Timber section</label>
              <Select value={timberLogForm.materialId} onValueChange={(v) => setTimberLogForm(f => ({ ...f, materialId: v }))}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select timber" />
                </SelectTrigger>
                <SelectContent>
                  {timberMaterials.map((m) => {
                    const t = m.thickness != null ? Number(m.thickness) : null;
                    const w = m.width != null ? Number(m.width) : null;
                    const dims = Number.isFinite(t as any) && Number.isFinite(w as any) ? ` (${t}x${w}mm)` : '';
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}{dims}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Length (mm)</label>
                <Input
                  type="number"
                  min="1"
                  value={timberLogForm.lengthMm}
                  onChange={(e) => setTimberLogForm(f => ({ ...f, lengthMm: e.target.value }))}
                  placeholder="e.g. 2400"
                  className="h-12"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Qty</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={timberLogForm.quantity}
                  onChange={(e) => setTimberLogForm(f => ({ ...f, quantity: e.target.value }))}
                  className="h-12"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Date</label>
              <Input
                type="date"
                value={timberLogForm.date}
                onChange={(e) => setTimberLogForm(f => ({ ...f, date: e.target.value }))}
                className="h-12"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
              <Input
                value={timberLogForm.notes}
                onChange={(e) => setTimberLogForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Add a note..."
                className="h-12"
              />
            </div>

            <Button
              onClick={handleTimberLog}
              disabled={!timberProjectId || !timberLogForm.materialId || !timberLogForm.lengthMm}
              className="w-full"
              size="lg"
            >
              Log Timber
            </Button>
          </Card>
        )}

        {/* Timber delivery log form */}
        {showTimberDeliveryLog && (
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold">Log Timber Delivery</h3>

            <div>
              <label className="text-sm font-medium mb-1 block">Supplier (optional)</label>
              <Select value={timberDeliveryForm.supplierId} onValueChange={(v) => setTimberDeliveryForm((f) => ({ ...f, supplierId: v }))}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Date</label>
                <Input
                  type="date"
                  value={timberDeliveryForm.date}
                  onChange={(e) => setTimberDeliveryForm((f) => ({ ...f, date: e.target.value }))}
                  className="h-12"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Reference (optional)</label>
                <Input
                  value={timberDeliveryForm.reference}
                  onChange={(e) => setTimberDeliveryForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="e.g. invoice #"
                  className="h-12"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
              <Input
                value={timberDeliveryForm.notes}
                onChange={(e) => setTimberDeliveryForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Add a note..."
                className="h-12"
              />
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Lines</div>
              {timberDeliveryForm.lines.map((line, idx) => (
                <div key={idx} className="rounded-md border bg-white p-3 space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Timber section</label>
                    <Select
                      value={line.materialId}
                      onValueChange={(v) =>
                        setTimberDeliveryForm((f) => ({
                          ...f,
                          lines: f.lines.map((l, i) => (i === idx ? { ...l, materialId: v } : l)),
                        }))
                      }
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select timber" />
                      </SelectTrigger>
                      <SelectContent>
                        {timberMaterials.map((m) => {
                          const t = m.thickness != null ? Number(m.thickness) : null;
                          const w = m.width != null ? Number(m.width) : null;
                          const dims = Number.isFinite(t as any) && Number.isFinite(w as any) ? ` (${t}x${w}mm)` : '';
                          return (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}{dims}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Total length (mm)</label>
                      <Input
                        type="number"
                        min="1"
                        value={line.lengthMmTotal}
                        onChange={(e) =>
                          setTimberDeliveryForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) => (i === idx ? { ...l, lengthMmTotal: e.target.value } : l)),
                          }))
                        }
                        placeholder="e.g. 24000"
                        className="h-12"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Total cost (£)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.totalCost}
                        onChange={(e) =>
                          setTimberDeliveryForm((f) => ({
                            ...f,
                            lines: f.lines.map((l, i) => (i === idx ? { ...l, totalCost: e.target.value } : l)),
                          }))
                        }
                        placeholder="e.g. 125.00"
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        setTimberDeliveryForm((f) => ({
                          ...f,
                          lines: [...f.lines, { materialId: '', lengthMmTotal: '', totalCost: '' }],
                        }))
                      }
                    >
                      Add line
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={timberDeliveryForm.lines.length <= 1}
                      onClick={() =>
                        setTimberDeliveryForm((f) => ({
                          ...f,
                          lines: f.lines.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      Remove line
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleTimberDeliveryLog}
              disabled={timberDeliveryForm.lines.every((l) => !l.materialId || !l.lengthMmTotal)}
              className="w-full"
              size="lg"
            >
              Log Delivery
            </Button>
          </Card>
        )}

        {/* Active projects list */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Active Projects ({projects.length})</h3>
          <div className="space-y-2">
            {projects.slice(0, 10).map(proj => (
              <div key={proj.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{proj.title}</div>
                  {proj.startDate && proj.deliveryDate && (
                    <div className="text-xs text-muted-foreground">
                      {new Date(proj.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - 
                      {new Date(proj.deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  )}
                </div>
                {proj.totalProjectHours !== undefined && (
                  <div className="text-sm font-semibold text-green-600 ml-2">
                    {proj.totalProjectHours}h
                  </div>
                )}
              </div>
            ))}
            {projects.length > 10 && (
              <div className="text-xs text-center text-muted-foreground pt-2">
                +{projects.length - 10} more projects
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
