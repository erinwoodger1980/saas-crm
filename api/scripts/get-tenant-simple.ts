import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function getTenant() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { name: { contains: "LAJ", mode: "insensitive" } },
          { name: { contains: "Joinery", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true },
    });

    console.log("Found tenants:", JSON.stringify(tenants, null, 2));
    
    if (tenants.length > 0) {
      console.log("\nTenant ID:", tenants[0].id);
      return tenants[0].id;
    } else {
      console.log("\nNo tenants found matching 'LAJ' or 'Joinery'");
      return null;
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

getTenant().catch(console.error);
