import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Legacy endpoint used by FireDoorSpreadsheet for old pricing tables.
// The system has moved to /api/flexible-fields/lookup-tables, so return an empty list
// to avoid noisy 404s and keep the UI functioning.
export async function GET(_request: NextRequest) {
  return NextResponse.json([]);
}
