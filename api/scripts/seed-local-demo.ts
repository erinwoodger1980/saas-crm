import { prisma } from "../src/prisma";
import bcrypt from "bcryptjs";

async function ensureTenant(slug: string, name: string) {
  let tenant = await prisma.tenant.findFirst({ where: { slug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { slug, name } });
    console.log(`[seed-local-demo] Created tenant ${slug}`);
  } else {
    console.log(`[seed-local-demo] Using existing tenant ${slug}`);
  }
  return tenant;
}

async function ensureUser(tenantId: string, email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { tenantId, isDeveloper: true, role: "ADMIN" } });
    console.log(`[seed-local-demo] Updated user ${email}`);
    return existing;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      passwordHash,
      name: "Demo User",
      role: "owner",
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

main().finally(async () => {
  await prisma.$disconnect();
});
