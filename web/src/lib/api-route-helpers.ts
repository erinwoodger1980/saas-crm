/**
 * Helper functions for API routes
 */

import { NextRequest } from 'next/server';
import { API_BASE } from './api-base';

/**
 * Get the backend API base URL
 * In production, if API_BASE resolves to same origin, use the known production API
 */
export function getBackendApiBase() {
  // Prefer explicit server-side configuration (works for staging/prod)
  const configured = (
    process.env.API_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ''
  ).trim();

  if (configured) {
    return configured.replace(/\/+$/g, '').replace(/\/api$/i, '');
  }

  const base = API_BASE;

  // If API_BASE includes a trailing "/api" (common in env configs), strip it for
  // direct backend calls because the Express server mounts routes at "/".
  const normalized = base.replace(/\/+$/g, '').replace(/\/api$/i, '');

  // If we still only have a relative base on the server, fall back to production.
  if (typeof window === 'undefined' && (base === '/api' || normalized === '')) {
    return 'https://api.joineryai.app';
  }

  return normalized;
}

/**
 * Forward authentication headers from Next.js request to backend
 */
export function forwardAuthHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;
  const cookie = req.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;
  return headers;
}
