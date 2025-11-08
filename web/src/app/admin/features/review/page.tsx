"use client";
import { useState } from 'react';
import useSWR from 'swr';
import DiffViewer from '@/components/DiffViewer';
import { apiFetch } from '@/lib/api';

interface FR { id:string; title:string; status:string; tenantId:string; patchText?:string; createdAt:string; }

export default function AdminFeatureReviewPage() {
  const fetcher = (u: string) => apiFetch<FR[]>(u);
  const { data, error, mutate } = useSWR<FR[]>("/feature-requests/admin/queue", fetcher);
  const [active, setActive] = useState<FR | null>(null);
  const [taskKey, setTaskKey] = useState('ads-lp-prod');
  const [extra, setExtra] = useState('');
  const [log, setLog] = useState('');
  const [busy, setBusy] = useState(false);

  async function runAI(id: string) {
    setBusy(true); setLog('');
    try {
      await apiFetch(`/feature-requests/admin/${id}/run-ai`, { method:'POST', json:{ taskKey, extraContext: extra }});
      mutate();
      setLog('AI patch generated');
    } catch(e:any){ setLog(e?.message||'Failed'); } finally { setBusy(false); }
  }
  async function approve(id: string) {
    setBusy(true); setLog('');
    try { await apiFetch(`/feature-requests/admin/${id}/approve`, { method:'POST' }); mutate(); setLog('Approved'); } catch(e:any){ setLog(e?.message||'Failed'); } finally { setBusy(false); }
  }
  async function reject(id: string) {
    setBusy(true); setLog('');
    try { await apiFetch(`/feature-requests/admin/${id}/reject`, { method:'POST', json:{ reason:'Not suitable now' } }); mutate(); setLog('Rejected'); } catch(e:any){ setLog(e?.message||'Failed'); } finally { setBusy(false); }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Feature Request Review</h1>
      {error && <p className="text-red-600">Failed to load queue</p>}
      {!data && !error && <p>Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <ul className="space-y-2">
            {data?.map(fr => (
              <li key={fr.id} className={`border rounded p-3 bg-white cursor-pointer ${active?.id===fr.id?'ring-2 ring-blue-500':''}`} onClick={()=>setActive(fr)}>
                <div className="flex justify-between items-center">
                  <p className="font-medium">{fr.title}</p>
                  <span className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200">{fr.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Tenant: {fr.tenantId}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {active ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Selected: {active.title}</h2>
              {active.patchText ? <DiffViewer diff={active.patchText} /> : (
                <div className="space-y-2 border rounded p-3">
                  <div>
                    <label className="block text-sm font-medium">Prompt Template</label>
                    <select className="mt-1 border rounded px-2 py-1" value={taskKey} onChange={e=>setTaskKey(e.target.value)}>
                      <option value="ads-lp-prod">ads-lp-prod</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Extra Context (optional)</label>
                    <textarea className="w-full border rounded px-2 py-1 h-24" value={extra} onChange={e=>setExtra(e.target.value)} />
                  </div>
                  <button disabled={busy} onClick={()=>runAI(active.id)} className="px-4 py-2 bg-purple-600 text-white rounded">{busy?'Running…':'Run AI'}</button>
                </div>
              )}
              {active.patchText && (
                <div className="flex gap-3">
                  <button disabled={busy} onClick={()=>approve(active.id)} className="px-4 py-2 bg-green-600 text-white rounded">{busy?'…':'Approve'}</button>
                  <button disabled={busy} onClick={()=>reject(active.id)} className="px-4 py-2 bg-red-600 text-white rounded">Reject</button>
                </div>
              )}
              {log && <p className="text-xs text-blue-700">{log}</p>}
            </div>
          ) : <p className="text-gray-600">Select a request from the left.</p>}
        </div>
      </div>
    </div>
  );
}
