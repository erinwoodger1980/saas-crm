/**
 * ML Training Events API Routes
 * Log and retrieve ML training events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBase, forwardAuthHeaders } from '@/lib/api-route-helpers';

export const runtime = 'nodejs';

/**
 * GET /api/flexible-fields/ml-training-events
 * Fetch ML training events
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = new URL(getBackendApiBase() + '/flexible-fields/ml-training-events');
    
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    
    const res = await fetch(url.toString(), {
      headers: forwardAuthHeaders(request),
      credentials: 'include',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[ml-training-events GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ML training events', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flexible-fields/ml-training-events
 * Log ML training event
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const res = await fetch(getBackendApiBase() + '/flexible-fields/ml-training-events', {
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
    console.error('[ml-training-events POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to log ML training event', message: error.message },
      { status: 500 }
    );
  }
}
