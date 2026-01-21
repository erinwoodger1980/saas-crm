import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from "bcrypt";

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  const email = process.argv[2] || "erin@acme.test";
  const password = process.argv[3] || "Password123!";
  const name = process.argv[4] || "Erin Woodger";

  // 1) TENANT: try to find by name; if not found, create with minimal fields
  let tenant = await prisma.tenant.findFirst({ where: { name: "ACME Ltd" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "ACME Ltd",
        // include only fields we are sure exist; avoid slug/plan/etc.
        // active is often present, but if your schema doesn't have it, remove the line below.
        // active: true,
      },
    });
  }

  // 2) USER: find by email; if not found, create with minimal required fields
  let user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: {
        email,
        name,
        tenantId: tenant.id,
        passwordHash,               // assumes password auth exists
        // signupCompleted: true,    // uncomment ONLY if your schema has this field
        // role/type/roles/earlyAdopter intentionally omitted to avoid validation errors
      },
    });
  } else {
    // Ensure the user is linked to the tenant and (optionally) has a password
    const update = {};
    if (!user.tenantId) update.tenantId = tenant.id;
    // If you want to force-set a password for an existing user, uncomment below:
    // update.passwordHash = await bcrypt.hash(password, 10);
    if (Object.keys(update).length) {
      user = await prisma.user.update({ where: { id: user.id }, data: update });
    }
  }

  console.log("✅ Bootstrapped:");
  console.log({
    tenant: { id: tenant.id, name: tenant.name },
    user: { id: user.id, email: user.email, tenantId: user.tenantId },
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });