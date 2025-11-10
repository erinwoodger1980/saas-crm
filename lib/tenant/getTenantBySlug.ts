import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getTenantBySlug(slug: string): Promise<{
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  primary?: string | null;
  secondary?: string | null;
} | null> {
  if (!slug) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      primary: true,
      secondary: true,
    },
  });
  return tenant;
}import { PrismaClient } from '@prisma/client';
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
