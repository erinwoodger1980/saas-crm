"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo, useEffect, useState } from "react";
import clsx from "clsx";
import {
  LayoutDashboard,
  Mail,
  CheckSquare,
  Target,
  Wrench,
  Sparkles,
  Package,
  Flame,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";

import { useTenantBrand } from "@/lib/use-tenant-brand";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import AISearchBar from "@/components/AISearchBar";
import { apiFetch } from "@/lib/api";

const BASE_NAV: Array<{ href: string; label: string; description: string; icon: any }> = [
  { href: "/dashboard", label: "Dashboard", description: "Pulse & KPIs", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", description: "Inbox & replies", icon: Mail },
  { href: "/tasks/center", label: "Tasks", description: "Unified activity hub", icon: CheckSquare },
  { href: "/opportunities", label: "Opportunities", description: "Quotes to win", icon: Target },
  // Quotes moved under AI Training; keep out of main nav
  { href: "/workshop", label: "Workshop", description: "Production board", icon: Wrench },
  { href: "/supplier-requests", label: "Outsourcing", description: "Supplier quotes", icon: Package },
] as Array<{ href: string; label: string; description: string; icon: any }>;

const FEEDBACK_ROLES = new Set(["owner", "admin", "manager", "product", "developer"]);

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { brandName, shortName, logoUrl, initials, ownerFirstName, ownerLastName } = useTenantBrand();
  const { user } = useCurrentUser();
  const [isFireDoorManufacturer, setIsFireDoorManufacturer] = useState(false);
  const [isGroupCoachingMember, setIsGroupCoachingMember] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load sidebar state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setSidebarCollapsed(saved === "true");
  }, []);

  // Toggle sidebar and save state
  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", String(newState));
  };

  // Fetch fire door manufacturer flag, group coaching flag, and tenant slug
  useEffect(() => {
    apiFetch<{ isFireDoorManufacturer?: boolean; isGroupCoachingMember?: boolean; slug?: string }>("/tenant/settings")
      .then((data) => {
        console.log("[AppShell] Fire door flag from API:", data?.isFireDoorManufacturer);
        console.log("[AppShell] Group coaching flag from API:", data?.isGroupCoachingMember);
        setIsFireDoorManufacturer(Boolean(data?.isFireDoorManufacturer));
        setIsGroupCoachingMember(Boolean(data?.isGroupCoachingMember));
        setTenantSlug(data?.slug || "");
      })
      .catch((error) => {
        console.error("[AppShell] Failed to fetch settings:", error);
      });

    // Listen for settings updates
    const handleTenantSettingsUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ isFireDoorManufacturer?: boolean; isGroupCoachingMember?: boolean }>).detail;
      console.log("[AppShell] Received tenant-settings:updated event:", detail);
      if (detail && Object.prototype.hasOwnProperty.call(detail, "isFireDoorManufacturer")) {
        console.log("[AppShell] Updating fire door flag to:", detail.isFireDoorManufacturer);
        setIsFireDoorManufacturer(Boolean(detail.isFireDoorManufacturer));
      }
      if (detail && Object.prototype.hasOwnProperty.call(detail, "isGroupCoachingMember")) {
        console.log("[AppShell] Updating group coaching flag to:", detail.isGroupCoachingMember);
        setIsGroupCoachingMember(Boolean(detail.isGroupCoachingMember));
      }
    };

    window.addEventListener("tenant-settings:updated", handleTenantSettingsUpdate as EventListener);
    return () => {
      window.removeEventListener("tenant-settings:updated", handleTenantSettingsUpdate as EventListener);
    };
  }, []);

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
  const greetingName = userFirstName || ownerDisplayName || shortName || brandName;

  return (
    <div className="relative min-h-screen bg-slate-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_70%)]"
      />

      {/* Top header (was sticky; now scrolls with content) */}
      <header className="relative z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[36px] border border-slate-200/80 bg-white shadow-[0_30px_60px_-36px_rgba(15,23,42,0.65)]">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={`${brandName} logo`}
                    className="h-full w-full object-contain p-3"
                  />
                ) : (
                  <div className="text-2xl font-bold text-slate-600">{initials}</div>
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
              {(user?.isEarlyAdopter || user?.isDeveloper) && (
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
      <div className={`relative mx-auto grid w-full gap-8 px-6 py-10 transition-all duration-300 ${sidebarCollapsed ? 'lg:grid-cols-[80px_minmax(0,1fr)]' : 'lg:grid-cols-[280px_minmax(0,1fr)]'}`}>
        <aside className="md:sticky md:top-[160px] md:self-start relative">
          {/* Toggle button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="absolute -right-3 top-6 z-20 h-7 w-7 rounded-full border border-slate-200 bg-white shadow-lg p-0 hover:bg-slate-50 hover:shadow-xl transition-all"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.45)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-32 left-1/2 h-48 w-[160%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_70%)]"
            />
            <div className={`relative transition-all duration-300 ${sidebarCollapsed ? 'p-3' : 'p-6'}`}>
              {!sidebarCollapsed && (
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
              )}

              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={sidebarCollapsed ? `${item.label} - ${item.description}` : undefined}
                      className={clsx(
                        "group relative flex items-center overflow-hidden rounded-2xl text-sm transition-all",
                        sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                        active
                          ? "bg-slate-900 text-white shadow-[0_22px_45px_-30px_rgba(15,23,42,0.9)] ring-1 ring-slate-900/70"
                          : "bg-white/90 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300"
                      )}
                    >
                      <span
                        className={clsx(
                          "flex items-center justify-center rounded-xl text-slate-500 transition-colors",
                          sidebarCollapsed ? "h-8 w-8" : "h-9 w-9",
                          active
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 group-hover:bg-slate-200 group-hover:text-slate-900"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </span>
                      {!sidebarCollapsed && (
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold">{item.label}</span>
                          <span className="text-xs text-slate-400">{item.description}</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
                
                {/* Fire Door Calculator - only for fire door manufacturers */}
                {isFireDoorManufacturer && (
                  <>
                    <Link
                      href="/fire-door-calculator"
                      title={sidebarCollapsed ? "Fire Door Calculator - Pricing tool" : undefined}
                      className={clsx(
                        "group relative flex items-center overflow-hidden rounded-2xl text-sm transition-all",
                        sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                        pathname === "/fire-door-calculator" || pathname?.startsWith("/fire-door-calculator/")
                          ? "bg-slate-900 text-white shadow-[0_22px_45px_-30px_rgba(15,23,42,0.9)] ring-1 ring-slate-900/70"
                          : "bg-white/90 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300"
                      )}
                    >
                      <span
                        className={clsx(
                          "flex items-center justify-center rounded-xl text-slate-500 transition-colors",
                          sidebarCollapsed ? "h-8 w-8" : "h-9 w-9",
                          pathname === "/fire-door-calculator" || pathname?.startsWith("/fire-door-calculator/")
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 group-hover:bg-slate-200 group-hover:text-slate-900"
                        )}
                      >
                        <Flame className="h-4 w-4" />
                      </span>
                      {!sidebarCollapsed && (
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold">Fire Door Calculator</span>
                          <span className="text-xs text-slate-400">Pricing tool</span>
                        </span>
                      )}
                    </Link>
                    
                    <Link
                      href="/fire-door-schedule"
                      title={sidebarCollapsed ? "Fire Door Schedule - Project tracking" : undefined}
                      className={clsx(
                        "group relative flex items-center overflow-hidden rounded-2xl text-sm transition-all",
                        sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                        pathname === "/fire-door-schedule" || pathname?.startsWith("/fire-door-schedule/")
                          ? "bg-slate-900 text-white shadow-[0_22px_45px_-30px_rgba(15,23,42,0.9)] ring-1 ring-slate-900/70"
                          : "bg-white/90 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300"
                      )}
                    >
                      <span
                        className={clsx(
                          "flex items-center justify-center rounded-xl text-slate-500 transition-colors",
                          sidebarCollapsed ? "h-8 w-8" : "h-9 w-9",
                          pathname === "/fire-door-schedule" || pathname?.startsWith("/fire-door-schedule/")
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 group-hover:bg-slate-200 group-hover:text-slate-900"
                        )}
                      >
                        <Calendar className="h-4 w-4" />
                      </span>
                      {!sidebarCollapsed && (
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold">Fire Door Schedule</span>
                          <span className="text-xs text-slate-400">Project tracking</span>
                        </span>
                      )}
                    </Link>
                    
                    <a
                      href={tenantSlug ? `/public/fire-doors/${tenantSlug}/new-job` : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={sidebarCollapsed ? "Client Portal - Open customer submission form" : undefined}
                      className={clsx(
                        "group relative flex items-center overflow-hidden rounded-2xl text-sm transition-all",
                        sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                        "bg-white/90 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300",
                        !tenantSlug && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={(e) => {
                        if (!tenantSlug) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <span
                        className={clsx(
                          "flex items-center justify-center rounded-xl text-slate-500 transition-colors",
                          sidebarCollapsed ? "h-8 w-8" : "h-9 w-9",
                          "bg-slate-100 group-hover:bg-slate-200 group-hover:text-slate-900"
                        )}
                      >
                        <Users className="h-4 w-4" />
                      </span>
                      {!sidebarCollapsed && (
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold">Client Portal</span>
                          <span className="text-xs text-slate-400">Customer quote form</span>
                        </span>
                      )}
                    </a>
                  </>
                )}
                
                {/* Coaching Hub - show when Coaching is enabled for tenant */}
                {isGroupCoachingMember && (
                  <Link
                    href="/coaching"
                    title={sidebarCollapsed ? "Coaching Hub - Goals, notes & financials" : undefined}
                    className={clsx(
                      "group relative flex items-center overflow-hidden rounded-2xl text-sm transition-all",
                      sidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                      pathname === "/coaching" || pathname?.startsWith("/coaching/")
                        ? "bg-slate-900 text-white shadow-[0_22px_45px_-30px_rgba(15,23,42,0.9)] ring-1 ring-slate-900/70"
                        : "bg-white/90 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300"
                    )}
                  >
                    <span
                      className={clsx(
                        "flex items-center justify-center rounded-xl text-slate-500 transition-colors",
                        sidebarCollapsed ? "h-8 w-8" : "h-9 w-9",
                        pathname === "/coaching" || pathname?.startsWith("/coaching/")
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 group-hover:bg-slate-200 group-hover:text-slate-900"
                      )}
                    >
                      <Target className="h-4 w-4" />
                    </span>
                    {!sidebarCollapsed && (
                      <span className="flex flex-col leading-tight">
                        <span className="font-semibold">Coaching Hub</span>
                        <span className="text-xs text-slate-400">Goals, notes & financials</span>
                      </span>
                    )}
                  </Link>
                )}
              </nav>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  );
}
