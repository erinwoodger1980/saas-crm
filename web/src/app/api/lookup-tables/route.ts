import { NextRequest, NextResponse } from 'next/server';
import { forwardAuthHeaders, getBackendApiBase } from '@/lib/api-route-helpers';

/**
 * GET /api/lookup-tables
 * Proxy request to backend to fetch all available lookup tables for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(getBackendApiBase() + '/lookup-tables' + request.nextUrl.search);
    const res = await fetch(url.toString(), {
      headers: forwardAuthHeaders(request),
    });
    const data = await res.json();
    
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('Error fetching lookup tables:', error);
    return NextResponse.json([], { status: 200 }); // Return empty array on error
  }
}

