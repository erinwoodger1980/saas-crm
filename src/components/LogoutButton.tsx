"use client";

import { clearJwt } from "@/lib/api";

export default function LogoutButton() {
  return (
    <button
      onClick={() => {
        clearJwt();
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
      }}
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
      aria-label="Log out"
      title="Log out"
    >
      Logout
    </button>
  );
}
