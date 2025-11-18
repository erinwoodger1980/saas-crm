import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveAuthContext } from "@/lib/server/auth";
import { handleError, serialize, updateSchema, buildDataPayload } from "../utils";

export const runtime = "nodejs";

type Params = { params: { id: string } };

async function ensureOwnedItem(id: string, tenantId: string) {
  return prisma.materialItem.findFirst({
    where: { id, tenantId },
    include: { supplier: { select: { id: true, name: true } } },
  });
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = resolveAuthContext(req);
    if (!auth?.tenantId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const item = await ensureOwnedItem(params.id, auth.tenantId);
    if (!item) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ item: serialize(item) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = resolveAuthContext(req);
    if (!auth?.tenantId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const item = await ensureOwnedItem(params.id, auth.tenantId);
    if (!item) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const payload = updateSchema.parse(await req.json());
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "no_changes" }, { status: 400 });
    }

    const updated = await prisma.materialItem.update({
      where: { id: item.id },
      data: buildDataPayload(payload),
      include: { supplier: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ item: serialize(updated) });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = resolveAuthContext(req);
    if (!auth?.tenantId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const item = await ensureOwnedItem(params.id, auth.tenantId);
    if (!item) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await prisma.materialItem.delete({ where: { id: item.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
