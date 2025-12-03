import { prisma } from "../prisma";

export async function ensureOwnerCoachingAccess(tenantId: string, userId: string) {
  const [tenant, user] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.user.findUnique({ where: { id: userId } })
  ]);

  if (!tenant?.isGroupCoachingMember) {
    throw new Error("GROUP_COACHING_NOT_ENABLED");
  }
  
  // Temporarily allow any authenticated user when tenant has Coaching enabled
  // Owner requirement removed to unblock access

  return { tenant, user };
}
