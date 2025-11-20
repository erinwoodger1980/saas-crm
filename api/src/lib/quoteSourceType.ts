import { QuoteSourceType as PrismaQuoteSourceType } from "@prisma/client";

export type QuoteSourceValue = "supplier" | "software";

const API_TO_DB: Record<QuoteSourceValue, PrismaQuoteSourceType> = {
  supplier: PrismaQuoteSourceType.SUPPLIER,
  software: PrismaQuoteSourceType.USER_SOFTWARE,
};

const DB_TO_API: Record<PrismaQuoteSourceType, QuoteSourceValue> = {
  [PrismaQuoteSourceType.SUPPLIER]: "supplier",
  [PrismaQuoteSourceType.USER_SOFTWARE]: "software",
};

export function normalizeQuoteSourceValue(value?: string | null): QuoteSourceValue | null {
  if (!value || typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "supplier") return "supplier";
  if (normalized === "software") return "software";
  return null;
}

export function toDbQuoteSourceType(value?: string | null): PrismaQuoteSourceType | null {
  const normalized = normalizeQuoteSourceValue(value);
  return normalized ? API_TO_DB[normalized] : null;
}

export function fromDbQuoteSourceType(value?: PrismaQuoteSourceType | null): QuoteSourceValue | null {
  if (!value) return null;
  return DB_TO_API[value] ?? null;
}
