// api/src/lib/flags.ts
import { prisma } from "../db";

export async function getTenantFlags(tenantId: string) {
  const s = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const js = (s?.beta as any) || {};
  return {
    quoteParserV2: !!js.quoteParserV2,
  };
}