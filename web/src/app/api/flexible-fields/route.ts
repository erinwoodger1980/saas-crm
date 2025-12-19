/**
 * Flexible Fields API Routes
 * CRUD operations for flexible field system
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
 * GET /api/flexible-fields
 * Fetch fields with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = new URL(apiBase() + '/flexible-fields/fields');
    
    // Forward query parameters (scope, displayContext, etc.)
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
    console.error('[flexible-fields GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fields', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flexible-fields
 * Create a new field
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const res = await fetch(apiBase() + '/flexible-fields/fields', {
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
    console.error('[flexible-fields POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create field', message: error.message },
      { status: 500 }
    );
  }
}
