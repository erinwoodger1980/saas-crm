import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/tenant-product-types?slug=...
 * Public-safe endpoint used by the PublicEstimatorWizard to load tenant-configured product types.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = String(searchParams.get("slug") || "").trim();

    if (!slug) {
      return NextResponse.json({ message: "slug is required" }, { status: 400 });
    }

    const settings = await prisma.tenantSettings.findUnique({ where: { slug } });
    if (!settings) {
      return NextResponse.json({ message: "tenant not found" }, { status: 404 });
    }

    return NextResponse.json({
      productTypes: Array.isArray((settings as any).productTypes) ? (settings as any).productTypes : [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message || "failed to load product types" },
      { status: 500 }
    );
  }
}
