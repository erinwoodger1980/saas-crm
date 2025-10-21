"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "joineryai-cookie-consent";

type ConsentState = "unknown" | "accepted" | "dismissed";

export default function CookieBanner() {
  const [consent, setConsent] = useState<ConsentState>("unknown");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ConsentState | null;
      if (stored) {
        setConsent(stored);
      }
    } catch (error) {
      console.warn("Unable to read cookie consent", error);
    }
  }, []);

  useEffect(() => {
    if (consent === "unknown") return;
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, consent);
    } catch (error) {
      console.warn("Unable to persist cookie consent", error);
    }
  }, [consent]);

  if (consent !== "unknown") return null;

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div>
          <h2 className="text-base font-semibold text-slate-900">We use functional cookies</h2>
          <p className="mt-1 text-sm text-slate-600">
            JoineryAI uses essential cookies so the site works properly. There are no marketing cookies.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setConsent("dismissed")}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => setConsent("accepted")}
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
