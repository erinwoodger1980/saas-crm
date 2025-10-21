import useSWR from "swr";
import { apiFetch } from "./api";

type TenantSettings = {
  brandName?: string | null;
  logoUrl?: string | null;
};

function toInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return "--";
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return clean.slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function toShortName(name: string): string {
  const clean = name.trim();
  if (!clean) return "";
  const parts = clean.split(/\s+/);
  return parts[0] ?? clean;
}

export function useTenantBrand() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<TenantSettings>(
    "/tenant/settings",
    (url: string) => apiFetch<TenantSettings>(url),
    { revalidateOnFocus: false }
  );

  const brandName = (data?.brandName || "Your Company").trim() || "Your Company";
  const logoUrl = data?.logoUrl?.trim() || null;
  const initials = toInitials(brandName);
  const shortName = toShortName(brandName);

  return {
    brandName,
    shortName,
    logoUrl,
    initials,
    settings: data,
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}
