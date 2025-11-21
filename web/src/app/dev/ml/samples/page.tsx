"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Server, RefreshCcw, Search, Filter, Database } from "lucide-react";

interface MLSample {
  id: string;
  tenantId: string;
  messageId: string | null;
  attachmentId: string | null;
  url: string | null;
  filename: string | null;
  quotedAt: string | null;
  textChars: number | null;
  currency: string | null;
  estimatedTotal: number | null;
  confidence: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  notes?: string | null;
  label?: string | null;
  tenant?: { id: string; name: string; slug: string } | null;
}

interface DevSamplesResponse { ok: boolean; count: number; items: MLSample[] }
interface DevTenantsResponse { ok: boolean; tenants: Array<{ id: string; name: string; slug: string }> }

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

export default function MLSamplesPage() {
  const [samples, setSamples] = useState<MLSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [tenantFilter, setTenantFilter] = useState<string>("");

  const loadSamples = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: string[] = [];
      if (tenantFilter) params.push(`tenantId=${encodeURIComponent(tenantFilter)}`);
      if (search.trim()) params.push(`q=${encodeURIComponent(search.trim())}`); // (future: backend search)
      if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`);
      params.push('limit=200');
      const url = `/dev/ml/samples${params.length ? '?' + params.join('&') : ''}`;
      const resp = await apiFetch<DevSamplesResponse>(url);
      if (!resp.ok) throw new Error("Failed to load samples");
      let newItems = resp.items;
      if (statusFilter) {
        newItems = newItems.filter(s => s.status === statusFilter);
      }
      setSamples(newItems);
    } catch (e: any) {
      setError(e?.message || "Failed to load samples");
    } finally {
      setLoading(false);
    }
  }, [tenantFilter, search, statusFilter]);

  useEffect(() => {
    // initial load: fetch tenants then samples
    (async () => {
      try {
        const t = await apiFetch<DevTenantsResponse>('/dev/tenants');
        if (t.ok) setTenants(t.tenants);
      } catch {}
      loadSamples();
    })();
  }, []); // eslint-disable-line

  // When search or statusFilter changes, reset list
  useEffect(() => {
    const timeout = setTimeout(() => { loadSamples(); }, 400);
    return () => clearTimeout(timeout);
  }, [search, statusFilter, tenantFilter, loadSamples]);

  async function updateStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'PENDING') {
    try {
      // optimistic update
      setSamples(prev => prev.map(s => s.id === id ? { ...s, status } : s));
      await apiFetch(`/internal/ml/samples/${id}/status`, {
        method: 'PATCH',
        json: { status }
      });
    } catch (e: any) {
      alert('Failed to update status: ' + (e.message || 'unknown'));
      // rollback: reload current window of samples
      loadSamples({ reset: true });
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Server className="w-8 h-8" />
          ML Samples
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadSamples()} disabled={loading}>
            <RefreshCcw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search filename / URL / messageId"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" />
            <select
              className="border rounded px-2 py-1 text-sm"
              value={tenantFilter}
              onChange={e => setTenantFilter(e.target.value)}
            >
              <option value="">All Tenants</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.slug || t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              className="border rounded px-2 py-1 text-sm"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500 ml-auto">
            Showing {samples.length} sample{samples.length !== 1 ? 's' : ''}{statusFilter ? ` (${statusFilter})` : ''}
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200 text-red-700">
          {error}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Tenant</th>
                <th className="px-3 py-2 font-medium">Filename</th>
                <th className="px-3 py-2 font-medium">Message / Attachment</th>
                <th className="px-3 py-2 font-medium">Quoted At</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Chars</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {samples.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-500">No samples found.</td>
                </tr>
              )}
              {samples.map(s => (
                <tr key={s.id} className="border-b last:border-b-0 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap max-w-[140px] truncate" title={s.id}>{s.id}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${s.status === 'APPROVED' ? 'bg-green-100 text-green-700' : s.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.status}</span>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap max-w-[140px] truncate" title={s.tenant?.slug || s.tenantId}>{s.tenant?.slug || s.tenantId}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={s.filename || ''}>{s.filename || '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    <div className="truncate max-w-[160px]" title={s.messageId || ''}>{s.messageId || '∅'}</div>
                    <div className="truncate max-w-[160px] text-slate-500" title={s.attachmentId || ''}>{s.attachmentId || '∅'}</div>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{s.quotedAt ? new Date(s.quotedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2 text-xs">{s.confidence != null ? (s.confidence * 100).toFixed(1) + '%' : '—'}</td>
                  <td className="px-3 py-2 text-xs">{s.estimatedTotal != null ? `${s.currency || ''} ${s.estimatedTotal.toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2 text-xs">{s.textChars != null ? s.textChars : '—'}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {s.url && (
                        <Button size="sm" variant="outline" onClick={() => window.open(s.url!, '_blank')}>View</Button>
                      )}
                      {s.status !== 'APPROVED' && (
                        <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => updateStatus(s.id, 'APPROVED')}>Approve</Button>
                      )}
                      {s.status !== 'REJECTED' && (
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(s.id, 'REJECTED')}>Reject</Button>
                      )}
                      {s.status !== 'PENDING' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, 'PENDING')}>Reset</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-center text-slate-500">Loading...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
