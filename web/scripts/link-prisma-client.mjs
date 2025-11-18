import { cp, mkdir, realpath, rm, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

async function main() {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const projectRoot = path.resolve(scriptDir, "..");
  const generatedDir = path.join(projectRoot, "node_modules", ".prisma");

  if (!existsSync(generatedDir)) {
    console.warn("[prisma-sync] Skipping sync – node_modules/.prisma not found");
    return;
  }

  const clientModule = path.join(projectRoot, "node_modules", "@prisma", "client");
  const realClientPath = await realpath(clientModule);
  const storePrismaDir = path.resolve(realClientPath, "..", ".prisma");

  await rm(storePrismaDir, { recursive: true, force: true });
  await mkdir(path.dirname(storePrismaDir), { recursive: true });
  await cp(generatedDir, storePrismaDir, { recursive: true });

  const clientLocalLink = path.join(clientModule, ".prisma");
  await rm(clientLocalLink, { recursive: true, force: true });
  const relativeTarget = path.relative(path.dirname(clientLocalLink), generatedDir) || "../.prisma";
  await symlink(relativeTarget, clientLocalLink, "dir");

  console.log("[prisma-sync] Prisma client artifacts synced for web workspace");
}

main().catch((error) => {
  console.error("[prisma-sync] Failed to link Prisma client", error);
  process.exitCode = 1;
});
