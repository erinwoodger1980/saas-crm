"use client";
import { useMemo, useState } from 'react';
import DiffViewer from '@/components/DiffViewer';
import RunStatus from '@/components/RunStatus';
import { adminFeatureApprove, adminFeatureReject, adminFeatureRunAi, runCodex } from '@/lib/api';

type Status = "idle" | "running" | "ready" | "approved" | "failed";

export default function DeveloperConsolePage() {
  const [desc, setDesc] = useState("");
  const [template, setTemplate] = useState("ads-lp-prod");
  const [featureId, setFeatureId] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [diff, setDiff] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);

  const canApprove = useMemo(() => !!diff && status === 'ready', [diff, status]);

  async function onRun() {
    setStatus('running'); setDiff(""); setLogs([]); setPrUrl(null); setBranch(null);
    try {
      if (featureId.trim()) {
        const res: any = await adminFeatureRunAi(featureId.trim(), { taskKey: template, extraContext: desc });
        setDiff(String(res?.patchText || ''));
        const lg = (res?.logs ? String(res.logs) : '').slice(0, 20000);
        if (lg) setLogs(lg.split('\n'));
        setStatus('ready');
      } else {
        const out = await runCodex({ extraContext: buildPrompt(desc, template), mode: 'dry-run' });
        if (!out.ok) throw new Error((out.errors || []).join('\n'));
        setDiff(String(out.patch || ''));
        const lg: string[] = [];
        if (out.mode) lg.push(`mode: ${out.mode}`);
        if (out.branchName) lg.push(`branch: ${out.branchName}`);
        setLogs(lg);
        setStatus('ready');
      }
    } catch (e: any) {
      setStatus('failed');
      setLogs([e?.message || String(e)]);
    }
  }

  async function onApprove() {
    if (!diff) return;
    setStatus('running');
    try {
      if (featureId.trim()) {
        const res: any = await adminFeatureApprove(featureId.trim());
        setPrUrl(res?.prUrl || null);
        setBranch(res?.branchName || null);
        const lg = (res?.logs ? String(res.logs) : '').slice(0, 20000);
        if (lg) setLogs(lg.split('\n'));
        setStatus('approved');
      } else {
        // Fallback: request PR mode
        const out = await runCodex({ extraContext: buildPrompt(desc, template), mode: 'pr' });
        if (!out.ok) throw new Error((out.errors || []).join('\n'));
        setPrUrl(out.prUrl || null);
        setBranch(out.branchName || null);
        setStatus('approved');
      }
    } catch (e: any) {
      setStatus('failed');
      setLogs([e?.message || String(e)]);
    }
  }

  async function onReject() {
    try {
      if (featureId.trim()) await adminFeatureReject(featureId.trim(), 'Rejected via Developer Console');
    } finally {
      setStatus('idle'); setDiff(""); setLogs([]); setPrUrl(null); setBranch(null);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Developer Console</h1>
        <p className="text-sm text-gray-600">Run AI patches, review diffs, and approve PRs.</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-medium">Describe the change</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} className="w-full border rounded px-3 py-2 h-32" placeholder="e.g., make Google Ads section production-ready" />
          </div>
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block text-sm font-medium">Task template</label>
              <select value={template} onChange={e=>setTemplate(e.target.value)} className="border rounded px-3 py-2">
                <option value="ads-lp-prod">ads-lp-prod</option>
                <option value="landing-pages">landing-pages</option>
                <option value="ui-copy">ui-copy</option>
                <option value="other">other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Feature Request ID (optional)</label>
              <input value={featureId} onChange={e=>setFeatureId(e.target.value)} className="border rounded px-3 py-2 w-64" placeholder="fr_..." />
            </div>
            <button onClick={onRun} className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50" disabled={!desc || status==='running'}>
              {status==='running' ? 'Running…' : 'Run AI Patch'}
            </button>
          </div>

          {/* Tabs simplified to two stacked panels for minimal surface */}
          <div className="space-y-4">
            <div className="rounded border bg-white">
              <div className="px-3 py-2 border-b text-sm font-medium">Diff</div>
              <div className="p-3">
                {diff ? <DiffViewer diffText={diff} /> : <p className="text-sm text-gray-500">No diff yet.</p>}
              </div>
            </div>
            <div className="rounded border bg-white">
              <div className="px-3 py-2 border-b text-sm font-medium">Logs</div>
              <pre className="text-xs p-3 whitespace-pre-wrap min-h-[80px]">{logs.join('\n')}</pre>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onApprove} disabled={!canApprove} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">Approve</button>
            <button onClick={onReject} className="px-4 py-2 bg-red-600 text-white rounded">Reject</button>
          </div>
        </div>

        <aside className="lg:col-span-1 space-y-4">
          <RunStatus status={status} logs={logs} prUrl={prUrl || undefined} previewUrl={null} />
          {branch && (
            <div className="text-xs text-gray-600">Branch: <span className="font-mono">{branch}</span></div>
          )}
          <RecentActivity />
        </aside>
      </section>
    </div>
  );
}

function buildPrompt(desc: string, template: string) {
  const head = `[${template}]`;
  return `${head} ${desc}`.trim();
}

// Minimal activity list (admin queue as proxy for recent AI-related activity)
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
function RecentActivity() {
  const fetcher = (u: string) => apiFetch<any[]>(u);
  const { data, error } = useSWR<any[]>("/feature-requests/admin/queue", fetcher);
  if (error) return <div className="text-sm text-red-600">Failed to load activity</div>;
  const items = data || [];
  return (
    <div className="rounded border bg-white">
      <div className="px-3 py-2 border-b text-sm font-medium">Recent Activity</div>
      <ul className="divide-y">
        {items.slice(0, 8).map((it) => (
          <li key={it.id} className="px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="truncate max-w-[14rem]" title={it.title}>{it.title}</span>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{it.status}</span>
            </div>
            {it.prUrl ? (
              <a className="text-xs text-blue-600 underline" href={it.prUrl} target="_blank" rel="noreferrer">PR</a>
            ) : null}
          </li>
        ))}
        {!items.length && <li className="px-3 py-2 text-sm text-gray-500">No recent items</li>}
      </ul>
    </div>
  );
}
