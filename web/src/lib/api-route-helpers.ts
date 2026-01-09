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
  const base = API_BASE;
  // Server-side in production without proper NEXT_PUBLIC_API_BASE config
  if (typeof window === 'undefined' && base === '/api') {
    return 'https://api.joineryai.app';
  }
  return base;
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
