"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { apiFetch, clearJwt } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";

// Footer with key contact details for Wealden Joinery.
export function WealdenFooter() {
  const { user, mutate } = useCurrentUser();
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const estimateHref = pathname?.includes("timber-windows")
    ? "/timber-windows#timber-windows-form"
    : "/wealden-joinery/contact#enquiry-form";

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors; clear local auth state regardless
    } finally {
      clearJwt();
      mutate(null, { revalidate: false });
      setLoggingOut(false);
    }
  };

  return (
    <footer className="mt-24 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-16 md:grid-cols-3 md:px-8">
        <div className="space-y-4">
          <Link href="/wealden-joinery">
            <Image 
              src="/lignum-windows-logo.jpg" 
              alt="Lignum Windows by Wealden Joinery" 
              width={250} 
              height={83}
              className="h-14 w-auto"
            />
          </Link>
          <p className="text-sm leading-relaxed text-slate-600">
            Lignum Windows - Premium timber windows and doors crafted in our Crowborough headquarters. Serving clients nationwide through our network of showrooms.
          </p>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">🏭</span>
              <span>Manufacturing HQ: Rotherfield, East Sussex</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">📞</span>
              <a className="text-emerald-700 hover:underline" href="tel:+441892852544">01892 852544</a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">✉️</span>
              <a className="text-emerald-700 hover:underline" href="mailto:hello@lignumwindows.com">hello@lignumwindows.com</a>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900">Explore</h4>
          <nav className="grid grid-cols-2 gap-3 text-sm text-slate-700">
            {["Windows", "Doors", "Alu-Clad", "Projects", "Choices", "Showrooms", "About", "Contact"].map((item) => (
              <Link key={item} href={`/wealden-joinery/${item.toLowerCase().replace(" ", "-")}`} className="transition-colors hover:text-emerald-700">
                {item}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-900">Visit Us</h4>
          <p className="text-sm leading-relaxed text-slate-600">
            Visit one of our showrooms nationwide to see our products, discuss your project, and explore timber samples and finishes.
          </p>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link
              href="/wealden-joinery/contact"
              className="rounded-full bg-emerald-700 px-5 py-2.5 text-white transition hover:scale-[1.02] hover:bg-emerald-800"
            >
              Book a Consultation
            </Link>
            <Link
              href={estimateHref}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-slate-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Get an Estimate
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 bg-slate-50 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-4 text-center text-xs text-slate-600 md:justify-between md:px-8">
          <div>© {new Date().getFullYear()} Wealden Joinery. All rights reserved. Privacy · Terms · Cookies</div>
          <div className="flex items-center gap-3">
            <Link
              href="/login?next=/timber-windows"
              className="text-slate-500 hover:text-emerald-700"
            >
              Staff login
            </Link>
            {user?.id ? (
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-slate-500 hover:text-emerald-700 disabled:opacity-60"
              >
                {loggingOut ? "Logging out..." : "Log out"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
