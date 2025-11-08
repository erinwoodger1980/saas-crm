"use client";
import React from 'react';

type Status = "idle" | "running" | "ready" | "approved" | "failed";

export function RunStatus({ status = "idle", logs = [], prUrl, previewUrl }: {
  status?: Status;
  logs?: string[];
  prUrl?: string | null;
  previewUrl?: string | null;
}) {
  const badge = (
    <span className={badgeClass(status)}>
      {status.toUpperCase()}
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {badge}
        {prUrl ? <a className="text-blue-600 underline" href={prUrl} target="_blank" rel="noreferrer">GitHub PR</a> : null}
        {previewUrl ? <a className="text-blue-600 underline" href={previewUrl} target="_blank" rel="noreferrer">Preview</a> : null}
      </div>
      {logs?.length ? (
        <div className="rounded border bg-white">
          <div className="px-3 py-2 border-b text-sm font-medium">Logs</div>
          <pre className="text-xs p-3 whitespace-pre-wrap">
{logs.join('\n')}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function badgeClass(status: Status) {
  const base = "inline-flex items-center text-xs font-semibold px-2 py-1 rounded";
  switch (status) {
    case "running": return base + " bg-yellow-100 text-yellow-700";
    case "ready": return base + " bg-blue-100 text-blue-700";
    case "approved": return base + " bg-green-100 text-green-700";
    case "failed": return base + " bg-red-100 text-red-700";
    case "idle":
    default: return base + " bg-gray-100 text-gray-700";
  }
}

export default RunStatus;
