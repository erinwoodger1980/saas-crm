"use client";
import { useMemo, useState } from 'react';
import DiffViewer from '@/components/DiffViewer';
import RunStatus from '@/components/RunStatus';
import { adminFeatureApprove, adminFeatureReject, adminFeatureRunAi, runCodex, startAutoLoop, getLoopStatus } from '@/lib/api';

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
  const [loopSessionId, setLoopSessionId] = useState<string | null>(null);
  const [loopStatus, setLoopStatus] = useState<any | null>(null);
  const [loopPolling, setLoopPolling] = useState<boolean>(false);

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

  async function startLoop() {
    if (!desc.trim()) return;
    try {
      setLoopPolling(true);
      const start = await startAutoLoop({ taskKey: template, description: desc, files: featureId ? [featureId] : undefined, mode: 'pr', maxRounds: 3 });
      setLoopSessionId(start.sessionId);
      pollLoop(start.sessionId);
    } catch (e: any) {
      setLogs([e?.message || String(e)]);
      setLoopPolling(false);
    }
  }

  async function pollLoop(id: string) {
    let active = true;
    const tick = async () => {
      if (!active) return;
      try {
        const s = await getLoopStatus(id);
        setLoopStatus(s);
        if (['READY','FAILED'].includes(s.status)) {
          setLoopPolling(false);
          return;
        }
      } catch (e) {
        // swallow
      } finally {
        if (active) setTimeout(tick, 2000);
      }
    };
    tick();
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

          <div className="flex gap-3 flex-wrap">
            <button onClick={onApprove} disabled={!canApprove} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">Approve</button>
            <button onClick={onReject} className="px-4 py-2 bg-red-600 text-white rounded">Reject</button>
            <button
              onClick={startLoop}
              disabled={loopPolling}
              className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
            >{loopPolling ? 'Loop Running…' : 'Start Auto Loop'}</button>
          </div>
        </div>

        <aside className="lg:col-span-1 space-y-4">
          <RunStatus status={status} logs={logs} prUrl={prUrl || undefined} previewUrl={null} />
          {branch && (
            <div className="text-xs text-gray-600">Branch: <span className="font-mono">{branch}</span></div>
          )}
          {loopSessionId && (
            <LoopStatusPanel status={loopStatus} sessionId={loopSessionId} />
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

function LoopStatusPanel({ status, sessionId }: { status: any; sessionId: string }) {
  if (!status) return (
    <div className="rounded border bg-white p-3 text-sm">
      <div className="font-medium mb-1">Auto Loop</div>
      <p className="text-xs text-gray-500">Starting…</p>
    </div>
  );
  return (
    <div className="rounded border bg-white p-3 text-sm space-y-1">
      <div className="flex justify-between items-center">
        <div className="font-medium">Auto Loop</div>
        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{status.status}</span>
      </div>
      <div className="text-xs font-mono">Round {status.rounds} / {status.maxRounds}</div>
      {status.branch && <div className="text-xs">Branch: <span className="font-mono">{status.branch}</span></div>}
      {status.prUrl && <a href={status.prUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">PR Link</a>}
      <div className="text-xs">Usage: in {status.usageInput} / out {status.usageOutput} tokens</div>
      <div className="text-xs">Cost: ${status.costUsd?.toFixed(4)}</div>
      {status.logs && <details className="text-xs"><summary className="cursor-pointer">Logs</summary><pre className="whitespace-pre-wrap max-h-48 overflow-auto">{status.logs}</pre></details>}
      {status.patchText && <details className="text-xs"><summary className="cursor-pointer">Patch</summary><pre className="whitespace-pre-wrap max-h-48 overflow-auto">{status.patchText.slice(0,8000)}</pre></details>}
      <div className="text-[10px] text-gray-400">Session: {sessionId}</div>
    </div>
  );
}

async function startLoop(this: any) { /* placeholder to satisfy TS until reassigned */ }

