const REFERRAL_STORAGE_KEY = "joineryai-ref";

export function storeReferral(referral: string) {
  if (!referral || typeof window === "undefined") return;
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, referral);
  } catch (error) {
    console.warn("Unable to store referral", error);
  }
}

export function getStoredReferral(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = localStorage.getItem(REFERRAL_STORAGE_KEY);
    return value ?? undefined;
  } catch (error) {
    console.warn("Unable to read referral", error);
    return undefined;
  }
}

export function appendReferralParam(url: string, referral?: string): string {
  const ref = referral ?? getStoredReferral();
  if (!ref) return url;
  const isAbsolute = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url);
  try {
    const base =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://joineryai.app";
    const target = new URL(url, base);
    target.searchParams.set("ref", ref);
    if (isAbsolute) {
      return target.toString();
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}ref=${encodeURIComponent(ref)}`;
  }
}
