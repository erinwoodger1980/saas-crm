export function appendReferralParam(url: string, code?: string) {
  if (!code) return url;
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    u.searchParams.set('ref', code);
    return u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

export function storeReferral(code: string) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('referral', code);
    }
  } catch {}
}

export function getStoredReferral(): string | null {
  try {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('referral');
    }
  } catch {}
  return null;
}
