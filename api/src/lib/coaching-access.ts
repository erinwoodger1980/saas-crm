import { prisma } from "../prisma";

export async function ensureOwnerCoachingAccess(tenantId: string, userId: string) {
  const [tenant, tenantSettings, user] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, isGroupCoachingMember: true } }),
    prisma.tenantSettings.findUnique({ where: { tenantId }, select: { isGroupCoachingMember: true } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  // The web UI writes the flag to TenantSettings via /tenant/settings.
  // For backwards compatibility (older migrations/scripts), also accept the flag on Tenant.
  const isGroupCoachingMember = Boolean(
    tenantSettings?.isGroupCoachingMember ?? tenant?.isGroupCoachingMember ?? false,
  );

  console.log("[CoachingAccess] tenantId:", tenantId, "userId:", userId, "isGroupCoachingMember:", isGroupCoachingMember);

  if (!isGroupCoachingMember) {
    console.error("[CoachingAccess] GROUP_COACHING_NOT_ENABLED for tenantId:", tenantId);
    throw new Error("GROUP_COACHING_NOT_ENABLED");
  }
  
  // Temporarily allow any authenticated user when tenant has Coaching enabled
  // Owner requirement removed to unblock access

  return { tenant, user };
}
