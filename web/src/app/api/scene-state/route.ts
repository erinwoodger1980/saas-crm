/**
 * Scene State API Routes
 * REST endpoints for persisting and loading scene configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { SceneConfig } from '@/types/scene-config';
import { API_BASE } from '@/lib/api-base';

function apiBase() { return API_BASE; }

function forwardHeaders(req: NextRequest) {
  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;
  const cookie = req.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;
  return headers;
}

export const runtime = 'nodejs';

/**
 * GET /api/scene-state
 * Load scene configuration for an entity
 * 
 * Query params:
 * - tenantId: string
 * - entityType: string
 * - entityId: string
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(apiBase() + '/api/scene-state' + (new URL(request.url)).search);
    const res = await fetch(url.toString(), { headers: forwardHeaders(request) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[proxy GET /api/scene-state] error:', error?.message || error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

/**
 * POST /api/scene-state
 * Save or update scene configuration
 * 
 * Body:
 * {
 *   tenantId: string;
 *   entityType: string;
 *   entityId: string;
 *   config: SceneConfig;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const res = await fetch(apiBase() + '/api/scene-state', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...forwardHeaders(request) },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[proxy POST /api/scene-state] error:', error?.message || error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

/**
 * DELETE /api/scene-state
 * Delete scene configuration
 * 
 * Query params:
 * - tenantId: string
 * - entityType: string
 * - entityId: string
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(apiBase() + '/api/scene-state' + (new URL(request.url)).search);
    const res = await fetch(url.toString(), { method: 'DELETE', headers: forwardHeaders(request) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[proxy DELETE /api/scene-state] error:', error?.message || error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
