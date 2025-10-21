"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useTenantBrand } from "@/lib/use-tenant-brand";

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
  const { brandName, shortName, logoUrl, initials } = useTenantBrand();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={`${brandName} logo`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-slate-600">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-slate-800">{brandName}</div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Workspace</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-3 py-1 font-medium text-slate-600 shadow-sm">
              Hey, <span className="text-slate-800">{shortName || brandName}</span>
            </span>
            <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 font-medium text-slate-500 shadow-sm">v0.1</span>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <div className="mx-auto grid max-w-screen-2xl gap-8 px-6 py-8 md:grid-cols-[260px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="md:sticky md:top-[80px] md:self-start">
          <div className="rounded-2xl border bg-white p-6 shadow-[0_8px_30px_rgba(2,6,23,0.06)]">
            {/* MUCH bigger full logo with hover highlight */}
            <div className="group mb-6 flex justify-center">
              <div className="relative inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-blue-50/40 hover:shadow-[0_12px_30px_-12px_rgba(37,99,235,0.35)] hover:ring-blue-300/60">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={`${brandName} logo`}
                    className="h-28 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02] md:h-[7.5rem]"
                  />
                ) : (
                  <span className="text-2xl font-semibold text-slate-500">{initials}</span>
                )}
              </div>
            </div>

            {/* Nav with subtle hover shadow + highlight */}
            <nav className="space-y-2">
              {nav.map((n) => {
                const active = pathname === n.href || pathname?.startsWith(n.href + "/");
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
