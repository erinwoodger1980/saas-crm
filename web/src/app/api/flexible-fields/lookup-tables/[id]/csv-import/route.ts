/**
 * Lookup Tables CSV Import Proxy
 * POST /api/flexible-fields/lookup-tables/:id/csv-import
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBase, forwardAuthHeaders } from '@/lib/api-route-helpers';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const upstreamUrl = getBackendApiBase(request) + `/flexible-fields/lookup-tables/${params.id}/csv-import`;
    const formData = await request.formData();

    const res = await fetch(upstreamUrl, {
      method: 'POST',
      headers: forwardAuthHeaders(request),
      body: formData,
      credentials: 'include',
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('[lookup-tables csv-import POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to import lookup table CSV', message: error.message },
      { status: 500 }
    );
  }
}
