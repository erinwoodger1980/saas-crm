import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const slug = process.argv[2] || "demo-tenant";
  const brandName = process.argv[3] || "Demo Co";
  // create or find tenant
  let tenant = await prisma.tenant.findFirst({ where: { name: brandName } });
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { name: brandName } });
  }

  // ensure tenantSettings exists
  let settings = await prisma.tenantSettings.findFirst({ where: { tenantId: tenant.id } });
  if (!settings) {
    settings = await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        slug,
        brandName,
        questionnaire: JSON.stringify([
          { key: "description", label: "Description", type: "textarea", askInQuestionnaire: true, showOnLead: true },
          { key: "width", label: "Width (mm)", type: "number", askInQuestionnaire: true, showOnLead: true },
          { key: "photo", label: "Photo", type: "file", askInQuestionnaire: true, showOnLead: false },
        ]),
      },
    });
  } else {
    // ensure slug set
    if (!settings.slug) {
      settings = await prisma.tenantSettings.update({ where: { id: settings.id }, data: { slug } });
    }
  }

  // create a lead
  const leadId = randomUUID();
  // ensure there's a demo user to own the lead
  let demoUser = await prisma.user.findFirst({ where: { email: "demo.user@example.test" } });
  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "demo.user@example.test",
        name: "Demo User",
        role: "owner",
        passwordHash: "",
        signupCompleted: true,
      },
    });
  }

  const lead = await prisma.lead.create({
    data: {
      id: leadId,
      tenantId: tenant.id,
      createdById: demoUser.id,
      contactName: "Demo Client",
      email: "demo.client@example.test",
      status: "NEW",
      custom: {},
    },
  });

  console.log("Seed complete:", { slug, leadId, tenantId: tenant.id });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
