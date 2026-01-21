import { NextRequest, NextResponse } from "next/server";
import { getBackendApiBase, forwardAuthHeaders, readJsonFromUpstream } from "@/lib/api-route-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData();

    const outgoing = new FormData();
    const file = incoming.get("file");
    if (file) outgoing.append("file", file);

    for (const [key, value] of incoming.entries()) {
      if (key === "file") continue;
      outgoing.append(key, value);
    }

    const upstreamUrl = getBackendApiBase(request) + "/fire-doors/import-lw";
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        ...forwardAuthHeaders(request),
      },
      body: outgoing,
      credentials: "include",
    });

    const parsed = await readJsonFromUpstream(res);
    if (parsed.looksLikeHtml) {
      console.error("[fire-doors/import-lw POST] Upstream returned HTML", {
        upstreamUrl,
        status: res.status,
        contentType: parsed.contentType,
        preview: parsed.rawText.slice(0, 200),
      });
    }

    const data =
      !res.ok && typeof parsed.data === "string"
        ? { error: "UpstreamError", message: parsed.data }
        : parsed.data;

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[fire-doors/import-lw POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to import LW spreadsheet", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}
