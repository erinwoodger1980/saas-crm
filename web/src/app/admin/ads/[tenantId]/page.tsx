'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface PerformanceRow {
  id: string;
  keyword: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversionRate: number;
  cpl: number;
  qualityScore: number | null;
}

interface SuggestionRow {
  id: string;
  keyword: string;
  suggestedFor: string;
  newText: string;
  reason: string;
  status: string;
  conversionRate: number;
}

interface Report {
  topKeywords: Array<{
    keyword: string;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
    cpl: number;
    qualityScore: number | null;
  }>;
  underperforming: Array<{
    keyword: string;
    impressions: number;
    clicks: number;
    ctr: number;
    cpl: number;
    reason: string;
  }>;
  suggestions: Array<{
    id: string;
    keyword: string;
    suggestedFor: string;
    newText: string;
    reason: string;
    status: string;
    createdAt: string;
  }>;
}

export default function AdsInsightsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [perf, setPerf] = useState<PerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const r = await apiFetch<Report>(`/keywords/${tenantId}/report`);
        setReport(r);
        const p = await apiFetch<{ performance: PerformanceRow[] }>(`/keywords/${tenantId}/performance?limit=50`);
        setPerf(p.performance || []);
      } catch (e) {
        console.error('Failed to load ads insights', e);
      } finally {
        setLoading(false);
      }
    }
    if (tenantId) load();
  }, [tenantId]);

  async function syncNow() {
    setSyncing(true);
    try {
      await apiFetch(`/keywords/${tenantId}/sync`, { method: 'POST' });
      // reload after sync
      const r = await apiFetch<Report>(`/keywords/${tenantId}/report`);
      setReport(r);
      const p = await apiFetch<{ performance: PerformanceRow[] }>(`/keywords/${tenantId}/performance?limit=50`);
      setPerf(p.performance || []);
      alert('Sync complete');
    } catch (e) {
      alert('Sync failed. Check server logs for details.');
    } finally {
      setSyncing(false);
    }
  }

  async function approve(id: string) {
    try {
      await apiFetch(`/keywords/${tenantId}/suggestions/${id}/approve`, { method: 'PATCH' });
      const r = await apiFetch<Report>(`/keywords/${tenantId}/report`);
      setReport(r);
    } catch {}
  }

  async function reject(id: string) {
    try {
      await apiFetch(`/keywords/${tenantId}/suggestions/${id}/reject`, { method: 'PATCH' });
      const r = await apiFetch<Report>(`/keywords/${tenantId}/report`);
      setReport(r);
    } catch {}
  }

  async function applyApproved() {
    try {
      await apiFetch(`/keywords/${tenantId}/apply`, { method: 'POST' });
      alert('Applied approved suggestions to landing content');
    } catch (e) {
      alert('Apply failed.');
    }
  }

  if (loading) {
    return (
      <div className="p-8">Loading...</div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ads Insights</h1>
          <p className="text-gray-600">Keyword performance and optimization suggestions</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/tenants" className="px-3 py-2 border rounded">Back</Link>
          <button onClick={syncNow} disabled={syncing} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
          <button onClick={applyApproved} className="px-3 py-2 bg-green-600 text-white rounded">Apply Approved</button>
        </div>
      </div>

      {/* Top Keywords */}
      <section className="bg-white rounded shadow">
        <div className="p-4 border-b"><h2 className="font-semibold">Top Keywords</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-medium">Keyword</th>
                <th className="p-3 text-right text-sm font-medium">Impr</th>
                <th className="p-3 text-right text-sm font-medium">Clicks</th>
                <th className="p-3 text-right text-sm font-medium">Conv</th>
                <th className="p-3 text-right text-sm font-medium">CTR %</th>
                <th className="p-3 text-right text-sm font-medium">CVR %</th>
                <th className="p-3 text-right text-sm font-medium">CPL</th>
                <th className="p-3 text-right text-sm font-medium">QS</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(report?.topKeywords || []).map((k) => (
                <tr key={k.keyword}>
                  <td className="p-3">{k.keyword}</td>
                  <td className="p-3 text-right">{k.impressions}</td>
                  <td className="p-3 text-right">{k.clicks}</td>
                  <td className="p-3 text-right">{k.conversions}</td>
                  <td className="p-3 text-right">{k.ctr.toFixed(2)}</td>
                  <td className="p-3 text-right">{k.conversionRate.toFixed(2)}</td>
                  <td className="p-3 text-right">£{k.cpl.toFixed(2)}</td>
                  <td className="p-3 text-right">{k.qualityScore ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Underperforming */}
      <section className="bg-white rounded shadow">
        <div className="p-4 border-b"><h2 className="font-semibold">Underperforming</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-medium">Keyword</th>
                <th className="p-3 text-right text-sm font-medium">Impr</th>
                <th className="p-3 text-right text-sm font-medium">Clicks</th>
                <th className="p-3 text-right text-sm font-medium">CTR %</th>
                <th className="p-3 text-right text-sm font-medium">CPL</th>
                <th className="p-3 text-left text-sm font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(report?.underperforming || []).map((k) => (
                <tr key={k.keyword}>
                  <td className="p-3">{k.keyword}</td>
                  <td className="p-3 text-right">{k.impressions}</td>
                  <td className="p-3 text-right">{k.clicks}</td>
                  <td className="p-3 text-right">{k.ctr.toFixed(2)}</td>
                  <td className="p-3 text-right">£{k.cpl.toFixed(2)}</td>
                  <td className="p-3">{k.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Suggestions */}
      <section className="bg-white rounded shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Suggestions</h2>
          <div className="text-sm text-gray-500">Approve to include in Apply</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-medium">Keyword</th>
                <th className="p-3 text-left text-sm font-medium">Type</th>
                <th className="p-3 text-left text-sm font-medium">Text</th>
                <th className="p-3 text-left text-sm font-medium">Reason</th>
                <th className="p-3 text-right text-sm font-medium">CVR %</th>
                <th className="p-3 text-right text-sm font-medium">Status</th>
                <th className="p-3 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(report?.suggestions || []).map((s) => (
                <tr key={s.id}>
                  <td className="p-3">{s.keyword}</td>
                  <td className="p-3">{s.suggestedFor}</td>
                  <td className="p-3 max-w-[480px] truncate" title={s.newText}>{s.newText}</td>
                  <td className="p-3 max-w-[360px] truncate" title={s.reason}>{s.reason}</td>
                  <td className="p-3 text-right">{(s as any).conversionRate ? (s as any).conversionRate.toFixed?.(2) : '—'}</td>
                  <td className="p-3 text-right">{s.status}</td>
                  <td className="p-3 text-right space-x-2">
                    {s.status === 'pending' ? (
                      <>
                        <button onClick={() => approve(s.id)} className="px-2 py-1 text-green-700 border border-green-600 rounded">Approve</button>
                        <button onClick={() => reject(s.id)} className="px-2 py-1 text-red-700 border border-red-600 rounded">Reject</button>
                      </>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent performance raw table (optional) */}
      <section className="bg-white rounded shadow">
        <div className="p-4 border-b"><h2 className="font-semibold">Recent Performance (raw)</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-medium">Keyword</th>
                <th className="p-3 text-right text-sm font-medium">Impr</th>
                <th className="p-3 text-right text-sm font-medium">Clicks</th>
                <th className="p-3 text-right text-sm font-medium">Conv</th>
                <th className="p-3 text-right text-sm font-medium">CTR %</th>
                <th className="p-3 text-right text-sm font-medium">CVR %</th>
                <th className="p-3 text-right text-sm font-medium">CPL</th>
                <th className="p-3 text-right text-sm font-medium">QS</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {perf.map((k) => (
                <tr key={k.id}>
                  <td className="p-3">{k.keyword}</td>
                  <td className="p-3 text-right">{k.impressions}</td>
                  <td className="p-3 text-right">{k.clicks}</td>
                  <td className="p-3 text-right">{k.conversions}</td>
                  <td className="p-3 text-right">{k.ctr.toFixed(2)}</td>
                  <td className="p-3 text-right">{k.conversionRate.toFixed(2)}</td>
                  <td className="p-3 text-right">£{k.cpl.toFixed(2)}</td>
                  <td className="p-3 text-right">{k.qualityScore ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
