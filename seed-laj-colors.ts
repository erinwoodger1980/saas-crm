import { PrismaClient } from "./api/node_modules/.pnpm/@prisma+client@7.0.0_prisma@7.0.0_@types+react@19.2.6_react-dom@19.2.0_react@19.2.0__react@19_azvqfyy76gbumj3v3d6eou4idi/node_modules/@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || "postgresql://joineryai_db_user:eJSAzXGYPsgEY1Cm3KzjSZk1Xc2d2DLD@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db"
});

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
