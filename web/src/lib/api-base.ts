// Central API base resolution.
// In development we fall back to localhost if NEXT_PUBLIC_API_BASE is unset.
// In production builds we throw early to avoid silently pointing at localhost.
/**
 * Resolve API base URL in a resilient way for both public and internal pages.
 * Precedence:
 * 1. NEXT_PUBLIC_API_BASE (explicit full base) 
 * 2. NEXT_PUBLIC_API_URL (legacy name used elsewhere) 
 * 3. window.location.origin + '/api' in browser (supports same-origin deployments)
 * 4. /api rewrite fallback (so frontend can proxy to the API service)
 * 5. http://localhost:4000 in development only
 * We never return an empty string in production—fall back to the /api rewrite so calls
 * like `/api/landing-tenants/<slug>` reach the backend instead of 404ing.
 */
export function getApiBase() {
  const base = (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (base) {
    // Ensure the base ends with /api if it doesn't already
    const trimmed = base.replace(/\/$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }

  if (typeof window !== 'undefined') {
    // Same-origin fallback – assume Next.js API routes or reverse proxy at /api
    return (window.location.origin || '').replace(/\/$/, '') + '/api';
  }

  // Server-side fallback: always use the /api rewrite in production so requests hit the backend
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) {
    return '/api';
  }

  return 'http://localhost:4000';
}

export const API_BASE = getApiBase();