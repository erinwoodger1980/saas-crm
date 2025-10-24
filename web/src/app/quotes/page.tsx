"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

type QuoteRow = {
  id: string;
  title: string | null;
  status: string | null;
  totalGBP: string | number | null;
  createdAt: string;
  leadId: string | null;
};

export default function QuotesPage() {
  const [rows, setRows] = useState<QuoteRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<QuoteRow[]>("/quotes");
      setRows(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load quotes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createDraft() {
    setCreating(true);
    setError(null);
    try {
      const title = `Draft quote ${new Date().toLocaleString()}`;
      const q = await apiFetch<QuoteRow>("/quotes", { method: "POST", json: { title } });
      // Navigate to builder
      window.location.href = `/quotes/${encodeURIComponent(q.id)}`;
    } catch (e: any) {
      setError(e?.message || "Failed to create quote");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Quotes</h1>
          <p className="text-sm text-slate-500">Supplier quotes, parsed lines, and pricing</p>
        </div>
        <Button onClick={createDraft} disabled={creating}>
          {creating ? "Creating…" : "New draft quote"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading && <div className="text-sm text-slate-500">Loading…</div>}

      {!loading && rows && rows.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No quotes yet. Create your first draft above.
        </div>
      )}

      {!loading && rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total (GBP)</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Lead</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/quotes/${r.id}`} className="text-blue-600 hover:text-blue-800">
                      {r.title || "Untitled"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.status || "DRAFT"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-900">
                    {r.totalGBP != null ? Number(r.totalGBP).toFixed(2) : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.leadId ? r.leadId.slice(0, 8) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
