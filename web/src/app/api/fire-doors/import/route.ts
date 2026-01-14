import { NextRequest, NextResponse } from "next/server";
import { getBackendApiBase, forwardAuthHeaders } from "@/lib/api-route-helpers";

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

    const res = await fetch(getBackendApiBase() + "/fire-doors/import", {
      method: "POST",
      headers: {
        ...forwardAuthHeaders(request),
        // NOTE: do NOT set Content-Type for multipart; fetch will add the boundary.
      },
      body: outgoing,
      credentials: "include",
    });

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : await res.text();

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[fire-doors/import POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to import CSV", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}
