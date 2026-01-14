/**
 * Lookup Tables API Routes
 * Manage lookup table data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBase, forwardAuthHeaders, readJsonFromUpstream } from '@/lib/api-route-helpers';

export const runtime = 'nodejs';

/**
 * GET /api/flexible-fields/lookup-tables
 * Fetch lookup tables
 */
export async function GET(request: NextRequest) {
  try {
    const upstreamUrl = getBackendApiBase(request) + '/flexible-fields/lookup-tables';
    const res = await fetch(upstreamUrl, {
      headers: forwardAuthHeaders(request),
      credentials: 'include',
    });

    const parsed = await readJsonFromUpstream(res);
    if (parsed.looksLikeHtml) {
      console.error('[lookup-tables GET] Upstream returned HTML', {
        upstreamUrl,
        status: res.status,
        contentType: parsed.contentType,
        preview: parsed.rawText.slice(0, 200),
      });
    }

    return NextResponse.json(parsed.data, { status: res.status });
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

    const upstreamUrl = getBackendApiBase(request) + '/flexible-fields/lookup-tables';
    const res = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        ...forwardAuthHeaders(request),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    const parsed = await readJsonFromUpstream(res);
    if (parsed.looksLikeHtml) {
      console.error('[lookup-tables POST] Upstream returned HTML', {
        upstreamUrl,
        status: res.status,
        contentType: parsed.contentType,
        preview: parsed.rawText.slice(0, 200),
      });
    }

    return NextResponse.json(parsed.data, { status: res.status });
  } catch (error: any) {
    console.error('[lookup-tables POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create lookup table', message: error.message },
      { status: 500 }
    );
  }
}
