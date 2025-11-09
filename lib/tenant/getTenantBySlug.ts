import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function getTenantBySlug(slug: string) {
  if (!slug) return null;
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return null;
  // Only return safe fields
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    logoUrl: tenant.logoUrl || '',
    primary: tenant.primary || '',
    secondary: tenant.secondary || '',
  };
}
