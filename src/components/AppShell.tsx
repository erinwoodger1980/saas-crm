"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Mail, RadioTower, Wrench, LineChart, Bot } from "lucide-react";
import { useCurrentUser } from "@/lib/use-current-user";
import { clearJwt } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Mail },
  { href: "/opportunities", label: "Opportunities", icon: RadioTower },
  { href: "/workshop", label: "Workshop", icon: Wrench },
  { href: "/reports", label: "Reports", icon: LineChart },
  { href: "/dashboard/email-training", label: "AI Training", icon: Bot },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  const firstName = user?.firstName || user?.name?.split(/\s+/)[0] || null;
  const lastName =
    user?.lastName ||
    (user?.name
      ? user.name
          .split(/\s+/)
          .slice(1)
          .join(" ") || null
      : null);

  const initials = (() => {
    const firstInitial = firstName?.[0];
    const lastInitial = lastName?.[0];
    if (firstInitial && lastInitial) return `${firstInitial}${lastInitial}`.toUpperCase();
    if (firstInitial) return firstInitial.toUpperCase();
    if (lastInitial) return lastInitial.toUpperCase();
    if (user?.email) return user.email[0]?.toUpperCase() ?? "?";
    return "?";
  })();

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside className="bg-white border-r">
        <div className="flex items-center px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="Go to dashboard">
            <Image
              src="/joinery-ai-logo.png"
              alt="Joinery AI"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full"
              priority
            />
            <span className="text-base font-semibold text-slate-900">Joinery AI</span>
          </Link>
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
            <DropdownMenuTrigger className="flex items-center gap-3 rounded-md hover:bg-slate-100 px-2 py-1">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-sm font-medium text-slate-900">
                  {firstName || "Account"}
                </span>
                {(lastName || user?.email) && (
                  <span className="text-xs text-slate-500">
                    {lastName || user?.email}
                  </span>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  clearJwt();
                  location.href = "/login";
                }}
              >
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
