import React, { Suspense } from 'react';

async function fetchTelemetry(params: Record<string,string>) {
  const qs = new URLSearchParams(params).toString();
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  const resp = await fetch(`${base}/api/internal/vision/telemetry${qs ? '?' + qs : ''}`, { cache: 'no-store' });
  return await resp.json();
}

function formatTs(ts: number) { return new Date(ts).toLocaleString(); }

export default async function VisionTelemetryPage({ searchParams }: { searchParams: Record<string,string> }) {
  const data = await fetchTelemetry(searchParams || {});
  const items: any[] = Array.isArray(data.persisted) ? data.persisted : [];
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Vision Telemetry</h1>
      <div className="text-sm text-slate-600">Recent AI & depth inference events (server proxy).</div>
      <form className="flex gap-2 flex-wrap" method="get">
        <input name="since" placeholder="Since (ISO)" defaultValue={searchParams?.since || ''} className="border px-2 py-1 rounded" />
        <input name="until" placeholder="Until (ISO)" defaultValue={searchParams?.until || ''} className="border px-2 py-1 rounded" />
        <input name="page" placeholder="Page" defaultValue={searchParams?.page || '0'} className="border px-2 py-1 rounded w-20" />
        <input name="pageSize" placeholder="Page Size" defaultValue={searchParams?.pageSize || '50'} className="border px-2 py-1 rounded w-24" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded">Apply</button>
      </form>
      <div className="overflow-auto max-h-[60vh] border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">Route</th>
              <th className="p-2 text-left">Model</th>
              <th className="p-2 text-left">ms</th>
              <th className="p-2 text-left">Cached</th>
              <th className="p-2 text-left">Cost ($)</th>
              <th className="p-2 text-left">Tokens</th>
              <th className="p-2 text-left">Source</th>
              <th className="p-2 text-left">Error</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it,i) => (
              <tr key={i} className="odd:bg-white even:bg-slate-50">
                <td className="p-2 whitespace-nowrap">{formatTs(it.ts)}</td>
                <td className="p-2">{it.route}</td>
                <td className="p-2">{it.model || '-'}</td>
                <td className="p-2">{it.ms}</td>
                <td className="p-2">{it.cached ? 'yes' : 'no'}</td>
                <td className="p-2">{it.costUsd?.toFixed?.(5) || '-'}</td>
                <td className="p-2">{it.usage ? `${it.usage.prompt}/${it.usage.completion}/${it.usage.total}` : '-'}</td>
                <td className="p-2">{it.source || '-'}</td>
                <td className="p-2 text-red-600 max-w-[200px] truncate" title={it.error || ''}>{it.error ? it.error : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded max-h-[30vh] overflow-auto">{JSON.stringify({ meta: { persistedCount: data.persistedCount, note: data.note } }, null, 2)}</pre>
    </div>
  );
}
