// api/src/lib/tjn.ts
import { prisma } from "../prisma";

const db: any = prisma;

export const TJN_NETWORK_SLUG = process.env.TJN_NETWORK_SLUG || "the-joinery-network";

export async function checkTjnAuthorised(tenantId: string) {
  const network = await db.network.findUnique({ where: { slug: TJN_NETWORK_SLUG } });
  if (!network) {
    // Allow access if network isn't configured yet.
    return { ok: true, isOwner: false, network: null, member: null };
  }
  if (network.tenantId === tenantId) {
    return { ok: true, isOwner: true, network, member: null };
  }
  const member = await db.networkMember.findUnique({
    where: { networkId_tenantId: { networkId: network.id, tenantId } },
  });
  if (member?.status === "AUTHORISED") {
    return { ok: true, isOwner: false, network, member };
  }
  return { ok: false, isOwner: false, network, member };
}
