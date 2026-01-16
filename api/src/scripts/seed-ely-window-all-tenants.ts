import prisma from "../db";
import { ensureElyWindowForTenant } from "../services/ensure-ely-window";

function parseArgs(argv: string[]) {
  const getArg = (flag: string, def?: string) => {
    const idx = argv.findIndex((a) => a === flag || a === `--${flag}`);
    if (idx === -1) return def;
    const value = argv[idx + 1];
    return value && !value.startsWith("-") ? value : def;
  };

  const hasFlag = (flag: string) => argv.includes(flag) || argv.includes(`--${flag}`);

  return {
    onlySlug: getArg("slug"),
    onlyTenantId: getArg("tenantId") || getArg("tenant-id"),
    limit: Number(getArg("limit", "0") || "0") || 0,
    apply: hasFlag("apply") || hasFlag("yes"),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const { onlySlug, onlyTenantId, limit, apply } = parseArgs(argv);

  if (!apply) {
    console.error(
      "Refusing to run without --apply (safety). Re-run with --apply when ready."
    );
    process.exit(1);
  }

  const where: any = {};
  if (onlySlug) where.slug = onlySlug;
  if (onlyTenantId) where.id = onlyTenantId;

  const tenants = await prisma.tenant.findMany({
    where,
    select: { id: true, slug: true },
    orderBy: { createdAt: "asc" },
    ...(limit > 0 ? { take: limit } : {}),
  });

  if (tenants.length === 0) {
    console.log("No tenants matched.");
    return;
  }

  console.log(`[seed-ely-window] Updating ${tenants.length} tenant(s)...`);

  let ok = 0;
  let failed = 0;
  let settingsUpdated = 0;
  let componentsUpserted = 0;
  let assignmentsCreated = 0;

  for (const t of tenants) {
    try {
      const res = await ensureElyWindowForTenant(t.id);
      if (!res.ok) {
        failed++;
        console.warn(`[seed-ely-window] FAILED tenant ${t.slug} (${t.id})`);
        continue;
      }

      ok++;
      if (res.settingsUpdated) settingsUpdated++;
      componentsUpserted += res.componentsUpserted;
      assignmentsCreated += res.assignmentsCreated;

      console.log(
        `[seed-ely-window] OK ${t.slug}: settingsUpdated=${res.settingsUpdated} componentsUpserted=${res.componentsUpserted} assignmentsCreated=${res.assignmentsCreated}`
      );
    } catch (e: any) {
      failed++;
      console.warn(`[seed-ely-window] ERROR ${t.slug}:`, e?.message || e);
    }
  }

  console.log("[seed-ely-window] Done.");
  console.log(
    JSON.stringify(
      { ok, failed, settingsUpdated, componentsUpserted, assignmentsCreated },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
