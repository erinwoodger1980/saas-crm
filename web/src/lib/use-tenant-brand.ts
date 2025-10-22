import useSWR from "swr";
import { apiFetch } from "./api";

type TenantSettings = {
  brandName?: string | null;
  logoUrl?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
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
  const ownerFirstName = data?.ownerFirstName?.trim() || null;
  const ownerLastName = data?.ownerLastName?.trim() || null;

  return {
    brandName,
    shortName,
    logoUrl,
    initials,
    ownerFirstName,
    ownerLastName,
    settings: data,
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  };
}
