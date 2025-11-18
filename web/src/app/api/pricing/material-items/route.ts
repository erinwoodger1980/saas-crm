import { NextRequest, NextResponse } from "next/server";
import { MaterialItemCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveAuthContext } from "@/lib/server/auth";
import {
  buildWhere,
  createSchema,
  fetchMany,
  handleError,
  serialize,
  buildDataPayload,
} from "./utils";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = resolveAuthContext(req);
    if (!auth?.tenantId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 250;

    const where = buildWhere(auth.tenantId, searchParams);

    const [items, suppliers] = await Promise.all([
      fetchMany(where, limit),
      prisma.supplier.findMany({
        where: { tenantId: auth.tenantId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      items: items.map(serialize),
      suppliers,
      categories: Object.values(MaterialItemCategory),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = resolveAuthContext(req);
    if (!auth?.tenantId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = createSchema.parse(await req.json());

    const created = await prisma.materialItem.create({
      data: {
        tenantId: auth.tenantId,
        ...buildDataPayload(payload),
      },
      include: { supplier: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ item: serialize(created) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
