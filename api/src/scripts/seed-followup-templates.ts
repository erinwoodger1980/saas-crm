import prisma from "../db";

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
  });

  for (const tenant of tenants) {
    const existingCount = await prisma.followUpTemplate.count({
      where: { tenantId: tenant.id },
    });

    if (existingCount > 0) {
      console.log(`Skipping tenant ${tenant.id} (already has ${existingCount} templates).`);
      continue;
    }

    await prisma.followUpTemplate.createMany({
      data: [
        {
          tenantId: tenant.id,
          key: "lead_nudge_v1a",
          variant: "lead_nudge_v1a",
          delayDays: 2,
          tone: "neutral",
          subject: "Just checking you received our quote",
          body: `Hi {{lead.firstName}},

Just checking you received our quote for {{project}}.
If you have any questions or need anything else, please let me know.

Best regards,
{{sender.name}}`,
        },
        {
          tenantId: tenant.id,
          key: "lead_nudge_v1b",
          variant: "lead_nudge_v1b",
          delayDays: 2,
          tone: "friendly",
          subject: "Ready to move forward on your windows project?",
          body: `Hey {{lead.firstName}},

Hope you're doing well! Are you ready to move forward on your {{project}}?
I'd be happy to help with the next steps whenever you're ready.

Cheers,
{{sender.name}}`,
        },
      ],
      skipDuplicates: true,
    });

    console.log(`Seeded follow-up templates for tenant ${tenant.id} (${tenant.name ?? ""}).`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
