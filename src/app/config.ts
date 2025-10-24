// Prefer env-based configuration; avoid hard-coding localhost in browser bundles.
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/g, "");
