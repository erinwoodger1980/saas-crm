import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const configs = await prisma.gridFieldConfig.findMany({
      orderBy: {
        fieldName: 'asc',
      },
    });

    return NextResponse.json(configs);
  } catch (error: any) {
    console.error("Grid config retrieval error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
