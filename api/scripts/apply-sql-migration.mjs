import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

function normalizeDatabaseUrl(raw) {
  const url = new URL(raw);

  // Some repo scripts store Render hostnames without the region suffix.
  // From local machines DNS won't resolve them; add the common Render suffix.
  if (url.hostname.startsWith("dpg-") && !url.hostname.includes(".")) {
    url.hostname = `${url.hostname}.oregon-postgres.render.com`;
  }

  // Ensure SSL is enabled when required by the provider.
  if (!url.searchParams.get("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }

  return url.toString();
}

function pgSslOptions(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const sslmode = url.searchParams.get("sslmode");
    if (sslmode === "require" || url.hostname.endsWith(".render.com")) {
      return { rejectUnauthorized: false };
    }
  } catch {
    // ignore
  }
  return undefined;
}

function usage() {
  console.error("Usage: node scripts/apply-sql-migration.mjs <path/to/migration.sql>");
}

async function main() {
  const sqlPathArg = process.argv[2];
  if (!sqlPathArg) {
    usage();
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const normalizedDatabaseUrl = normalizeDatabaseUrl(databaseUrl);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const apiRoot = path.resolve(__dirname, "..");

  const sqlPath = path.resolve(apiRoot, sqlPathArg);
  const sql = await fs.readFile(sqlPath, "utf8");

  const client = new Client({
    connectionString: normalizedDatabaseUrl,
    ssl: pgSslOptions(normalizedDatabaseUrl),
  });

  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`✅ Applied SQL migration: ${path.relative(apiRoot, sqlPath)}`);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failures
    }
    console.error("❌ Migration failed:", err?.message || err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err?.message || err);
  process.exit(1);
});
