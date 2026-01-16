import prisma from "../db";
import { ensureElyWindowForTenant } from "../services/ensure-ely-window";

function parseArgs(argv: string[]) {
  const hasFlag = (flag: string) => argv.includes(flag) || argv.includes(`--${flag}`);
  const getArg = (flag: string, def?: string) => {
    const idx = argv.findIndex((a) => a === flag || a === `--${flag}`);
    if (idx === -1) return def;
    const value = argv[idx + 1];
    return value && !value.startsWith("-") ? value : def;
  };

  return {
    apply: hasFlag("apply") || hasFlag("yes"),
    limit: Number(getArg("limit", "0") || "0") || 0,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const { apply, limit } = parseArgs(argv);

  if (!apply) {
    console.error("Refusing to run without --apply (safety)");
    process.exit(1);
  }

  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true },
    orderBy: { createdAt: "asc" },
    ...(limit > 0 ? { take: limit } : {}),
  });

  console.log(`[import-ely-f47] Processing ${tenants.length} tenant(s)...`);

  for (const t of tenants) {
    try {
      const res = await ensureElyWindowForTenant(t.id);
      console.log(
        `[import-ely-f47] ${t.slug}: ok=${res.ok} componentsUpserted=${res.componentsUpserted} assignmentsCreated=${res.assignmentsCreated}`
      );
    } catch (e: any) {
      console.warn(`[import-ely-f47] ERROR ${t.slug}:`, e?.message || e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
