import { NextRequest, NextResponse } from 'next/server';
import { forwardAuthHeaders, getBackendApiBase, readJsonFromUpstream } from '@/lib/api-route-helpers';

/**
 * GET /api/lookup-tables
 * Proxy request to backend to fetch all available lookup tables for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const upstreamUrl = new URL(getBackendApiBase(request) + '/lookup-tables' + request.nextUrl.search);
    const res = await fetch(upstreamUrl.toString(), {
      headers: forwardAuthHeaders(request),
    });

    const parsed = await readJsonFromUpstream(res);
    const data = parsed.data;

    if (parsed.looksLikeHtml) {
      console.error('[lookup-tables] Upstream returned HTML', {
        upstreamUrl: upstreamUrl.toString(),
        status: res.status,
        contentType: parsed.contentType,
        preview: parsed.rawText.slice(0, 200),
      });
    }
    
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('Error fetching lookup tables:', error);
    return NextResponse.json([], { status: 200 }); // Return empty array on error
  }
}

