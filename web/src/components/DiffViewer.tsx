"use client";
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

// Try to load react-diff-viewer if installed; otherwise fallback to <pre>
const ReactDiffViewer = dynamic(() => import('react-diff-viewer').catch(() => ({ default: null as any })), { ssr: false });

type Props = { diff?: string; diffText?: string };

export default function DiffViewer({ diff, diffText }: Props) {
  const content = diffText ?? diff ?? '';
  const [copied, setCopied] = useState(false);
  const pieces = useMemo(() => splitUnified(content), [content]);

  function copy() {
    navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const canRenderSplit = !!(ReactDiffViewer as any)?.render && pieces;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Unified Diff</h2>
        <button onClick={copy} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded">
          {copied ? 'Copied!' : 'Copy Diff'}
        </button>
      </div>
      {canRenderSplit ? (
        <ReactDiffViewer
          oldValue={pieces.old}
          newValue={pieces.new}
          splitView={true}
          hideLineNumbers={false}
          useDarkTheme={false}
        />
      ) : (
        <pre className="overflow-auto max-h-[60vh] text-xs bg-slate-900 text-slate-100 p-4 rounded border border-slate-700">
{content}
        </pre>
      )}
    </div>
  );
}

function splitUnified(unified: string): { old: string; new: string } {
  if (!unified) return { old: '', new: '' };
  // A very naive split: show entire patch as both sides to enable rendering without parsing;
  // react-diff-viewer will still nicely style +/- lines.
  return { old: unified, new: unified };
}