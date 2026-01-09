import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: [],
});

async function main() {
  try {
    // Get LAJ Joinery tenant
    const lajTenant = await prisma.tenant.findUnique({
      where: { slug: "laj-joinery" },
    });

    if (!lajTenant) {
      console.log("LAJ Joinery tenant not found");
      return;
    }

    console.log(`\nLAJ Joinery Tenant: ${lajTenant.id} (${lajTenant.name})\n`);

    // Check lookup tables for this tenant
    const lookupTables = await prisma.lookupTable.findMany({
      where: { tenantId: lajTenant.id },
    });

    console.log(`Found ${lookupTables.length} lookup tables:\n`);

    for (const table of lookupTables) {
      const rows = await prisma.lookupTableRow.count({
        where: { lookupTableId: table.id },
      });
      console.log(`  - ${table.name}: ${rows} rows`);
    }

    // Also check if there are any LookupTableRows with null or invalid lookupTableId
    const orphanedRows = await prisma.lookupTableRow.count({
      where: {
        lookupTable: {
          tenantId: lajTenant.id,
        },
      },
    });

    console.log(`\nTotal lookup table rows for LAJ: ${orphanedRows}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
