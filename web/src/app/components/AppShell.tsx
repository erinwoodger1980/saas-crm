"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard", emoji: "🧭" },
  { href: "/leads", label: "Leads", emoji: "📬" },
  { href: "/tasks/owner", label: "Tasks", emoji: "✅" },
  { href: "/opportunities", label: "Opportunities", emoji: "🎯" },
  { href: "/workshop", label: "Workshop", emoji: "🛠️" },
  { href: "/settings", label: "Settings", emoji: "⚙️" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
        <div className="px-6 h-16 flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            {/* Use icon in header, ensure no squashing */}
            <img
              src="/logo-icon.png"
              alt="Joinery AI"
              className="h-8 w-auto object-contain rounded-md shadow-sm"
            />
            <span className="font-semibold tracking-tight text-lg text-slate-700">
              Joinery&nbsp;AI
            </span>
          </div>
          <div className="text-xs text-slate-500 pr-1">v0.1</div>
        </div>
      </header>

      {/* Main grid */}
      <div className="px-6 py-8 grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-8 max-w-screen-2xl mx-auto">
        {/* Sidebar */}
        <aside className="md:sticky md:top-[80px] md:self-start">
          <div className="rounded-2xl border bg-white shadow-[0_8px_30px_rgba(2,6,23,0.06)] p-6">
            {/* MUCH bigger full logo with hover highlight */}
            <div className="group mb-6 flex justify-center">
              <div className="relative inline-flex items-center justify-center rounded-xl transition-all duration-300 ring-1 ring-slate-200/70 bg-white px-3 py-2
                              hover:ring-blue-300/60 hover:bg-blue-50/40 hover:shadow-[0_12px_30px_-12px_rgba(37,99,235,0.35)]">
                <img
                  src="/logo-full.png"
                  alt="Joinery AI"
                  className="h-28 md:h-[7.5rem] w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
            </div>

            {/* Nav with subtle hover shadow + highlight */}
            <nav className="space-y-2">
              {nav.map((n) => {
                const active =
                  pathname === n.href || pathname?.startsWith(n.href + "/");
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={[
                      "flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-all",
                      "ring-1",
                      active
                        ? "bg-slate-900 text-white ring-slate-900 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.45)]"
                        : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:shadow-[0_8px_24px_-14px_rgba(2,6,23,0.35)]",
                    ].join(" ")}
                  >
                    <span className="text-lg">{n.emoji}</span>
                    <span>{n.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content area */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}