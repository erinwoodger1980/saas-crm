import { NextRequest, NextResponse } from "next/server";

// Proxy-only implementation (Prisma removed from web). Categories mirrored from schema.
const MATERIAL_ITEM_CATEGORIES = [
  "DOOR_BLANK",
  "LIPPING",
  "IRONMONGERY",
  "GLASS",
  "TIMBER",
  "BOARD",
  "VENEER",
  "FINISH",
  "HARDWARE",
  "CONSUMABLE",
  "OTHER",
] as const;

import { API_BASE } from "@/src/lib/api-base";
function apiBase() { return API_BASE; }

function forwardHeaders(req: NextRequest) {
  const headers: Record<string, string> = {};
  const auth = req.headers.get("authorization");
  if (auth) headers["authorization"] = auth;
  const cookie = req.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;
  return headers;
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(apiBase() + "/api/pricing/material-items" + req.nextUrl.search);
    const res = await fetch(url.toString(), {
      headers: forwardHeaders(req),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    // Inject categories to retain previous shape expected by UI.
    return NextResponse.json({
      ...data,
      categories: MATERIAL_ITEM_CATEGORIES,
    });
  } catch (error) {
    console.error("Material items proxy GET error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(apiBase() + "/api/pricing/material-items", {
      method: "POST",
      headers: { "content-type": "application/json", ...forwardHeaders(req) },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Material items proxy POST error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

