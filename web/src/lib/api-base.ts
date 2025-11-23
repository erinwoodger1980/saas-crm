// Central API base resolution.
// In development we fall back to localhost if NEXT_PUBLIC_API_BASE is unset.
// In production builds we throw early to avoid silently pointing at localhost.
/**
 * Resolve API base URL in a resilient way for both public and internal pages.
 * Precedence:
 * 1. NEXT_PUBLIC_API_BASE (explicit full base) 
 * 2. NEXT_PUBLIC_API_URL (legacy name used elsewhere) 
 * 3. window.location.origin + '/api' in browser (supports same-origin deployments)
 * 4. http://localhost:4000 in development only
 * If nothing can be resolved in production, we return an empty string so fetch callers
 * can still use relative paths or handle error gracefully without crashing the whole app.
 */
export function getApiBase() {
  const base = (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (base) return base.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    // Same-origin fallback – assume Next.js API routes or reverse proxy at /api
    return (window.location.origin || '').replace(/\/$/, '') + '/api';
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:4000';
  }
  // Production hard fallback: empty string (callers should prepend manually or fail gracefully)
  console.warn('[api-base] No public API base env vars set; using empty string fallback');
  return '';
}

export const API_BASE = getApiBase();