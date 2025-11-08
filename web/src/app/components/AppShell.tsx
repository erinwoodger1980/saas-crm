"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo } from "react";
import clsx from "clsx";
import {
  LayoutDashboard,
  Mail,
  CheckSquare,
  Target,
  Wrench,
  Sparkles,
  ArrowRight,
} from "lucide-react";

import { useTenantBrand } from "@/lib/use-tenant-brand";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import AISearchBar from "@/components/AISearchBar";

const BASE_NAV: Array<{ href: string; label: string; description: string; icon: any }> = [
  { href: "/dashboard", label: "Dashboard", description: "Pulse & KPIs", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", description: "Inbox & replies", icon: Mail },
  { href: "/tasks/owner", label: "Tasks", description: "Personal queue", icon: CheckSquare },
  { href: "/opportunities", label: "Opportunities", description: "Quotes to win", icon: Target },
  // Quotes moved under AI Training; keep out of main nav
  { href: "/workshop", label: "Workshop", description: "Production board", icon: Wrench },
] as Array<{ href: string; label: string; description: string; icon: any }>;

const FEEDBACK_ROLES = new Set(["owner", "admin", "manager", "product", "developer"]);

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { brandName, shortName, logoUrl, initials, ownerFirstName, ownerLastName } = useTenantBrand();
  const { user } = useCurrentUser();

  const navItems = useMemo(() => {
    const items = [...BASE_NAV];
    const roleKey = (user?.role || "").toLowerCase();
    if (roleKey && FEEDBACK_ROLES.has(roleKey)) {
      if (!items.some((item) => item.href === "/feedback")) {
        items.push({
          href: "/feedback",
          label: "Feedback",
          description: "Early access notes",
          icon: Sparkles,
        });
      }
    }
    return items;
  }, [user]);

  const userFirstName = user?.firstName?.trim() || null;
  const userLastName = user?.lastName?.trim() || null;
  const ownerDisplayName = [ownerFirstName, ownerLastName].filter(Boolean).join(" ").trim();
  const userDisplayName = [userFirstName, userLastName].filter(Boolean).join(" ").trim();
  const greetingName = ownerDisplayName || userFirstName || userDisplayName || shortName || brandName;

  return (
    <div className="relative min-h-screen bg-slate-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_70%)]"
      />

      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[36px] border border-slate-200/80 bg-white shadow-[0_30px_60px_-36px_rgba(15,23,42,0.65)]">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={`${brandName} logo`}
                    fill
                    className="object-cover"
                    sizes="96px"
                    priority
                    unoptimized
                  />
                ) : (
                  <span className="text-2xl font-semibold text-slate-700">{initials}</span>
                )}
              </div>
              <span className="absolute -bottom-2 -right-2 rounded-full border border-white bg-emerald-500 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white shadow-sm">
                Live
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.45em] text-slate-400">JoineryAI</p>
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">{brandName}</span>
                <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 sm:inline-flex">
                  <Sparkles className="h-3 w-3" />
                  Flow
                </span>
              </div>
            </div>
          </div>

          {/* AI Search Bar */}
          <div className="flex-1 max-w-2xl mx-8">
            <AISearchBar />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-medium text-slate-500 shadow-sm">
                Hey, <span className="text-slate-700">{greetingName}</span>
              </span>
              {user?.isEarlyAdopter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700 shadow-sm">
                  Early access
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-full border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Link href="/settings">Settings</Link>
              </Button>
              {user?.isEarlyAdopter && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="rounded-full border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Link href="/settings/ai-training">AI training</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <div className="relative mx-auto grid max-w-screen-2xl gap-8 px-6 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="md:sticky md:top-[160px] md:self-start">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.45)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-32 left-1/2 h-48 w-[160%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_70%)]"
            />
            <div className="relative p-6">
              <div className="mb-6 flex items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm">
                <Image
                  src="/logo-full.png"
                  alt={`${brandName} full logo`}
                  width={480}
                  height={128}
                  className="h-32 w-auto"
                  priority
                />
              </div>

              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-sm transition-all",
                        active
                          ? "bg-slate-900 text-white shadow-[0_22px_45px_-30px_rgba(15,23,42,0.9)] ring-1 ring-slate-900/70"
                          : "bg-white/90 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300"
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors",
                          active
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 group-hover:bg-slate-200 group-hover:text-slate-900"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="flex flex-col leading-tight">
                        <span className="font-semibold">{item.label}</span>
                        <span className="text-xs text-slate-400">{item.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </nav>

              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Need a quick win?</p>
                <p className="mt-1 text-xs text-slate-500">Drop into My Tasks to see what’s next for the team.</p>
                <Link
                  href="/tasks/owner"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800"
                >
                  Open tasks
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  );
}
