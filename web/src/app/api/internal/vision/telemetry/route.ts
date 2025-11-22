import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function adminToken() {
  return process.env.ADMIN_API_TOKEN || '';
}

export async function GET(req: NextRequest) {
  const token = adminToken();
  if (!token) {
    return new Response(JSON.stringify({ error: 'admin_token_not_configured' }), { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const internalUrl = `${process.env.API_URL || process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || ''}/internal/vision/telemetry${qs ? '?' + qs : ''}`;
  try {
    const resp = await fetch(internalUrl, { headers: { 'x-admin-token': token } });
    const json = await resp.json();
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'telemetry_proxy_failed' }), { status: 500 });
  }
}
