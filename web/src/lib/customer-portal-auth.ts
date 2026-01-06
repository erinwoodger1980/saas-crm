import { apiFetch } from "@/lib/api";

const STORAGE_KEY = "customer_portal_token";

export function getCustomerPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCustomerPortalToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

export function clearCustomerPortalToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function customerPortalFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const token = getCustomerPortalToken();
  if (!token) {
    const error = new Error("Not authenticated");
    (error as any).status = 401;
    throw error;
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return apiFetch<T>(path, {
    ...init,
    headers,
  });
}
