"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/workshop", label: "Workshop" },
  { href: "/reports", label: "Reports" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`border-r bg-white transition-all duration-200 ease-out ${
          collapsed ? "w-[84px]" : "w-[220px]"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            {/* Full logo when expanded */}
            {!collapsed ? (
              <Image
                src="/logo.full.png"
                alt="Joinery AI"
                width={140}
                height={40}
                priority
              />
            ) : (
              // Icon when collapsed
              <Image
                src="/logo-icon.png"
                alt="Joinery AI"
                width={40}
                height={40}
                priority
              />
            )}
          </Link>

          <button
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            onClick={() => setCollapsed((s) => !s)}
            className="rounded-md border px-2 py-1 text-sm hover:bg-slate-50"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="mt-2 px-2">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors
                    ${active ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Optional place for icons in the future */}
                    {collapsed ? (
                      <span className="truncate">{item.label[0]}</span>
                    ) : (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="h-12 flex items-center border-b bg-white px-4 text-sm text-slate-600">
          <span className="font-medium">Joinery AI</span>
          <span className="mx-2">·</span>
          <span>Ask about sales, pipeline, timecards...</span>
          <div className="ml-auto">Account</div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}