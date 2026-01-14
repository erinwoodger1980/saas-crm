/**
 * Helper functions for API routes
 */

import { NextRequest } from 'next/server';
import { API_BASE } from './api-base';

function pickBackendOrigin(req: NextRequest): string {
  const host = (req.headers.get('host') || '').toLowerCase();

  // Render staging: deterministic and bypass any broken custom DNS.
  if (host.includes('web-staging') && host.endsWith('.onrender.com')) {
    return 'https://joineryai-api-staging.onrender.com';
  }

  // Custom staging domains under joineryai.app should still hit staging API.
  if (host.includes('staging') && host.endsWith('.joineryai.app')) {
    return 'https://joineryai-api-staging.onrender.com';
  }

  // Production: default to the public API.
  if (host === 'joineryai.app' || host === 'www.joineryai.app' || host.endsWith('.joineryai.app')) {
    return 'https://api.joineryai.app';
  }

  const configured = (
    process.env.API_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ''
  ).trim();

  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/g, '');
  }

  // Local dev fallback.
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    const fallbackPort = Number(process.env.LOCAL_API_PORT || process.env.API_PORT || 4000);
    const fallback = `http://localhost:${Number.isFinite(fallbackPort) ? fallbackPort : 4000}`;
    return (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE || fallback).replace(/\/+$/g, '');
  }

  return 'https://api.joineryai.app';
}

function isProbablyHtml(text: string): boolean {
  const t = text.trimStart().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html') || t.startsWith('<head') || t.startsWith('<body');
}

export async function readJsonFromUpstream(res: Response): Promise<{ data: any; rawText: string; contentType: string; looksLikeHtml: boolean }> {
  const contentType = String(res.headers.get('content-type') || '');
  const rawText = await res.text();
  const looksLikeHtml = isProbablyHtml(rawText) || /text\/html/i.test(contentType);

  if (/application\/json/i.test(contentType)) {
    try {
      return { data: rawText ? JSON.parse(rawText) : null, rawText, contentType, looksLikeHtml };
    } catch {
      // fall through
    }
  }

  // Best-effort: some upstreams mislabel content-type.
  try {
    const maybe = rawText ? JSON.parse(rawText) : null;
    return { data: maybe, rawText, contentType, looksLikeHtml };
  } catch {
    return { data: rawText, rawText, contentType, looksLikeHtml };
  }
}

/**
 * Get the backend API base URL
 * In production, if API_BASE resolves to same origin, use the known production API
 */
export function getBackendApiBase(req?: NextRequest) {
  // When we have a request (i.e. inside a Next route handler), prefer
  // deterministic host-based routing (matches /api/[...path] behavior).
  if (req && typeof window === 'undefined') {
    return pickBackendOrigin(req).replace(/\/api$/i, '');
  }

  // Otherwise, prefer explicit server-side configuration (works for staging/prod)
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
