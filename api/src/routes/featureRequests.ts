import { Router } from "express";
import { FeatureCategory, FeatureStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import {
  buildPrompt,
  callOpenAI,
  validateAndApplyDiff,
  runChecks,
  createBranchAndPR,
  pushAppliedBranch,
} from "./ai/codex";

const router = Router();

function getAuthTenantId(req: any): string | null {
  return req.auth?.tenantId || req.user?.tenantId || req.headers["x-tenant-id"] || null;
}

function getAuthUserId(req: any): string | null {
  return req.auth?.userId || req.user?.id || req.headers["x-user-id"] || null;
}

function getAuthRole(req: any): string | null {
  return req.auth?.role || req.user?.role || null;
}

function isAdmin(req: any): boolean {
  const role = (getAuthRole(req) || "").toLowerCase();
  return role === "admin" || role === "superadmin";
}

function normalizeAllowedFiles(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => normalizeAllowedFiles(v))
      .filter((v): v is string => typeof v === "string" && !!v.trim());
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .flatMap((v) => normalizeAllowedFiles(v))
      .filter(Boolean);
  }
  return [];
}

function sanitizeBranchName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\-_/]/g, "-")
    .replace(/-+/g, "-")
    .replace(/\/-+/g, "/")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `feature-${Date.now()}`;
}

function extractDiffFiles(diff: string): string[] {
  const files = new Set<string>();
  const lines = diff.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      const file = line.slice(6).trim();
      if (file && file !== "/dev/null") files.add(file);
    }
  }
  return [...files];
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&")
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

function diffWithinAllowed(diff: string, allowed: string[]): boolean {
  if (!allowed.length) return true;
  const files = extractDiffFiles(diff).map((f) => f.replace(/^\/+/, ""));
  const patterns = allowed.map((g) => globToRegex(g.trim().replace(/^\/+/, "")));
  return files.every((file) => patterns.some((rx) => rx.test(file)));
}

const createSchema = z.object({
  tenantId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.nativeEnum(FeatureCategory).optional(),
  allowedFiles: z.any().optional(),
  priority: z.number().int().min(1).max(3).optional(),
});

router.post("/feature-requests", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    const body = createSchema.parse(req.body || {});
    const authTenant = getAuthTenantId(req);
    if (!authTenant || authTenant !== body.tenantId) {
      return res.status(403).json({ error: "tenant_mismatch" });
    }

    const allowed = normalizeAllowedFiles(body.allowedFiles);

    const created = await prisma.featureRequest.create({
      data: {
        tenantId: body.tenantId,
        createdByUserId: userId,
        title: body.title,
        description: body.description,
        category: body.category ?? FeatureCategory.OTHER,
        status: FeatureStatus.OPEN,
        allowedFiles: allowed.length ? allowed : undefined,
        priority: body.priority ?? null,
      },
    });

    res.json(created);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "invalid_request" });
  }
});

router.get("/feature-requests", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || null;
  const authTenant = getAuthTenantId(req);
  const admin = isAdmin(req);

  if (!admin) {
    if (!authTenant || (tenantId && tenantId !== authTenant)) {
      return res.status(403).json({ error: "tenant_mismatch" });
    }
  }

  const where: any = {};
  if (tenantId) where.tenantId = tenantId;
  if (!tenantId && !admin && authTenant) where.tenantId = authTenant;

  const items = await prisma.featureRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

router.get("/admin/feature-requests", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "admin_only" });

  const statuses = [
    FeatureStatus.OPEN,
    FeatureStatus.IN_PROGRESS,
    FeatureStatus.READY_FOR_REVIEW,
    FeatureStatus.FAILED,
  ];

  const items = await prisma.featureRequest.findMany({
    where: { status: { in: statuses } },
    orderBy: { createdAt: "asc" },
    include: {
      tenant: { select: { id: true, name: true } },
      creator: { select: { id: true, email: true, name: true } },
    },
  });
  res.json(items);
});

router.get("/feature-requests/:id", async (req, res) => {
  const admin = isAdmin(req);
  const authTenant = getAuthTenantId(req);

  const item = await prisma.featureRequest.findUnique({
    where: { id: req.params.id },
    include: {
      tenant: { select: { id: true, name: true } },
      creator: { select: { id: true, email: true, name: true } },
    },
  });

  if (!item) return res.status(404).json({ error: "not_found" });
  if (!admin && authTenant !== item.tenantId) {
    return res.status(403).json({ error: "tenant_mismatch" });
  }

  res.json(item);
});

router.post("/admin/feature-requests/:id/run-ai", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "admin_only" });

  const schema = z.object({ taskKey: z.string().min(1), extraContext: z.string().optional() });
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(req.body || {});
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "invalid_request" });
  }

  const request = await prisma.featureRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "not_found" });

  try {
    const prompt = await buildPrompt(body.taskKey, {
      id: request.id,
      title: request.title,
      description: request.description,
      category: request.category,
      allowedFiles: request.allowedFiles,
      extraContext: body.extraContext,
    });
    const diff = await callOpenAI(prompt);
    const updated = await prisma.featureRequest.update({
      where: { id: request.id },
      data: {
        patchText: diff,
        status: FeatureStatus.READY_FOR_REVIEW,
        logs: `Prompt key: ${body.taskKey}`,
      },
    });
    res.json(updated);
  } catch (err: any) {
    await prisma.featureRequest.update({
      where: { id: request.id },
      data: {
        status: FeatureStatus.FAILED,
        logs: err?.message || "ai_failed",
      },
    });
    res.status(500).json({ error: err?.message || "ai_failed" });
  }
});

router.post("/admin/feature-requests/:id/approve", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "admin_only" });

  const request = await prisma.featureRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "not_found" });
  if (!request.patchText) return res.status(400).json({ error: "missing_patch" });

  const allowed = normalizeAllowedFiles(request.allowedFiles);
  if (!diffWithinAllowed(request.patchText, allowed)) {
    return res.status(400).json({ error: "patch_outside_allowlist" });
  }

  const baseBranch = (process.env.GIT_MAIN_BRANCH || "main").trim();
  const branchName = sanitizeBranchName(
    request.branchName || `feature/${request.id.slice(0, 6)}-${Date.now().toString(36)}`,
  );

  let worktree: Awaited<ReturnType<typeof validateAndApplyDiff>> | null = null;
  try {
    worktree = await validateAndApplyDiff(
      request.patchText,
      baseBranch,
      branchName,
      `feat: ${request.title.slice(0, 80)}`,
    );
    const checks = await runChecks(worktree.worktreePath);
    const logs = checks.results
      .map((r) => `${r.ok ? "✅" : "❌"} ${r.command}\n${r.output}`)
      .join("\n\n");

    if (!checks.ok) {
      await prisma.featureRequest.update({
        where: { id: request.id },
        data: {
          status: FeatureStatus.FAILED,
          checksStatus: "failed",
          logs,
          branchName,
        },
      });
      return res.status(422).json({ error: "checks_failed", logs });
    }

    pushAppliedBranch(branchName, worktree.worktreePath);
    const pr = await createBranchAndPR(
      branchName,
      `feat: ${request.title}`,
      request.description,
    );

    const updated = await prisma.featureRequest.update({
      where: { id: request.id },
      data: {
        status: FeatureStatus.APPROVED,
        checksStatus: "passed",
        branchName,
        prUrl: pr.url,
        logs,
      },
    });

    res.json(updated);
  } catch (err: any) {
    await prisma.featureRequest.update({
      where: { id: request.id },
      data: {
        status: FeatureStatus.FAILED,
        checksStatus: "failed",
        logs: err?.message || "approve_failed",
      },
    });
    res.status(500).json({ error: err?.message || "approve_failed" });
  } finally {
    if (worktree) {
      await worktree.cleanup().catch(() => {});
    }
  }
});

router.post("/admin/feature-requests/:id/reject", async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "admin_only" });
  const schema = z.object({ reason: z.string().optional() });
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(req.body || {});
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "invalid_request" });
  }

  const request = await prisma.featureRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "not_found" });

  const updated = await prisma.featureRequest.update({
    where: { id: request.id },
    data: {
      status: FeatureStatus.REJECTED,
      logs: body.reason || null,
    },
  });
  res.json(updated);
});

export default router;
