/**
 * Lookup Tables API Routes
 * Manage lookup table data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBase, forwardAuthHeaders } from '@/lib/api-route-helpers';

export const runtime = 'nodejs';

/**
 * GET /api/flexible-fields/lookup-tables
 * Fetch lookup tables
 */
export async function GET(request: NextRequest) {
  try {
    const res = await fetch(getBackendApiBase() + '/flexible-fields/lookup-tables', {
      headers: forwardAuthHeaders(request),
      credentials: 'include',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[lookup-tables GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lookup tables', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flexible-fields/lookup-tables
 * Create lookup table
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const res = await fetch(getBackendApiBase() + '/flexible-fields/lookup-tables', {
      method: 'POST',
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
    console.error('[lookup-tables POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create lookup table', message: error.message },
      { status: 500 }
    );
  }
}
