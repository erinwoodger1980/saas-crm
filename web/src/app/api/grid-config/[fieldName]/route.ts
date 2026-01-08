import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { fieldName: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fieldName = params.fieldName;
    const config = await request.json();

    // Save or update grid field configuration
    const updated = await prisma.gridFieldConfig.upsert({
      where: {
        fieldName,
      },
      update: {
        inputType: config.inputType,
        lookupTable: config.lookupTable,
        formula: config.formula,
        componentLink: config.componentLink,
        required: config.required,
        updatedAt: new Date(),
      },
      create: {
        fieldName,
        inputType: config.inputType,
        lookupTable: config.lookupTable,
        formula: config.formula,
        componentLink: config.componentLink,
        required: config.required,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Grid config error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { fieldName: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fieldName = params.fieldName;

    const config = await prisma.gridFieldConfig.findUnique({
      where: { fieldName },
    });

    return NextResponse.json(config || {});
  } catch (error: any) {
    console.error("Grid config retrieval error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
