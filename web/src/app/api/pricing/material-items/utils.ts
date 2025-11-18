import { MaterialItemCategory, Prisma } from "@prisma/client";
import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const decimalFields = ["cost", "stockQuantity", "minStockLevel"] as const;

export const baseSchema = z.object({
  supplierId: z.string().trim().min(1).optional().nullable(),
  category: z.nativeEnum(MaterialItemCategory),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().max(1024).optional().nullable(),
  cost: z.coerce.number().nonnegative(),
  currency: z.string().trim().min(1).max(8).default("GBP"),
  unit: z.string().trim().min(1).max(32).default("each"),
  stockQuantity: z.coerce.number().nullable().optional(),
  minStockLevel: z.coerce.number().nullable().optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(365).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1024).optional().nullable(),
});

export const createSchema = baseSchema;
export const updateSchema = baseSchema.partial();

export type MaterialItemPayload = z.infer<typeof createSchema>;

export type MaterialItemResponse = {
  id: string;
  tenantId: string;
  supplierId: string | null;
  supplierName: string | null;
  category: MaterialItemCategory;
  code: string;
  name: string;
  description: string | null;
  cost: number;
  currency: string;
  unit: string;
  stockQuantity: number | null;
  minStockLevel: number | null;
  leadTimeDays: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type MaterialItemRecord = Prisma.MaterialItemGetPayload<{
  include: { supplier: { select: { id: true; name: true } } };
}>;

export const serialize = (item: MaterialItemRecord): MaterialItemResponse => ({
  id: item.id,
  tenantId: item.tenantId,
  supplierId: item.supplierId,
  supplierName: item.supplier?.name ?? null,
  category: item.category,
  code: item.code,
  name: item.name,
  description: item.description ?? null,
  cost: Number(item.cost),
  currency: item.currency,
  unit: item.unit,
  stockQuantity: item.stockQuantity == null ? null : Number(item.stockQuantity),
  minStockLevel: item.minStockLevel == null ? null : Number(item.minStockLevel),
  leadTimeDays: item.leadTimeDays ?? null,
  isActive: item.isActive,
  notes: item.notes ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export async function fetchMany(where: Prisma.MaterialItemWhereInput, take?: number) {
  return prisma.materialItem.findMany({
    where,
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export function decimalOrNull(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return undefined;
  return new Prisma.Decimal(value);
}

export function buildDataPayload(input: Partial<MaterialItemPayload>) {
  const data: Record<string, unknown> = {};

  if ("supplierId" in input) data.supplierId = input.supplierId || null;
  if (input.category) data.category = input.category;
  if (input.code) data.code = input.code;
  if (input.name) data.name = input.name;
  if ("description" in input) data.description = input.description ?? null;
  if ("currency" in input && input.currency) data.currency = input.currency;
  if ("unit" in input && input.unit) data.unit = input.unit;
  if ("leadTimeDays" in input) data.leadTimeDays = input.leadTimeDays ?? null;
  if ("isActive" in input) data.isActive = input.isActive ?? true;
  if ("notes" in input) data.notes = input.notes ?? null;

  for (const field of decimalFields) {
    if (field in input) {
      const value = (input as any)[field];
      data[field] = decimalOrNull(value ?? null);
    }
  }

  return data;
}

export function buildWhere(tenantId: string, params: URLSearchParams): Prisma.MaterialItemWhereInput {
  const search = params.get("q") || params.get("search") || "";
  const category = params.get("category");
  const includeInactive = params.get("includeInactive") === "true";

  const where: Prisma.MaterialItemWhereInput = {
    tenantId,
    ...(includeInactive ? {} : { isActive: true }),
  };

  if (category && Object.values(MaterialItemCategory).includes(category as MaterialItemCategory)) {
    where.category = category as MaterialItemCategory;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

export function handleError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "validation_error", details: error.flatten() }, { status: 400 });
  }
  console.error("Material items API error", error);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}
