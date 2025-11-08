"use client";

import { useEffect, useMemo } from "react";

interface DemoModalProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  videoUrl: string;
}

/**
 * DemoModal renders an overlay with an autoplay iframe for a video URL.
 * 'open' prop controls visibility and is read from props parameter.
 */

export default function DemoModal({ open, onOpenChange, videoUrl }: DemoModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
    return undefined;
  }, [open]);

  const iframeSrc = useMemo(() => {
    if (!videoUrl) return "";
    return videoUrl.includes("?") ? `${videoUrl}&autoplay=1` : `${videoUrl}?autoplay=1`;
  }, [videoUrl]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="JoineryAI demo video"
    >
      <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900 p-4 shadow-2xl">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Close
        </button>
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
          {iframeSrc ? (
            <iframe
              src={iframeSrc}
              title="JoineryAI demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/70">
              Demo coming soon
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
