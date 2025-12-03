import { Client } from "pg";

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  const tenantId = process.argv[2];
  const value = (process.argv[3] ?? "true").toLowerCase() === "true";
  if (!databaseUrl || !tenantId) {
    console.error("Usage: DATABASE_URL=... tsx scripts/enable_coaching_flag.ts <tenantId> [true|false]");
    process.exit(1);
  }
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const res = await client.query(
      'UPDATE "Tenant" SET "isGroupCoachingMember" = $1 WHERE id = $2 RETURNING id, name, "isGroupCoachingMember"',
      [value, tenantId]
    );
    console.log("Updated:", res.rows[0]);
  } catch (e: any) {
    console.error("SQL error:", e?.message || e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
