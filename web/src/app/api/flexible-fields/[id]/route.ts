/**
 * Flexible Fields API Routes - Single Field
 * GET/PATCH/DELETE operations for individual fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBase, forwardAuthHeaders } from '@/lib/api-route-helpers';

export const runtime = 'nodejs';

/**
 * GET /api/flexible-fields/:id
 * Fetch single field by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(getBackendApiBase() + `/flexible-fields/fields/${params.id}`, {
      headers: forwardAuthHeaders(request),
      credentials: 'include',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[flexible-fields GET/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch field', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/flexible-fields/:id
 * Update field
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const res = await fetch(getBackendApiBase() + `/flexible-fields/fields/${params.id}`, {
      method: 'PATCH',
      headers: {
        ...forwardAuthHeaders(request),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[flexible-fields PATCH/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update field', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/flexible-fields/:id
 * Delete field
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await fetch(getBackendApiBase() + `/flexible-fields/fields/${params.id}`, {
      method: 'DELETE',
      headers: forwardAuthHeaders(request),
      credentials: 'include',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[flexible-fields DELETE/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete field', message: error.message },
      { status: 500 }
    );
  }
}
