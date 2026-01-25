import { ReactNode } from "react";
import { TrackingScripts } from "../_components/tracking";

export default function TimberWindowsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <TrackingScripts />
      <main className="mx-auto max-w-7xl px-4 md:px-8 py-10 md:py-14">
        {children}
      </main>
    </div>
  );
}
