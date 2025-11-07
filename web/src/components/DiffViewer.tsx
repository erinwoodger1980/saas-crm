"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const ReactDiffViewer = dynamic(() => import("react-diff-viewer"), { ssr: false });

interface DiffViewerProps {
  diffText?: string | null;
  className?: string;
}

export function DiffViewer({ diffText, className }: DiffViewerProps) {
  const [copied, setCopied] = useState(false);
  const value = diffText ?? "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!value.trim()) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground">No diff available.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Proposed patch</h3>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border px-3 py-1 text-xs font-medium hover:bg-muted"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="border rounded bg-card p-2 max-h-[60vh] overflow-auto">
        <ReactDiffViewer
          oldValue=""
          newValue={value}
          splitView={false}
          useDarkTheme={false}
          showDiffOnly={false}
        />
      </div>
    </div>
  );
}

export default DiffViewer;
