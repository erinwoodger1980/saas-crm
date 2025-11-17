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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tenantCreateMiddleware = async (params: any, next: any): Promise<any> => {
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

          // Seed workshop processes from template tenant (default: Demo Tenant unless overridden)
          const templateSlug = process.env.TEMPLATE_TENANT_SLUG || undefined;
          const templateName = process.env.TEMPLATE_TENANT_NAME || 'Demo Tenant';
          const template = templateSlug
            ? await prisma.tenant.findFirst({ where: { slug: templateSlug }, select: { id: true } })
            : await prisma.tenant.findFirst({ where: { name: templateName }, select: { id: true } });
          if (template?.id) {
            const templateProcesses = await prisma.workshopProcessDefinition.findMany({
              where: { tenantId: template.id },
              orderBy: { sortOrder: 'asc' }
            });
            if (templateProcesses.length) {
              for (const p of templateProcesses) {
                try {
                  await prisma.workshopProcessDefinition.create({
                    data: {
                      tenantId: tenant.id,
                      code: p.code,
                      name: p.name,
                      sortOrder: p.sortOrder ?? 0,
                      requiredByDefault: p.requiredByDefault ?? true,
                      estimatedHours: p.estimatedHours,
                      isColorKey: p.isColorKey ?? false,
                      assignmentGroup: p.assignmentGroup || null,
                    }
                  });
                } catch (e: any) {
                  if (e?.code !== 'P2002') throw e; // skip duplicates
                }
              }
              console.log(`[prisma] Seeded ${templateProcesses.length} workshop processes for new tenant ${slug} from template ${templateSlug || templateName}`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[prisma] ensure dev user failed (non-fatal):', (e as any)?.message || e);
  }
  return result;
};

// Only register middleware if $use is available (not available in all environments)
if (typeof (prisma as any).$use === 'function') {
  (prisma as any).$use(tenantCreateMiddleware);
} else {
  console.warn('[prisma] $use middleware not available - dev user and process seeding will not run automatically on tenant creation');
}
