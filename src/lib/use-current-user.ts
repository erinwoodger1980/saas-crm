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
  const [jwt, setJwt] = useState<string | null>(() => (typeof window !== "undefined" ? getJwt() : null));

  const { data, error, isValidating, mutate } = useSWR<CurrentUser>(
    hasJwt ? "/auth/me" : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    const status = (error as any)?.status;
    if (status === 401) {
      clearJwt();
      setJwt(null);
    }
  }, [error]);

  return {
    user: data ?? null,
    error,
    isLoading: hasJwt && !data && !error && isValidating,
    mutate,
  };
}
