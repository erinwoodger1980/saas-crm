// web/src/app/settings/LeadSourcesManager.tsx
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type LeadSourceRow = {
  id: string;
  source: string;
  scalable: boolean;
};

export default function LeadSourcesManager() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LeadSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newScalable, setNewScalable] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<LeadSourceRow[]>("/lead-sources");
      data.sort((a, b) => a.source.localeCompare(b.source));
      setRows(data);
    } catch (e: any) {
      toast({
        title: "Couldn’t load lead sources",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    const source = newSource.trim();
    if (!source) {
      toast({ title: "Source name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/lead-sources", { method: "POST", json: { source, scalable: newScalable } });
      setNewSource("");
      setNewScalable(true);
      await load();
      toast({ title: "Lead source added" });
    } catch (e: any) {
      toast({
        title: "Failed to add lead source",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    try {
      await apiFetch(`/lead-sources/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
      toast({ title: "Lead source removed" });
    } catch (e: any) {
      toast({
        title: "Failed to remove lead source",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border bg-white/90 p-5 shadow-[0_10px_30px_-22px_rgba(2,6,23,0.45)]">
        <div className="animate-pulse text-sm text-slate-600">Loading lead sources…</div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white/90 p-5 shadow-[0_10px_30px_-22px_rgba(2,6,23,0.45)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Lead Source List</h3>
          <p className="text-sm text-slate-500">Add/remove the sources available in the Lead Source dropdown.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={saving}>Refresh</Button>
      </div>

      <div className="mb-4 rounded-xl border bg-slate-50 p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.2fr_auto_auto] items-end">
          <label className="text-xs text-slate-600">
            New source
            <input
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
              placeholder="e.g. Google Ads"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              disabled={saving}
            />
          </label>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 md:mb-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={newScalable}
              onChange={(e) => setNewScalable(e.target.checked)}
              disabled={saving}
            />
            Scalable
          </label>

          <Button onClick={add} disabled={saving}>
            {saving ? "Saving…" : "Add"}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-slate-50 py-10 text-center text-sm text-slate-500">
          No lead sources configured yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-600">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-center font-medium">Scalable</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`border-b last:border-0 ${i % 2 ? "bg-white" : "bg-slate-50/40"}`}>
                  <td className="px-3 py-2 font-medium">{r.source}</td>
                  <td className="px-3 py-2 text-center">{r.scalable ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => remove(r.id)} disabled={saving}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
