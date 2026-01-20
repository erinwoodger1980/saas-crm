import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: { id: string } };

import { API_BASE } from "@/lib/api-base";
function apiBase() { return API_BASE; }

function forwardHeaders(req: NextRequest) {
  const headers: Record<string, string> = {};
  const auth = req.headers.get("authorization");
  if (auth) headers["authorization"] = auth;
  const cookie = req.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;
  return headers;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const res = await fetch(apiBase() + `/api/pricing/material-items/${params.id}` , {
      headers: forwardHeaders(req),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("Material item proxy GET error", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.text();
    const res = await fetch(apiBase() + `/api/pricing/material-items/${params.id}` , {
      method: "PATCH",
      headers: { "content-type": "application/json", ...forwardHeaders(req) },
      body,
    });

    // Some backends return 204 or non-JSON error bodies. Don't explode on res.json().
    const raw = await res.text();
    const data = (() => {
      if (!raw) return { ok: res.ok };
      try {
        return JSON.parse(raw);
      } catch {
        return { ok: res.ok, raw };
      }
    })();

    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("Material item proxy PATCH error", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const res = await fetch(apiBase() + `/api/pricing/material-items/${params.id}` , {
      method: "DELETE",
      headers: forwardHeaders(req),
    });
    const data = await res.json().catch(() => ({ ok: res.ok }));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("Material item proxy DELETE error", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
