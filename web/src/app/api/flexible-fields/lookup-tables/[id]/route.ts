/**
 * Lookup Tables API Routes - Single Table
 * GET/PATCH/DELETE operations for individual lookup tables
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
 * GET /api/flexible-fields/lookup-tables/:id
 * Fetch single lookup table
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(apiBase() + `/api/flexible-fields/lookup-tables/${params.id}`, {
      headers: forwardHeaders(request),
      credentials: 'include',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[lookup-tables GET/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lookup table', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/flexible-fields/lookup-tables/:id
 * Update lookup table
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const res = await fetch(apiBase() + `/api/flexible-fields/lookup-tables/${params.id}`, {
      method: 'PATCH',
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
    console.error('[lookup-tables PATCH/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update lookup table', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/flexible-fields/lookup-tables/:id
 * Delete lookup table
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(apiBase() + `/api/flexible-fields/lookup-tables/${params.id}`, {
      method: 'DELETE',
      headers: forwardHeaders(request),
      credentials: 'include',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[lookup-tables DELETE/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete lookup table', message: error.message },
      { status: 500 }
    );
  }
}
