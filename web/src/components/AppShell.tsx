"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Mail, RadioTower, Wrench, LineChart, Code, Flame } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Mail },
  { href: "/opportunities", label: "Opportunities", icon: RadioTower },
  { href: "/workshop", label: "Workshop", icon: Wrench },
  { href: "/settings", label: "Settings", icon: LineChart },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedTenant, setImpersonatedTenant] = useState<string | null>(null);
  const [isFireDoorManufacturer, setIsFireDoorManufacturer] = useState(false);

  // Debug log whenever fire door flag changes
  useEffect(() => {
    console.log("[AppShell] Fire Door Manufacturer state changed to:", isFireDoorManufacturer);
  }, [isFireDoorManufacturer]);

  useEffect(() => {
    // Check if user has developer access
    apiFetch<{ ok: boolean }>("/dev/stats")
      .then(() => setIsDeveloper(true))
      .catch(() => setIsDeveloper(false));

    // Check if we're impersonating by reading the JWT token
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('jauth='))
      ?.split('=')[1];
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.impersonating) {
          setIsImpersonating(true);
          // Optionally fetch tenant name
          if (payload.tenantId) {
            apiFetch<any>(`/dev/tenants/${payload.tenantId}`)
              .then(data => {
                if (data.ok && data.tenant) {
                  setImpersonatedTenant(data.tenant.name);
                }
              })
              .catch(() => {});
          }
        }
      } catch (e) {
        // Invalid token format, ignore
      }
    }

    // Fetch tenant settings to check for fire door manufacturer flag
    apiFetch<{ isFireDoorManufacturer?: boolean }>("/tenant/settings")
      .then((data) => {
        console.log("[AppShell] Fire door flag from API:", data?.isFireDoorManufacturer);
        setIsFireDoorManufacturer(Boolean(data?.isFireDoorManufacturer));
      })
      .catch((error) => {
        console.error("[AppShell] Failed to fetch settings:", error);
        // Failed to fetch settings, default to false
      });
    const handleTenantSettingsUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ isFireDoorManufacturer?: boolean }>).detail;
      console.log("[AppShell] Received tenant-settings:updated event:", detail);
      if (detail && Object.prototype.hasOwnProperty.call(detail, "isFireDoorManufacturer")) {
        console.log("[AppShell] Updating fire door flag to:", detail.isFireDoorManufacturer);
        setIsFireDoorManufacturer(Boolean(detail.isFireDoorManufacturer));
      }
    };

    window.addEventListener("tenant-settings:updated", handleTenantSettingsUpdate as EventListener);
    return () => {
      window.removeEventListener("tenant-settings:updated", handleTenantSettingsUpdate as EventListener);
    };
  }, []);

  function exitImpersonation() {
    // Clear the impersonation session
    document.cookie = 'jauth=; path=/; max-age=0';
    window.location.href = '/dev';
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      {/* Sidebar */}
      <aside className="bg-white border-r">
        <div className="flex items-center gap-2 px-5 py-4">
          <Image
            src="/logo-full.png"  // put your Joinery AI logo in /web/public/logo-full.png
            alt="Joinery AI Logo"
            width={32}
            height={32}
            className="shrink-0"
          />
          <span className="text-xl font-semibold tracking-tight">
            <span className="text-[rgb(var(--brand))]">Joinery</span> AI
          </span>
        </div>
        <Separator />
        <nav className="p-2 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href) && href === pathname;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                  active
                    ? "bg-[rgb(var(--brand))]/10 text-[rgb(var(--brand))] font-medium"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
          
          {/* Fire Door Calculator - only for fire door manufacturers */}
          {isFireDoorManufacturer && (
            <Link
              href="/fire-door-calculator"
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                pathname?.startsWith("/fire-door-calculator")
                  ? "bg-[rgb(var(--brand))]/10 text-[rgb(var(--brand))] font-medium"
                  : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <Flame size={16} />
              Fire Door Calculator
            </Link>
          )}
        </nav>

        {/* Developer Section */}
        {isDeveloper && (
          <>
            <Separator className="my-2" />
            <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Developer
            </div>
            <nav className="p-2 space-y-1">
              <Link
                href="/dev"
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                  pathname?.startsWith("/dev")
                    ? "bg-purple-100 text-purple-700 font-medium"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <Code size={16} />
                Dev Dashboard
              </Link>
            </nav>
          </>
        )}
      </aside>

      {/* Main */}
      <div className="flex flex-col">
        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-purple-600 text-white px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">🔐 Developer Mode</span>
              <span>•</span>
              <span>
                Logged in as: <strong>{impersonatedTenant || "Tenant User"}</strong>
              </span>
            </div>
            <button
              onClick={exitImpersonation}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded"
            >
              Exit & Return to Dev Dashboard
            </button>
          </div>
        )}
        
        <header className="h-14 bg-white border-b flex items-center justify-between px-4">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-[rgb(var(--brand))]">Joinery AI</span> · Ask about sales, pipeline, timecards…
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-md hover:bg-slate-100 px-2 py-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <span className="text-sm text-slate-700">Account</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  localStorage.removeItem("jwt");
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
