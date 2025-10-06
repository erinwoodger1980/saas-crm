"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Mail, RadioTower, Wrench, LineChart } from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Mail },
  { href: "/opportunities", label: "Opportunities", icon: RadioTower },
  { href: "/workshop", label: "Workshop", icon: Wrench },
  { href: "/reports", label: "Reports", icon: LineChart },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside className="bg-white border-r">
        <div className="px-5 py-4 text-xl font-semibold tracking-tight">
          <span className="text-[rgb(var(--brand))]">Joinery</span> AI
        </div>
        <Separator />
        <nav className="p-2 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm
                  ${active
                    ? "bg-[rgb(var(--brand))]/10 text-[rgb(var(--brand))] font-medium"
                    : "hover:bg-slate-100 text-slate-700"}`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-col">
        <header className="h-14 bg-white border-b flex items-center justify-between px-4">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-[rgb(var(--brand))]">Joinery AI</span> · Ask about sales, pipeline, timecards…
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-md hover:bg-slate-100 px-2 py-1">
              <Avatar className="h-8 w-8"><AvatarFallback>U</AvatarFallback></Avatar>
              <span className="text-sm text-slate-700">Account</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { localStorage.removeItem("jwt"); location.href="/login"; }}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
