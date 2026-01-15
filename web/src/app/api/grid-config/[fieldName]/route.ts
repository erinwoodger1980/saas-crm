import { NextRequest, NextResponse } from "next/server";
import { getBackendApiBase, forwardAuthHeaders, readJsonFromUpstream } from "@/lib/api-route-helpers";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { fieldName: string } }
) {
  try {
    const fieldName = params.fieldName;
    if (!fieldName) {
      return NextResponse.json({ error: "fieldName required" }, { status: 400 });
    }

    const body = await request.json();
    const upstreamUrl = getBackendApiBase(request) + `/grid-config/${encodeURIComponent(fieldName)}`;
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        ...forwardAuthHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      credentials: "include",
    });

    const parsed = await readJsonFromUpstream(res);
    if (parsed.looksLikeHtml) {
      console.error("[grid-config POST] Upstream returned HTML", {
        upstreamUrl,
        status: res.status,
        contentType: parsed.contentType,
        preview: parsed.rawText.slice(0, 200),
      });
    }
    return NextResponse.json(parsed.data, { status: res.status });
  } catch (error: any) {
    console.error("[grid-config POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to save grid config", message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { fieldName: string } }
) {
  try {
    const fieldName = params.fieldName;
    if (!fieldName) {
      return NextResponse.json({ error: "fieldName required" }, { status: 400 });
    }

    const upstreamUrl = getBackendApiBase(request) + `/grid-config/${encodeURIComponent(fieldName)}`;
    const res = await fetch(upstreamUrl, {
      headers: forwardAuthHeaders(request),
      credentials: "include",
    });
    const parsed = await readJsonFromUpstream(res);
    if (parsed.looksLikeHtml) {
      console.error("[grid-config GET] Upstream returned HTML", {
        upstreamUrl,
        status: res.status,
        contentType: parsed.contentType,
        preview: parsed.rawText.slice(0, 200),
      });
    }
    return NextResponse.json(parsed.data, { status: res.status });
  } catch (error: any) {
    console.error("[grid-config GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch grid config", message: error.message },
      { status: 500 }
    );
  }
}

