"use client";

import useSWR from "swr";

import { apiFetch, getJwt } from "./api";

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
  const hasJwt = typeof window !== "undefined" ? !!getJwt() : false;

  const { data, error, isValidating } = useSWR<CurrentUser>(
    hasJwt ? "/auth/me" : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    user: data ?? null,
    error,
    isLoading: hasJwt && !data && !error && isValidating,
  };
}
