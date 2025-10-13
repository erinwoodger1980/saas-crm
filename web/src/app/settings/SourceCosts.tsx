// web/src/app/settings/SourceCosts.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type CostRow = {
  id: string;
  tenantId: string;
  source: string;
  month: string; // ISO date
  spend: number;
  leads: number;
  conversions: number;
  scalable: boolean;
};

type FormState = {
  source: string;
  month: string; // yyyy-mm-01
  spend: string;
  leads: string;
  conversions: string;
  scalable: boolean;
};

const emptyForm: FormState = {
  source: "",
  month: "",
  spend: "",
  leads: "",
  conversions: "",
  scalable: true,
};

export default function SourceCosts() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<CostRow[]>("/source-costs");
      // Sort newest month first, then by source
      data.sort((a, b) => {
        const ma = +new Date(a.month);
        const mb = +new Date(b.month);
        if (mb !== ma) return mb - ma;
        return a.source.localeCompare(b.source);
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function parseMonthInput(v: string) {
    // accepts yyyy-mm or yyyy-mm-01 → returns yyyy-mm-01
    if (!v) return "";
    const m = v.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!m) return v;
    const day = m[3] || "01";
    return `${m[1]}-${m[2]}-${day}`;
  }

  async function save() {
    // basic validation & coercion
    const payload = {
      source: form.source.trim(),
      month: parseMonthInput(form.month.trim()),
      spend: Number(form.spend || 0),
      leads: Number(form.leads || 0),
      conversions: Number(form.conversions || 0),
      scalable: !!form.scalable,
    };

    if (!payload.source) {
      toast({ title: "Source is required", variant: "destructive" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.month)) {
      toast({ title: "Month must be YYYY-MM or YYYY-MM-01", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/source-costs", { method: "POST", json: payload });
      toast({ title: "Saved" });
      setForm(emptyForm);
      setAdding(false);
      await load();
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const totals = useMemo(() => {
    const spend = rows.reduce((s, r) => s + (r.spend || 0), 0);
    const leads = rows.reduce((s, r) => s + (r.leads || 0), 0);
    const conversions = rows.reduce((s, r) => s + (r.conversions || 0), 0);
    const cpl = leads ? spend / leads : 0;
    const cps = conversions ? spend / conversions : 0;
    return { spend, leads, conversions, cpl, cps };
  }, [rows]);

  if (loading) {
    return (
      <section className="rounded-2xl border bg-white/90 p-5 shadow-[0_10px_30px_-22px_rgba(2,6,23,0.45)]">
        <div className="animate-pulse text-sm text-slate-600">Loading costs…</div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white/90 p-5 shadow-[0_10px_30px_-22px_rgba(2,6,23,0.45)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Lead Source Costs</h3>
          <p className="text-sm text-slate-500">
            Track monthly spend, leads and sales by source. CPL/CPS are computed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "Add Month"}
          </Button>
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
      </div>

      {/* Quick add row */}
      {adding && (
        <div className="mb-4 rounded-xl border bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.2fr_0.9fr_0.8fr_0.7fr_0.7fr_auto] items-end">
            <label className="text-xs text-slate-600">
              Source
              <input
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                placeholder="e.g. Google Ads"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-600">
              Month
              <input
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                placeholder="YYYY-MM or YYYY-MM-01"
                value={form.month}
                onChange={(e) => setForm({ ...form, month: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-600">
              Spend (£)
              <input
                type="number"
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={form.spend}
                onChange={(e) => setForm({ ...form, spend: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-600">
              Leads
              <input
                type="number"
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={form.leads}
                onChange={(e) => setForm({ ...form, leads: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-600">
              Sales
              <input
                type="number"
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={form.conversions}
                onChange={(e) => setForm({ ...form, conversions: e.target.value })}
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.scalable}
                  onChange={(e) => setForm({ ...form, scalable: e.target.checked })}
                />
                Scalable
              </label>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-slate-50 py-10 text-center text-sm text-slate-500">
          No source cost rows yet. Click <b>Add Month</b> to create your first entry.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-600">
              <tr className="border-b">
                <Th>Source</Th>
                <Th>Month</Th>
                <Th className="text-right">Spend</Th>
                <Th className="text-right">Leads</Th>
                <Th className="text-right">Sales</Th>
                <Th className="text-right">CPL</Th>
                <Th className="text-right">CPS</Th>
                <Th className="text-right">Conv%</Th>
                <Th className="text-center">Scalable</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const cpl = r.leads ? r.spend / r.leads : 0;
                const cps = r.conversions ? r.spend / r.conversions : 0;
                const convPct =
                  r.leads && r.conversions ? (r.conversions / r.leads) * 100 : 0;

                return (
                  <tr
                    key={r.id}
                    className={`border-b last:border-0 ${
                      i % 2 ? "bg-white" : "bg-slate-50/40"
                    }`}
                  >
                    <Td className="font-medium">{r.source}</Td>
                    <Td>
                      {new Date(r.month).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric",
                      })}
                    </Td>
                    <Td className="text-right">£{fmt0(r.spend)}</Td>
                    <Td className="text-right">{r.leads}</Td>
                    <Td className="text-right">{r.conversions}</Td>
                    <Td className="text-right">£{fmt0(cpl)}</Td>
                    <Td className="text-right">£{fmt0(cps)}</Td>
                    <Td className="text-right">{fmt0(convPct)}%</Td>
                    <Td className="text-center">
                      {r.scalable ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200">
                          Scalable
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 border border-slate-200">
                          Fixed
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals */}
            <tfoot>
              <tr className="bg-white">
                <Td className="font-semibold">Total</Td>
                <Td>—</Td>
                <Td className="text-right font-semibold">£{fmt0(totals.spend)}</Td>
                <Td className="text-right font-semibold">{totals.leads}</Td>
                <Td className="text-right font-semibold">{totals.conversions}</Td>
                <Td className="text-right">£{fmt0(totals.cpl)}</Td>
                <Td className="text-right">£{fmt0(totals.cps)}</Td>
                <Td className="text-right">
                  {fmt0(
                    totals.leads && totals.conversions
                      ? (totals.conversions / totals.leads) * 100
                      : 0
                  )}
                  %
                </Td>
                <Td className="text-center">—</Td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---- tiny table helpers ---- */
function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-3 py-2 text-xs font-medium ${className}`}>{children}</th>;
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
function fmt0(n: number) {
  if (!isFinite(n)) return "0";
  return Math.round(n).toString();
}