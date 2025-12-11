import { prisma } from "./src/prisma";

async function main() {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  console.log("All tables:", tables);
  await prisma.$disconnect();
}

main();
