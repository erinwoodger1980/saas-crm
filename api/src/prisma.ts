import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

// Prevent multiple instances in dev (important for ts-node-dev / Next.js)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error"]
        : ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Prisma middleware: on Tenant.create, ensure a dev user exists for that tenant
prisma.$use(async (params, next) => {
  const result = await next(params);
  try {
    if (params.model === 'Tenant' && params.action === 'create') {
      const tenant = result as { id: string; slug?: string | null; name?: string | null };
      if (tenant?.id) {
        // We may not always have slug on result depending on select; fetch if missing
        let slug = (tenant as any).slug as string | undefined;
        if (!slug) {
          const t = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { slug: true } });
          slug = t?.slug || undefined;
        }
        if (slug) {
          const email = `dev+${slug}@joineryai.app`;
          const exists = await prisma.user.findFirst({ where: { tenantId: tenant.id, email } });
          const passwordHash = await bcrypt.hash('DevAccess123!', 10);
          if (!exists) {
            await prisma.user.create({
              data: {
                tenantId: tenant.id,
                email,
                name: 'Developer (Dev Access)',
                role: 'owner',
                isDeveloper: true,
                signupCompleted: true,
                passwordHash,
              }
            });
            console.log(`[prisma] Created dev user ${email} for new tenant ${slug}`);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[prisma] ensure dev user failed (non-fatal):', (e as any)?.message || e);
  }
  return result;
});