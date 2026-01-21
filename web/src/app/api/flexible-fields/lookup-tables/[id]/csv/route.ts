/**
 * Lookup Tables CSV Export Proxy
 * GET /api/flexible-fields/lookup-tables/:id/csv
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBase, forwardAuthHeaders } from '@/lib/api-route-helpers';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const upstreamUrl = getBackendApiBase(request) + `/flexible-fields/lookup-tables/${params.id}/csv`;
    const res = await fetch(upstreamUrl, {
      headers: forwardAuthHeaders(request),
      credentials: 'include',
    });

    const buf = await res.arrayBuffer();
    const headers = new Headers();

    const contentType = res.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);

    const contentDisposition = res.headers.get('content-disposition');
    if (contentDisposition) headers.set('content-disposition', contentDisposition);

    return new NextResponse(buf, { status: res.status, headers });
  } catch (error: any) {
    console.error('[lookup-tables csv GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export lookup table CSV', message: error.message },
      { status: 500 }
    );
  }
}
