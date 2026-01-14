import { NextRequest, NextResponse } from "next/server";
import { getBackendApiBase, forwardAuthHeaders } from "@/lib/api-route-helpers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const res = await fetch(getBackendApiBase() + "/grid-config/all", {
      headers: forwardAuthHeaders(request),
      credentials: "include",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[grid/config/all GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch grid configs", message: error.message },
      { status: 500 }
    );
  }
}
