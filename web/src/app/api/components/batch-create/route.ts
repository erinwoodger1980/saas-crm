/**
 * Batch Create Components Endpoint
 * Creates components from AI-generated specifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { tenantId, components } = await request.json();

    if (!tenantId || !components || !Array.isArray(components)) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, components (array)' },
        { status: 400 }
      );
    }

    // Forward to backend API
    try {
      const response = await apiFetch('/components/batch-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          components,
        }),
      });

      return NextResponse.json(response);
    } catch (error: any) {
      console.error('[batch-create-components] Backend error:', error);
      return NextResponse.json(
        { error: error?.message || 'Failed to create components' },
        { status: error?.status || 500 }
      );
    }
  } catch (error) {
    console.error('[batch-create-components] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
