// Central API base resolution.
// In development we fall back to localhost if NEXT_PUBLIC_API_BASE is unset.
// In production builds we throw early to avoid silently pointing at localhost.
export function getApiBase() {
  const envVal = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (envVal) return envVal;
  if (process.env.NODE_ENV === 'development') return 'http://localhost:4000';
  throw new Error('NEXT_PUBLIC_API_BASE not set');
}

export const API_BASE = getApiBase();