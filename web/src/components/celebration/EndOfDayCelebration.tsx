"use client";

export function EndOfDayCelebration({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  function copy() {
    const text = "🎉 You finished today’s focus. Enjoy the clear head.";
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl overflow-hidden">
        {/* soft glow */}
        <div className="pointer-events-none absolute -inset-10 opacity-20 blur-3xl bg-gradient-to-br from-indigo-300 via-emerald-300 to-amber-300" />
        <div className="relative">
          <div className="text-4xl mb-2">✨ Your board is clear. Breathe.</div>
          <p className="text-gray-600 mb-6">You wrapped up everything for today—nice and tidy.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-xl bg-gray-900 text-white px-4 py-2">Dismiss</button>
            <button onClick={copy} className="rounded-xl border px-4 py-2">Copy & Share</button>
          </div>
        </div>
      </div>
    </div>
  );
}