/**
 * Display Contexts API Routes
 * Manage field visibility configurations
 */

import { NextRequest, NextResponse } from 'next/server';
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
 * GET /api/flexible-fields/display-contexts
 * Fetch display contexts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = new URL(apiBase() + '/api/flexible-fields/display-contexts');
    
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    
    const res = await fetch(url.toString(), {
      headers: forwardHeaders(request),
      credentials: 'include',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[display-contexts GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch display contexts', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flexible-fields/display-contexts
 * Create/update display context
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const res = await fetch(apiBase() + '/api/flexible-fields/display-contexts', {
      method: 'POST',
      headers: {
        ...forwardHeaders(request),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[display-contexts POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create display context', message: error.message },
      { status: 500 }
    );
  }
}
