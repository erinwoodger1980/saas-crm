import { NextRequest, NextResponse } from "next/server";
import { getBackendApiBase, forwardAuthHeaders } from "@/lib/api-route-helpers";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { fieldName: string } }
) {
  try {
    const fieldName = params.fieldName;
    if (!fieldName) {
      return NextResponse.json({ error: "fieldName required" }, { status: 400 });
    }

    const res = await fetch(getBackendApiBase() + `/grid-config/${encodeURIComponent(fieldName)}` , {
      headers: forwardAuthHeaders(request),
      credentials: "include",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[grid/config GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch grid config", message: error.message },
      { status: 500 }
    );
  }
}

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
    const res = await fetch(getBackendApiBase() + `/grid-config/${encodeURIComponent(fieldName)}` , {
      method: "POST",
      headers: {
        ...forwardAuthHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      credentials: "include",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[grid/config POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to save grid config", message: error.message },
      { status: 500 }
    );
  }
}
