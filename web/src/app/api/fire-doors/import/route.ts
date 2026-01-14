import { NextRequest, NextResponse } from "next/server";
import { getBackendApiBase, forwardAuthHeaders, readJsonFromUpstream } from "@/lib/api-route-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Parse incoming multipart/form-data
    const incoming = await request.formData();

    const outgoing = new FormData();
    // Preserve expected fields
    const file = incoming.get("file");
    if (file) outgoing.append("file", file);

    // Forward any additional fields (projectId, orderId, mjsNumber, etc.)
    for (const [key, value] of incoming.entries()) {
      if (key === "file") continue;
      outgoing.append(key, value);
    }

    const upstreamUrl = getBackendApiBase(request) + "/fire-doors/import";
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        ...forwardAuthHeaders(request),
        // NOTE: do NOT set Content-Type for multipart; fetch will add the boundary.
      },
      body: outgoing,
      credentials: "include",
    });

    const parsed = await readJsonFromUpstream(res);
    if (parsed.looksLikeHtml) {
      console.error("[fire-doors/import POST] Upstream returned HTML", {
        upstreamUrl,
        status: res.status,
        contentType: parsed.contentType,
        preview: parsed.rawText.slice(0, 200),
      });
    }

    // Ensure we always respond with JSON object for error cases.
    const data =
      !res.ok && typeof parsed.data === "string"
        ? { error: "UpstreamError", message: parsed.data }
        : parsed.data;

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[fire-doors/import POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to import CSV", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}
