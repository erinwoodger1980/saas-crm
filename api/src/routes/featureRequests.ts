import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { z } from "zod";
import { buildPrompt, callOpenAI, validateAndApplyDiff, runChecks, createBranchAndPR } from "./ai/codex";
import { minimatch } from "minimatch";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req?.auth?.tenantId || !req?.auth?.userId) return res.status(401).json({ error: "unauthorized" });
  next();
}
function isAdmin(req: any): boolean {
  const role = String(req?.auth?.role || "").toLowerCase();
  return role === "admin" || role === "owner";
}

const CreateReqSchema = z.object({
  tenantId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(3),
  category: z.enum(["UI", "COPY", "PRICING", "ANALYTICS", "INTEGRATION", "OTHER"]).optional(),
  allowedFiles: z.any().optional(),
  priority: z.number().int().min(1).max(3).optional(),
});

// POST /feature-requests
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const body = CreateReqSchema.parse(req.body || {});
    if (!isAdmin(req) && body.tenantId !== req.auth.tenantId) {
      return res.status(403).json({ error: "forbidden" });
    }
    const row = await prisma.featureRequest.create({
      data: {
        tenantId: body.tenantId,
        createdByUserId: req.auth.userId,
        title: body.title,
        description: body.description,
        category: (body.category as any) ?? "OTHER",
        allowedFiles: body.allowedFiles ?? undefined,
        priority: body.priority ?? null,
      },
    });
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || String(e) });
  }
});

// GET /feature-requests?tenantId=...
router.get("/", requireAuth, async (req: any, res) => {
  const tenantId = String((req.query?.tenantId as string) || req.auth.tenantId);
  if (!isAdmin(req) && tenantId !== req.auth.tenantId) return res.status(403).json({ error: "forbidden" });
  const rows = await prisma.featureRequest.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  res.json(rows);
});

// GET /feature-requests/:id
router.get("/:id", requireAuth, async (req: any, res) => {
  const id = String(req.params.id);
  const row = await prisma.featureRequest.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ error: "not_found" });
  if (!isAdmin(req) && row.tenantId !== req.auth.tenantId) return res.status(403).json({ error: "forbidden" });
  res.json(row);
});

// GET /admin/feature-requests
router.get("/admin/queue", requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "admin_only" });
  const rows = await prisma.featureRequest.findMany({
    where: { status: { in: ["OPEN", "IN_PROGRESS", "READY_FOR_REVIEW", "FAILED"] as any } },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

// Utility to safely list available prompt templates (admin-only)
router.get("/admin/prompt-keys", requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "admin_only" });
  try {
    const repoRoot = process.env.REPO_ROOT || path.resolve(process.cwd(), "..");
    const dir = path.join(repoRoot, "templates", "prompts");
    let keys: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      keys = entries
        .filter((e) => e.isFile() && e.name.endsWith(".prompt.txt"))
        .map((e) => e.name.replace(/\.prompt\.txt$/i, ""));
    } catch {
      keys = [];
    }
    res.json({ keys });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// POST /admin/feature-requests/:id/run-ai
router.post("/admin/:id/run-ai", requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "admin_only" });
  const id = String(req.params.id);
  const { taskKey, extraContext, dryRun } = (req.body || {}) as { taskKey?: string; extraContext?: string; dryRun?: boolean };
  if (!taskKey) return res.status(400).json({ error: "taskKey required" });
  const fr = await prisma.featureRequest.findUnique({ where: { id } });
  if (!fr) return res.status(404).json({ error: "not_found" });

  try {
    const prompt = await buildPrompt(taskKey, fr, String(extraContext || ""));
    const diff = await callOpenAI(prompt);
    if (dryRun) {
      // Do not persist anything, just return the diff for preview
      return res.json({ id: fr.id, patchText: diff, status: fr.status, dryRun: true });
    } else {
      const updated = await prisma.featureRequest.update({
        where: { id },
        data: { patchText: diff, status: "READY_FOR_REVIEW" as any, logs: `prompt:${taskKey} bytes=${diff?.length || 0}` },
      });
      return res.json(updated);
    }
  } catch (e: any) {
    const updated = await prisma.featureRequest.update({ where: { id }, data: { status: "FAILED" as any, logs: e?.message || String(e) } });
    res.status(500).json(updated);
  }
});

// POST /admin/feature-requests/:id/approve
router.post("/admin/:id/approve", requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "admin_only" });
  const id = String(req.params.id);
  const fr = await prisma.featureRequest.findUnique({ where: { id } });
  if (!fr) return res.status(404).json({ error: "not_found" });
  if (!fr.patchText) return res.status(400).json({ error: "no_patch" });

  // optional allowlist check
  const allow = Array.isArray(fr.allowedFiles) ? (fr.allowedFiles as any as string[]) : null;
  if (allow && allow.length > 0) {
    const touched = (fr.patchText.match(/\*\*\*\s+(Add|Update|Delete) File:\s+([^\n]+)/g) || [])
      .map((m) => m.split("File:")[1].trim())
      .filter(Boolean);
    const unmatched: string[] = [];
    for (const file of touched) {
      const fileOk = allow.some((glob) => {
        try {
          // Normalize simple wildcard usage; support patterns like web/src/**, api/src/routes/*.ts
          return minimatch(file, glob, { matchBase: true, nocase: true });
        } catch { return false; }
      });
      if (!fileOk) unmatched.push(file);
    }
    if (unmatched.length > 0) {
      return res.status(400).json({ error: "patch touches files outside allowlist", unmatched });
    }
  }

  const base = process.env.GIT_MAIN_BRANCH || "main";
  const branch = fr.branchName || `feat/fr-${fr.id.slice(0, 8)}`;
  try {
    await validateAndApplyDiff(fr.patchText, base, branch);
    const checks = await runChecks();
    if (!checks.ok) {
      await prisma.featureRequest.update({ where: { id }, data: { status: "FAILED" as any, checksStatus: "failed", logs: checks.errors?.slice(0, 20000) || null } });
      return res.status(400).json({ error: "checks_failed", details: checks.errors });
    }
    const prUrl = await createBranchAndPR(branch, fr.title, fr.description);
    const updated = await prisma.featureRequest.update({ where: { id }, data: { status: "APPROVED" as any, checksStatus: "passed", branchName: branch, prUrl, logs: (checks.errors || '').slice(0, 10000) } });
    res.json(updated);
  } catch (e: any) {
    await prisma.featureRequest.update({ where: { id }, data: { status: "FAILED" as any, checksStatus: "failed", logs: e?.message || String(e) } });
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// POST /admin/feature-requests/:id/reject
router.post("/admin/:id/reject", requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "admin_only" });
  const id = String(req.params.id);
  const { reason } = (req.body || {}) as { reason?: string };
  const updated = await prisma.featureRequest.update({ where: { id }, data: { status: "REJECTED" as any, logs: reason || null } });
  res.json(updated);
});

export default router;
