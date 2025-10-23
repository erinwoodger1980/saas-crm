import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "erin@acme.test";
  const password = process.argv[3] || "Password123!";
  const name = process.argv[4] || "Erin Woodger";

  // 1) Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "acme" },
    create: { name: "ACME Ltd", slug: "acme", active: true },
    update: {},
  });

  // 2) User (admin + early adopter)
  const passwordHash = await bcrypt.hash(password, 10);

  // Try to satisfy different schema shapes:
  const data = {
    email,
    name,
    tenantId: tenant.id,
    passwordHash,
    signupCompleted: true,
    // If your schema has role/roles/type/earlyAdopter, these will no-op if not present:
    role: "ADMIN",
    type: "EARLY_ADOPTER",
    earlyAdopter: true,
    roles: ["ADMIN", "EARLY_ADOPTER"],
  };

  const user = await prisma.user.upsert({
    where: { email },
    create: data,
    update: {
      ...data,
      // don’t overwrite password if already set
      passwordHash: undefined,
    },
  });

  console.log("✅ Bootstrapped:");
  console.log({ tenant: { id: tenant.id, name: tenant.name }, user: { id: user.id, email: user.email } });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
