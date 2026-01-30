import { ReactNode } from "react";
import { TrackingScripts } from "../_components/tracking";

export default function TimberDoorsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <TrackingScripts />
      <main className="mx-auto max-w-7xl px-4 pt-8 pb-10 md:px-8 md:pt-10 md:pb-14">
        {children}
      </main>
    </div>
  );
}
