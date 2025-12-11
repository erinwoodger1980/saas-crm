import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedLAJColors() {
  const lajTenantId = "cmi58fkzm0000it43i4h78pej";
  
  const lajColors = {
    // Material statuses - matching LAJ specific setup
    "In BOM": { bg: "#fde047", text: "#854d0e" },      // Yellow
    "In BOM TBC": { bg: "#fde047", text: "#854d0e" },  // Yellow
    "Ordered": { bg: "#fb923c", text: "#7c2d12" },     // Orange
    "Received": { bg: "#86efac", text: "#14532d" },    // Green
    "Stock": { bg: "#86efac", text: "#14532d" },       // Green
    "Received from TGS": { bg: "#86efac", text: "#14532d" }, // Green
    "Received from Customer": { bg: "#86efac", text: "#14532d" }, // Green
    // Paperwork statuses  
    "In Factory": { bg: "#86efac", text: "#14532d" },  // Green
    "Printed in Office": { bg: "#86efac", text: "#14532d" }, // Green
    // Transport
    "Booked": { bg: "#86efac", text: "#14532d" },      // Green
  };

  try {
    await prisma.tenantSettings.update({
      where: { tenantId: lajTenantId },
      data: { fireDoorScheduleColors: lajColors },
    });
    
    console.log("✅ Successfully seeded LAJ default colors");
    console.log(JSON.stringify(lajColors, null, 2));
  } catch (error) {
    console.error("❌ Error seeding LAJ colors:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedLAJColors();
