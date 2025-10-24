"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

import { JWT_EVENT_NAME, apiFetch, getJwt, clearJwt } from "./api";

export type CurrentUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isEarlyAdopter?: boolean | null;
};

const fetcher = (path: string) => apiFetch<CurrentUser>(path);

export function useCurrentUser() {
  // Maintain legacy JWT for any older flows; cookie-first will still succeed without it
  const [jwt, setStoredJwt] = useState<string | null>(() =>
    typeof window !== "undefined" ? getJwt() : null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncJwt = () => setStoredJwt(getJwt());

    const handleJwtEvent = (event: Event) => {
      const custom = event as CustomEvent<{ token?: string | null }>;
      const token = custom?.detail?.token ?? null;
      setStoredJwt(token ?? getJwt());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "jwt") setStoredJwt(event.newValue);
    };

    syncJwt();
    window.addEventListener(JWT_EVENT_NAME, handleJwtEvent as EventListener);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(JWT_EVENT_NAME, handleJwtEvent as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Always attempt /auth/me to support HttpOnly cookie auth
  const { data, error, isValidating, mutate } = useSWR<CurrentUser>(
    "/auth/me",
    fetcher,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    const status = (error as any)?.status ?? (error as any)?.response?.status;
    if (status === 401) {
      clearJwt();
      setStoredJwt(null);
    }
  }, [error]);

  return {
    user: data ?? null,
    error,
    isLoading: !data && !error && isValidating,
    mutate,
  };
}
