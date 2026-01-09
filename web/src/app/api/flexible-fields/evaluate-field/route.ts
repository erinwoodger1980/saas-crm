/**
 * Field Evaluation API Route
 * Evaluate formulas and lookup expressions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBase, forwardAuthHeaders } from '@/lib/api-route-helpers';

export const runtime = 'nodejs';

/**
 * POST /api/flexible-fields/evaluate-field
 * Evaluate field formula or lookup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const res = await fetch(getBackendApiBase() + '/flexible-fields/evaluate-field', {
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
    console.error('[evaluate-field POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate field', message: error.message },
      { status: 500 }
    );
  }
}
