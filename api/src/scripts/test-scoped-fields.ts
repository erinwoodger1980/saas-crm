#!/usr/bin/env tsx
/**
 * Test script for scoped questionnaire fields system
 * Verifies:
 * - Tenant and questionnaire exist
 * - Standard fields seeded correctly
 * - Scopes normalized (client, public, internal, manufacturing)
 * - Field counts per scope
 * - API endpoints return correct data
 * 
 * This script automatically starts the API server, runs tests, and cleans up.
 * 
 * Usage:
 *   pnpm run test:scoped-fields
 *   pnpm run test:scoped-fields -- --tenant dev-tenant
 *   pnpm run test:scoped-fields -- --tenant dev-tenant --no-server (skip server management)
 */

import prisma from "../db";
import minimist from "minimist";
import fetch from "node-fetch";
import { spawn, ChildProcess } from "child_process";
import { promisify } from "util";

const sleep = promisify(setTimeout);

const API_BASE = process.env.API_BASE || "http://localhost:4000";

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function pass(name: string, details?: string) {
  results.push({ name, passed: true, details });
  console.log(`✅ ${name}${details ? `: ${details}` : ""}`);
}

function fail(name: string, error: string) {
  results.push({ name, passed: false, error });
  console.error(`❌ ${name}: ${error}`);
}

async function testDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    pass("Database connection");
  } catch (e: any) {
    fail("Database connection", e?.message || String(e));
  }
}

async function testTenantExists(slug: string) {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      fail("Tenant exists", `Tenant '${slug}' not found`);
      return null;
    }
    pass("Tenant exists", `id=${tenant.id}`);
    return tenant;
  } catch (e: any) {
    fail("Tenant exists", e?.message || String(e));
    return null;
  }
}

async function testQuestionnaireExists(tenantId: string) {
  try {
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!questionnaire) {
      fail("Active questionnaire", "No active questionnaire found");
      return null;
    }
    pass("Active questionnaire", `id=${questionnaire.id}`);
    return questionnaire;
  } catch (e: any) {
    fail("Active questionnaire", e?.message || String(e));
    return null;
  }
}

async function testStandardFields(tenantId: string) {
  try {
    const standardFields = await prisma.questionnaireField.findMany({
      where: { tenantId, isStandard: true },
      orderBy: { sortOrder: "asc" },
    });

    if (standardFields.length === 0) {
      fail("Standard fields", "No standard fields found");
      return;
    }

    pass("Standard fields", `${standardFields.length} fields found`);

    // Check for required ML fields
    const requiredKeys = ["door_width_mm", "door_height_mm", "quantity"];
    const foundKeys = new Set(standardFields.map((f) => f.key));
    const missingKeys = requiredKeys.filter((k) => !foundKeys.has(k));

    if (missingKeys.length > 0) {
      fail("Required ML fields", `Missing: ${missingKeys.join(", ")}`);
    } else {
      pass("Required ML fields", "All present");
    }
  } catch (e: any) {
    fail("Standard fields", e?.message || String(e));
  }
}

async function testScopeNormalization(tenantId: string) {
  try {
    const fields = await prisma.questionnaireField.findMany({
      where: { tenantId },
      select: { scope: true },
    });

    const validScopes = ["client", "public", "internal", "manufacturing"];
    const scopeCounts: Record<string, number> = {};
    const invalidScopes: string[] = [];

    for (const field of fields) {
      const scope = field.scope || "null";
      scopeCounts[scope] = (scopeCounts[scope] || 0) + 1;

      if (field.scope && !validScopes.includes(field.scope)) {
        invalidScopes.push(field.scope);
      }
    }

    if (invalidScopes.length > 0) {
      fail(
        "Scope normalization",
        `Invalid scopes found: ${Array.from(new Set(invalidScopes)).join(", ")}`
      );
    } else {
      pass("Scope normalization", "All scopes valid");
    }

    // Report scope distribution
    console.log("\n📊 Scope distribution:");
    for (const [scope, count] of Object.entries(scopeCounts)) {
      console.log(`   ${scope}: ${count}`);
    }
    console.log();
  } catch (e: any) {
    fail("Scope normalization", e?.message || String(e));
  }
}

async function testFieldsByScope(tenantId: string) {
  try {
    const scopes = ["client", "public", "internal", "manufacturing"] as const;
    const results: Record<string, number> = {};

    for (const scope of scopes) {
      const count = await prisma.questionnaireField.count({
        where: { tenantId, scope },
      });
      results[scope] = count;
    }

    pass("Fields by scope", JSON.stringify(results));

    // Verify at least some fields in each major scope
    if (results.public === 0) {
      fail("Public scope fields", "No public scope fields found");
    }
    if (results.client === 0) {
      fail("Client scope fields", "No client scope fields found (expected contact info)");
    }
  } catch (e: any) {
    fail("Fields by scope", e?.message || String(e));
  }
}

async function testFieldTypes(tenantId: string) {
  try {
    const fields = await prisma.questionnaireField.findMany({
      where: { tenantId },
      select: { type: true, key: true },
    });

    const validTypes = ["TEXT", "NUMBER", "SELECT", "BOOLEAN", "TEXTAREA", "DATE"];
    const invalidTypes = fields.filter((f) => !validTypes.includes(f.type));

    if (invalidTypes.length > 0) {
      fail(
        "Field types",
        `Invalid types: ${invalidTypes.map((f) => `${f.key}:${f.type}`).join(", ")}`
      );
    } else {
      pass("Field types", `All ${fields.length} fields have valid types`);
    }
  } catch (e: any) {
    fail("Field types", e?.message || String(e));
  }
}

async function testCostingInputKeys(tenantId: string) {
  try {
    const costingFields = await prisma.questionnaireField.findMany({
      where: {
        tenantId,
        costingInputKey: { not: null },
      },
      select: { key: true, costingInputKey: true },
    });

    if (costingFields.length === 0) {
      fail("Costing input keys", "No fields with costingInputKey found");
      return;
    }

    pass("Costing input keys", `${costingFields.length} costing fields`);

    // Check for required costing fields
    const requiredCostingKeys = ["door_width_mm", "door_height_mm", "quantity"];
    const foundCostingKeys = new Set(
      costingFields.map((f) => f.costingInputKey).filter(Boolean)
    );

    const missingCostingKeys = requiredCostingKeys.filter((k) => !foundCostingKeys.has(k));
    if (missingCostingKeys.length > 0) {
      fail("Required costing keys", `Missing: ${missingCostingKeys.join(", ")}`);
    } else {
      pass("Required costing keys", "All present");
    }
  } catch (e: any) {
    fail("Costing input keys", e?.message || String(e));
  }
}

async function testAPIEndpoint(tenantSlug: string) {
  try {
    // Test public endpoint (doesn't require auth)
    // Note: This endpoint uses TenantSettings.slug, not Tenant.slug
    // includeStandard=true is needed to get standard fields (default: only custom fields)
    const publicUrl = `${API_BASE}/public/tenant/${tenantSlug}/questionnaire-fields?includeStandard=true`;
    const publicRes = await fetch(publicUrl);

    if (!publicRes.ok) {
      // Try to get error details
      let errorMsg = `${publicRes.status} ${publicRes.statusText}`;
      try {
        const errorData = await publicRes.json();
        if (errorData.error) errorMsg += ` - ${errorData.error}`;
      } catch {}
      fail("Public API endpoint", errorMsg);
      return;
    }

    const publicData = await publicRes.json();
    
    // Response is an array of fields, not {fields: [...]}
    if (!Array.isArray(publicData)) {
      fail("Public API endpoint", "Response is not an array");
      return;
    }

    pass("Public API endpoint", `${publicData.length} fields returned`);

    // Check that public scope fields are returned
    const publicScopeCount = publicData.filter(
      (f: any) => f.scope === "public"
    ).length;
    
    if (publicScopeCount === 0) {
      fail("Public scope in API", "No public scope fields in response");
    } else {
      pass("Public scope in API", `${publicScopeCount} public fields`);
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg.includes("ECONNREFUSED") || msg.includes("connect")) {
      fail("API endpoint", `Server not running at ${API_BASE} (start with: pnpm run dev)`);
    } else {
      fail("API endpoint", msg);
    }
  }
}

async function testHiddenFields(tenantId: string) {
  try {
    const hiddenFields = await prisma.questionnaireField.findMany({
      where: { tenantId, isHidden: true },
      select: { key: true },
    });

    pass("Hidden fields", `${hiddenFields.length} hidden fields`);

    // Deprecated fields should be hidden
    const deprecatedKeys = ["window_style", "num_windows", "num_doors"];
    const hiddenKeys = new Set(hiddenFields.map((f) => f.key));
    const notHidden = deprecatedKeys.filter((k) => {
      const field = hiddenFields.find((f) => f.key === k);
      return field && !hiddenKeys.has(k);
    });

    if (notHidden.length > 0) {
      fail("Deprecated fields hidden", `Not hidden: ${notHidden.join(", ")}`);
    } else {
      pass("Deprecated fields hidden", "All deprecated fields properly hidden");
    }
  } catch (e: any) {
    fail("Hidden fields", e?.message || String(e));
  }
}

async function startAPIServer(): Promise<ChildProcess | null> {
  console.log("🚀 Starting API server...");
  
  const server = spawn("pnpm", ["run", "dev"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  // Capture output for debugging
  let output = "";
  server.stdout?.on("data", (data) => {
    output += data.toString();
  });
  server.stderr?.on("data", (data) => {
    output += data.toString();
  });

  // Wait for server to be ready
  const maxWait = 30000; // 30 seconds
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (response.ok) {
        console.log("✅ API server ready\n");
        return server;
      }
    } catch {
      // Server not ready yet
    }
    await sleep(500);
  }

  console.error("❌ API server failed to start within 30 seconds");
  console.error("Server output:", output);
  server.kill();
  return null;
}

function stopAPIServer(server: ChildProcess | null) {
  if (!server) return;
  
  console.log("\n🛑 Stopping API server...");
  
  // Kill the process group to ensure all child processes are terminated
  try {
    if (server.pid) {
      process.kill(-server.pid, "SIGTERM");
    }
  } catch {
    // Fallback to regular kill
    server.kill("SIGTERM");
  }
  
  // Force kill after 2 seconds if still running
  setTimeout(() => {
    try {
      if (server.pid) {
        process.kill(-server.pid, "SIGKILL");
      }
    } catch {
      server.kill("SIGKILL");
    }
  }, 2000);
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  const tenantSlug = argv.tenant || argv.t || "dev-tenant";
  const manageServer = !argv["no-server"];
  
  let apiServer: ChildProcess | null = null;

  console.log("🧪 Testing Scoped Questionnaire Fields System");
  console.log(`📍 Tenant: ${tenantSlug}`);
  console.log(`🔗 API: ${API_BASE}`);
  console.log(`🔧 Server Management: ${manageServer ? "enabled" : "disabled"}\n`);

  // Start API server if needed
  if (manageServer) {
    apiServer = await startAPIServer();
    if (!apiServer) {
      console.error("\n❌ Cannot run API tests without server");
      process.exit(1);
    }
  }

  try {
    // Run tests
    await testDatabaseConnection();

    const tenant = await testTenantExists(tenantSlug);
    if (!tenant) {
      console.error("\n❌ Cannot continue without tenant. Run seed script first:");
      console.error(`   pnpm run seed:tenant -- --slug ${tenantSlug}`);
      process.exit(1);
    }

    await testQuestionnaireExists(tenant.id);
    await testStandardFields(tenant.id);
    await testScopeNormalization(tenant.id);
    await testFieldsByScope(tenant.id);
    await testFieldTypes(tenant.id);
    await testCostingInputKeys(tenant.id);
    await testHiddenFields(tenant.id);
    await testAPIEndpoint(tenantSlug);

    // Summary
    console.log("\n" + "=".repeat(50));
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const total = results.length;

    if (failed === 0) {
      console.log(`✅ All ${total} tests passed!`);
    } else {
      console.log(`❌ ${failed}/${total} tests failed`);
      console.log("\nFailed tests:");
      results
        .filter((r) => !r.passed)
        .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
    }

    // Cleanup and exit
    if (manageServer) {
      stopAPIServer(apiServer);
      await sleep(1000); // Give time for cleanup
    }

    process.exit(failed === 0 ? 0 : 1);
  } catch (error) {
    console.error("Fatal error during tests:", error);
    if (manageServer) {
      stopAPIServer(apiServer);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  });
