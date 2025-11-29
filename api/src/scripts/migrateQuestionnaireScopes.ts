import prisma from "../db";
import minimist from "minimist";

type Scope = "client" | "public" | "internal" | "manufacturing";

const CANONICAL: Scope[] = ["client", "public", "internal", "manufacturing"];

// Legacy or alternative labels to migrate
const MAP_TO_PUBLIC = [
  null,
  "",
  "item",
  "questionnaire",
  "public_questionnaire",
  "PUBLIC",
  "Public",
  "Item",
  "QUESTIONNAIRE",
  "Questionnaire",
];
const MAP_TO_CLIENT = [
  "lead",
  "Lead",
  "LEAD",
  "contact",
  "Contact",
  "CONTACT",
  "client_details",
  "Client",
  "CLIENT",
];
const MAP_TO_INTERNAL = [
  "workspace",
  "Workspace",
  "WORKSPACE",
  "crm",
  "CRM",
  "internal_only",
  "Internal",
  "INTERNAL",
  "private",
  "Private",
  "PRIVATE",
];
const MAP_TO_MANUFACTURING = [
  "manufacturing",
  "Manufacturing",
  "MANUFACTURING",
  "production",
  "Production",
  "PRODUCTION",
  "post_won",
  "Post_Won",
  "POST_WON",
  "workshop",
  "Workshop",
  "WORKSHOP",
];

async function getTenantIdFromSlug(tenantSlug?: string | null): Promise<string | null> {
  if (!tenantSlug) return null;
  const t = await prisma.tenant.findFirst({ where: { slug: tenantSlug }, select: { id: true } });
  return t?.id ?? null;
}

async function updateScopesForTenant(tenantId?: string | null, apply = false) {
  const whereTenant = tenantId ? { tenantId } : {};

  let totalChanges = 0;
  const report: Array<{ from: string | null; to: Scope; count: number }> = [];

  async function doUpdate(values: Array<string | null>, to: Scope) {
    let count = 0;
    // null and "" need special handling
    const hasNull = values.some((v) => v === null);
    const hasEmpty = values.some((v) => v === "");
    const others = values.filter((v): v is string => !!v && v !== "");

    if (apply) {
      if (hasNull) {
        const r = await prisma.questionnaireField.updateMany({ where: { ...whereTenant, scope: null }, data: { scope: to } });
        count += r.count;
      }
      if (hasEmpty) {
        const r = await prisma.questionnaireField.updateMany({ where: { ...whereTenant, scope: "" }, data: { scope: to } });
        count += r.count;
      }
      for (const v of others) {
        const r = await prisma.questionnaireField.updateMany({ where: { ...whereTenant, scope: v }, data: { scope: to } });
        count += r.count;
      }
    } else {
      // Dry run: sum counts
      if (hasNull) {
        count += await prisma.questionnaireField.count({ where: { ...whereTenant, scope: null } });
      }
      if (hasEmpty) {
        count += await prisma.questionnaireField.count({ where: { ...whereTenant, scope: "" } });
      }
      if (others.length) {
        count += await prisma.questionnaireField.count({ where: { ...whereTenant, scope: { in: others } } });
      }
    }
    if (count > 0) report.push({ from: values[0] ?? null, to, count });
    totalChanges += count;
  }

  // Perform updates per target
  await doUpdate(MAP_TO_PUBLIC, "public");
  await doUpdate(MAP_TO_CLIENT, "client");
  await doUpdate(MAP_TO_INTERNAL, "internal");
  await doUpdate(MAP_TO_MANUFACTURING, "manufacturing");

  // Canonicalize casing for known scopes (e.g., "Public" -> "public")
  for (const s of CANONICAL) {
    const cap = s[0].toUpperCase() + s.slice(1);
    if (cap !== s) {
      await doUpdate([cap, cap.toUpperCase()], s);
    }
  }

  // Unknown/other values: list distinct examples for visibility
  const others = await prisma.questionnaireField.findMany({
    where: {
      ...whereTenant,
      NOT: {
        OR: [
          { scope: { in: [...CANONICAL, ""] } },
          { scope: null },
        ],
      },
    },
    select: { scope: true },
    take: 1000,
  });
  const uniqueOthers = Array.from(new Set(others.map((o) => String(o.scope)))).sort();

  return { totalChanges, report, unknownScopes: uniqueOthers };
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  const apply = Boolean(argv.apply || argv.write || argv["apply-changes"] || argv.mode === "apply");
  const tenantSlug: string | undefined = argv.tenant || argv.tenantSlug || argv.t;

  // Early exit if QuestionnaireField table does not exist (e.g., fresh dev DB not yet migrated)
  try {
    const exists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT to_regclass('public."QuestionnaireField"') IS NOT NULL as exists`
    );
    if (!exists?.[0]?.exists) {
      console.log("[migrate-scopes] QuestionnaireField table not found. Skipping scope migration.");
      return;
    }
  } catch (e) {
    console.log("[migrate-scopes] Could not verify table existence, skipping. Error:", (e as any)?.message || e);
    return;
  }

  const tenantId = await getTenantIdFromSlug(tenantSlug);
  if (tenantSlug && !tenantId) {
    console.error(`Tenant with slug '${tenantSlug}' not found.`);
    process.exit(1);
  }

  console.log(`[migrate-scopes] Mode: ${argv.mode}, apply flag: ${apply}`);
  console.log(`[migrate-scopes] Starting ${apply ? "APPLY" : "DRY-RUN"}${tenantSlug ? ` for tenant ${tenantSlug}` : " for ALL tenants"}`);
  const { totalChanges, report, unknownScopes } = await updateScopesForTenant(tenantId, apply);

  for (const r of report) {
    const fromLabel = r.from === null ? "<null/empty>" : String(r.from);
    console.log(`  ${fromLabel} -> ${r.to}: ${r.count}`);
  }
  if (unknownScopes.length) {
    console.log(`  Unknown/unmapped scope values (first ${unknownScopes.length}):`);
    for (const s of unknownScopes) console.log(`    - ${s}`);
  }
  console.log(`[migrate-scopes] ${apply ? "Updated" : "Would update"} ${totalChanges} rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
