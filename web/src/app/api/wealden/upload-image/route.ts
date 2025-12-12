import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/api-base";

function apiBase() {
  return API_BASE;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Forward to API server
    const apiUrl = `${apiBase()}/api/wealden/images/upload`;
    console.log("[Wealden Web] Proxying upload to:", apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Wealden Web] Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to upload file", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get("slotId");

    if (!slotId) {
      return NextResponse.json({ error: "slotId required" }, { status: 400 });
    }

    // Forward to API server
    const apiUrl = `${apiBase()}/api/wealden/images/${slotId}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Wealden Web] Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}
