"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "joineryai-cookie-consent";

type ConsentValue = "accepted" | "dismissed";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const value = localStorage.getItem(STORAGE_KEY) as ConsentValue | null;
      if (!value) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const store = (value: ConsentValue) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      console.warn("Unable to persist cookie preference", error);
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="space-y-1 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Cookies for functionality only</p>
          <p>
            We use functional cookies to keep you signed in and remember preferences. No ad
            tracking or unnecessary scripts.
          </p>
        </div>
        <div className="mt-4 flex flex-shrink-0 gap-2 sm:mt-0">
          <button
            type="button"
            onClick={() => store("dismissed")}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => store("accepted")}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
