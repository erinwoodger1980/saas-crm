/**
 * Field Evaluation API Route
 * Evaluate formulas and lookup expressions
 */

import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/api-base';

function apiBase() { return API_BASE; }

function forwardHeaders(req: NextRequest) {
  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  if (auth) headers['authorization'] = auth;
  const cookie = req.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;
  return headers;
}

export const runtime = 'nodejs';

/**
 * POST /api/flexible-fields/evaluate-field
 * Evaluate field formula or lookup
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const res = await fetch(apiBase() + '/flexible-fields/evaluate-field', {
      method: 'POST',
      headers: {
        ...forwardHeaders(request),
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
