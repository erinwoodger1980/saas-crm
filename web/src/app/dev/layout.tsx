"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Code, Database, MessageSquare, GitBranch, Server, ArrowLeft, Users } from "lucide-react";

export default function DevLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedTenant, setImpersonatedTenant] = useState<string | null>(null);

  useEffect(() => {
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
          setImpersonatedTenant(payload.tenantName || "Tenant");
        }
      } catch (e) {
        // Invalid token format, ignore
      }
    }
  }, []);

  function exitImpersonation() {
    // Clear ALL auth tokens
    localStorage.removeItem("jwt");
    document.cookie = 'jauth=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'jid=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'jwt=; path=/; max-age=0; SameSite=Lax';
    window.location.href = '/dev';
  }

  function logout() {
    document.cookie = 'jauth=; path=/; max-age=0';
    localStorage.removeItem("jwt");
    window.location.href = "/login";
  }

  const devNav = [
    { href: "/dev", label: "Dashboard", icon: Code },
    { href: "/dev/tenants", label: "Tenants", icon: Database },
    { href: "/dev/feedback", label: "Feedback", icon: MessageSquare },
    { href: "/dev/tasks", label: "Tasks", icon: GitBranch },
    { href: "/dev/ml", label: "ML Status", icon: Server },
    { href: "/dev/ml/samples", label: "ML Samples", icon: Server },
    { href: "/dev/developers", label: "Developers", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-purple-600 text-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">🔐 Developer Mode</span>
            <span>•</span>
            <span>
              Impersonating: <strong>{impersonatedTenant}</strong>
            </span>
          </div>
          <button
            onClick={exitImpersonation}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded transition"
          >
            Exit Impersonation
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back to App</span>
              </Link>
              <div className="h-6 w-px bg-white/20"></div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Code className="w-6 h-6 text-purple-400" />
                Developer Console
              </h1>
            </div>
            <Button
              variant="ghost"
              onClick={logout}
              className="text-white hover:bg-white/10"
            >
              Logout
            </Button>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-2">
            {devNav.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== "/dev" && pathname?.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-slate-900"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}
