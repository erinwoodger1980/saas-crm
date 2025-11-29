import { prisma } from "../prisma";

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { name: "Demo Tenant" } });
  if (!tenant) {
    console.error("Demo Tenant not found; run server bootstrap first");
    process.exit(1);
  }

  const slugBase = tenant.slug || "demo-tenant";

  const existing = await prisma.tenantSettings.findUnique({ where: { slug: slugBase } });
  if (existing) {
    console.log("tenantSettings already exists for slug", slugBase);
    return;
  }

  const created = await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      slug: slugBase,
      brandName: "Demo Tenant",
      introHtml: "<p>Welcome to the Demo Tenant landing page.</p>",
      questionnaire: [],
    },
  });
  console.log("Created tenantSettings", created.id, "for slug", slugBase);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
