"use client";
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { apiFetch, adminFeatureRunAi, adminFeatureApprove, adminFeatureReject, adminPromptKeys } from '@/lib/api';
import Link from 'next/link';

interface FR {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  patchText?: string | null;
  checksStatus?: string | null;
  logs?: string | null;
  prUrl?: string | null;
}

function DiffView({ diff }: { diff: string }) {
  const lines = useMemo(() => diff.split('\n'), [diff]);
  return (
    <pre className="text-xs leading-5 overflow-auto max-h-[60vh] p-3 rounded border bg-slate-50">
      {lines.map((l, i) => {
        const cls = l.startsWith('+++') || l.startsWith('---')
          ? 'text-purple-700'
          : l.startsWith('***')
          ? 'text-blue-700'
          : l.startsWith('+')
          ? 'text-green-700'
          : l.startsWith('-')
          ? 'text-red-700'
          : 'text-slate-800';
        return <div key={i} className={cls}>{l}</div>;
      })}
    </pre>
  );
}

export default function FeatureRequestDetail({ params }: { params: { id: string } }) {
  const id = params.id;
  const { data: fr, mutate, error } = useSWR<FR>(`/feature-requests/${id}`, (url) => apiFetch<FR>(url));
  const { data: keysData } = useSWR<{ keys: string[] }>(`/feature-requests/admin/prompt-keys`, () => adminPromptKeys());

  const [taskKey, setTaskKey] = useState<string>('');
  const [extraContext, setExtraContext] = useState('');
  const [preview, setPreview] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    if (!taskKey && keysData?.keys?.length) setTaskKey(keysData.keys[0]);
  }, [keysData, taskKey]);

  const run = async (persist: boolean) => {
    if (!taskKey) return;
    setBusy(true); setMsg('');
    try {
      const out = await adminFeatureRunAi(id, { taskKey, extraContext: extraContext || undefined, ...(persist ? {} as any : { dryRun: true } as any) } as any);
      if ((out as any)?.dryRun) {
        setPreview((out as any)?.patchText || '');
        setMsg('Dry run complete');
      } else {
        await mutate();
        setPreview('');
        setMsg('Patch saved and marked READY_FOR_REVIEW');
      }
    } catch (e: any) {
      setMsg(e?.message || 'Failed to run AI');
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    setBusy(true); setMsg('');
    try {
      const updated = await adminFeatureApprove(id);
      await mutate();
      setMsg((updated as any)?.prUrl ? `Approved. PR: ${(updated as any).prUrl}` : 'Approved. Branch pushed.');
    } catch (e: any) {
      setMsg(e?.message || 'Approve failed');
    } finally { setBusy(false); }
  };

  const reject = async () => {
    const reason = prompt('Reason (optional):') || undefined;
    setBusy(true); setMsg('');
    try { await adminFeatureReject(id, reason); await mutate(); setMsg('Rejected'); } catch (e: any) { setMsg(e?.message || 'Reject failed'); } finally { setBusy(false); }
  };

  if (error) {
    return <div className="p-8"><p className="text-red-600">Failed to load: {String((error as any)?.message || error)}</p></div>;
  }
  if (!fr) {
    return <div className="p-8"><p>Loading…</p></div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{fr.title}</h1>
          <p className="text-sm text-slate-500">{fr.category} · {new Date(fr.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200">{fr.status}</span>
          <Link href="/features" className="text-sm text-blue-600">Back</Link>
        </div>
      </div>

      {fr.logs && (
        <div className="text-xs bg-slate-50 border rounded p-3 whitespace-pre-wrap">
          <strong>Logs:</strong> {fr.logs}
        </div>
      )}

      {/* Run AI */}
      <div className="border rounded p-4 space-y-3 bg-white">
        <h2 className="font-semibold">Run AI</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Task Template</label>
            <select className="w-full border rounded px-3 py-2" value={taskKey} onChange={e=>setTaskKey(e.target.value)}>
              {(keysData?.keys || []).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Extra Context (optional)</label>
            <textarea className="w-full border rounded px-3 py-2 h-20" value={extraContext} onChange={e=>setExtraContext(e.target.value)} placeholder="Any specifics, file hints, acceptance criteria…" />
          </div>
        </div>
        <div className="flex gap-2">
          <button disabled={busy || !taskKey} onClick={()=>run(false)} className="px-3 py-1.5 rounded border bg-slate-100 disabled:opacity-50">Dry Run</button>
          <button disabled={busy || !taskKey} onClick={()=>run(true)} className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50">Generate Patch</button>
        </div>
        {msg && <div className="text-sm text-slate-700">{msg}</div>}
      </div>

      {/* Patch Preview */}
      {(preview || fr.patchText) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Patch Preview</h2>
            <div className="text-xs text-slate-500">{fr.checksStatus ? `Checks: ${fr.checksStatus}` : null}</div>
          </div>
          <DiffView diff={(preview || fr.patchText || '') as string} />
        </div>
      )}

      {/* Approve/Reject */}
      <div className="flex gap-2">
        <button disabled={busy || !fr.patchText} onClick={approve} className="px-3 py-1.5 rounded bg-green-600 text-white disabled:opacity-50">Approve & Apply</button>
        <button disabled={busy} onClick={reject} className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50">Reject</button>
        {fr.prUrl && (
          <a href={fr.prUrl} target="_blank" className="ml-auto text-blue-600 underline">View PR</a>
        )}
      </div>
    </div>
  );
}
