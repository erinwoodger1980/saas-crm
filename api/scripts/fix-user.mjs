import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "erin@acme.test";
  const tenantName = process.argv[3] || "ACME Ltd";
  const newPassword = process.argv[4]; // optional to reset

  // Find ACME tenant (created earlier)
  const tenant = await prisma.tenant.findFirst({ where: { name: tenantName } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantName}`);

  // Find user
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new Error(`User not found: ${email}`);

  // 1) Ensure user is attached to ACME tenant
  let updated = await prisma.user.update({
    where: { id: user.id },
    data: { tenantId: tenant.id },
    select: { id: true, email: true, tenantId: true }
  });
  console.log("Linked user to tenant:", updated);

  // 2) Optionally reset password (ensures we know it)
  if (newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    try {
      updated = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
        select: { id: true, email: true }
      });
      console.log("Password reset OK for:", updated.email);
    } catch (e) {
      console.warn("Password reset skipped (no passwordHash field?)");
    }
  }

  // 3) Try to set helpful flags if your schema has them
  const tryUpdate = async (data, label) => {
    try {
      await prisma.user.update({ where: { id: user.id }, data });
      console.log(`Set ${label}`);
    } catch (e) {
      console.log(`Skipped ${label} (field not in schema)`);
    }
  };

  await tryUpdate({ signupCompleted: true }, "signupCompleted=true");
  await tryUpdate({ earlyAdopter: true }, "earlyAdopter=true");
  await tryUpdate({ role: "ADMIN" }, "role=ADMIN");
  // if roles is a string[]
  try {
    const u = await prisma.user.findUnique({ where: { id: user.id } });
    if (u?.roles && Array.isArray(u.roles) && !u.roles.includes("ADMIN")) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roles: [...u.roles, "ADMIN"] }
      });
      console.log("Added ADMIN to roles[]");
    }
  } catch {
    console.log("Skipped roles[] update");
  }

  console.log("✅ User fix complete");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });