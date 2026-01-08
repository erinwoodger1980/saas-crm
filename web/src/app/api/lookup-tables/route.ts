import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/api-base';

function forwardHeaders(req: NextRequest) {
  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;
  const cookie = req.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;
  return headers;
}

/**
 * GET /api/lookup-tables
 * Proxy request to backend to fetch all available lookup tables for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(API_BASE + '/lookup-tables' + request.nextUrl.search);
    const res = await fetch(url.toString(), {
      headers: forwardHeaders(request),
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

