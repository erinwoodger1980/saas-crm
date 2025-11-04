import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
  const now = Date.now();
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  const inferenceCutoff = daysAgo(180);
  const trainingCutoff = daysAgo(365);

  const inferenceResult = await prisma.inferenceEvent.deleteMany({
    where: {
      createdAt: { lt: inferenceCutoff },
    },
  });

  const trainingResult = await prisma.trainingRun.deleteMany({
    where: {
      createdAt: { lt: trainingCutoff },
    },
  });

  console.log(
    `🧹 Removed ${inferenceResult.count} inference events older than ${inferenceCutoff.toISOString()}`,
  );
  console.log(
    `🧹 Removed ${trainingResult.count} training runs older than ${trainingCutoff.toISOString()}`,
  );
}

main()
  .catch((error) => {
    console.error("Failed to prune ML telemetry:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

