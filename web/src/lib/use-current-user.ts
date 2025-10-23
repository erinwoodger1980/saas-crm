"use client";

import { useEffect } from "react";
import useSWR from "swr";

import { JWT_EVENT_NAME, apiFetch, clearJwt } from "./api";

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
  const { data, error, isValidating, mutate } = useSWR<CurrentUser>("/auth/me", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const trigger = () => {
      void mutate();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "jwt") {
        void mutate();
      }
    };

    window.addEventListener(JWT_EVENT_NAME, trigger as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(JWT_EVENT_NAME, trigger as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [mutate]);

  useEffect(() => {
    const status = (error as any)?.status ?? (error as any)?.response?.status;
    if (status === 401) {
      clearJwt({ skipServer: true });
    }
  }, [error]);

  return {
    user: data ?? null,
    error,
    isLoading: !data && !error && isValidating,
    mutate,
  };
}
