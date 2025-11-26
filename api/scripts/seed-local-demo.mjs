import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureTenant(slug, name) {
  let tenant = await prisma.tenant.findFirst({ where: { slug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        isActive: true,
        settings: {},
      },
    });
    console.log(`[seed-local-demo] Created tenant ${slug}`);
  } else {
    console.log(`[seed-local-demo] Using existing tenant ${slug}`);
  }
  return tenant;
}

async function ensureUser(tenantId, email, password) {
  // If users table stores hash, we need to set a password via existing helpers or store a placeholder.
  // Here, we set isDeveloper and role=ADMIN, and set a known password hash if the schema supports it.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed-local-demo] User ${email} already exists`);
    // Ensure developer flag and tenant linkage
    await prisma.user.update({
      where: { id: existing.id },
      data: { tenantId, isDeveloper: true, role: "ADMIN" },
    });
    return existing;
  }

  // Generate a bcrypt hash for Password123!
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      passwordHash,
      firstName: "Demo",
      lastName: "User",
      role: "ADMIN",
      isActive: true,
      isDeveloper: true,
    },
  });
  console.log(`[seed-local-demo] Created user ${email}`);
  return user;
}

async function main() {
  const slug = "acme-demo";
  const name = "Acme Demo";
  const email = "demo@acme.test";
  const password = "Password123!";

  const tenant = await ensureTenant(slug, name);
  const user = await ensureUser(tenant.id, email, password);

  console.log(`[seed-local-demo] Done. TenantId=${tenant.id}, UserId=${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
