/**
 * Display Contexts API Routes - Single Context
 * PATCH/DELETE operations for individual display contexts
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
 * PATCH /api/flexible-fields/display-contexts/:id
 * Update display context
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const res = await fetch(apiBase() + `/flexible-fields/display-contexts/${params.id}`, {
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
    console.error('[display-contexts PATCH/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update display context', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/flexible-fields/display-contexts/:id
 * Delete display context
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(apiBase() + `/flexible-fields/display-contexts/${params.id}`, {
      method: 'DELETE',
      headers: forwardHeaders(request),
      credentials: 'include',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[display-contexts DELETE/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete display context', message: error.message },
      { status: 500 }
    );
  }
}
