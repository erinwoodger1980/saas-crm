import { NextRequest, NextResponse } from "next/server";
import { getBackendApiBase, forwardAuthHeaders, readJsonFromUpstream } from "@/lib/api-route-helpers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const upstreamUrl = getBackendApiBase(request) + "/grid-config/all";
    const res = await fetch(upstreamUrl, {
      headers: forwardAuthHeaders(request),
      credentials: "include",
    });

    const parsed = await readJsonFromUpstream(res);
    if (parsed.looksLikeHtml) {
      console.error("[grid-config/all GET] Upstream returned HTML", {
        upstreamUrl,
        status: res.status,
        contentType: parsed.contentType,
        preview: parsed.rawText.slice(0, 200),
      });
    }

    return NextResponse.json(parsed.data, { status: res.status });
  } catch (error: any) {
    console.error("[grid-config/all GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch grid configs", message: error.message },
      { status: 500 }
    );
  }
}
