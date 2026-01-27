// api/src/routes/project-compliance.ts
import { Router } from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { env } from "../env";
import { FileKind } from "@prisma/client";
import { checkTjnAuthorised } from "../lib/tjn";

const router = Router();
const db: any = prisma;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function getAuth(req: any) {
  const tenantId = req.auth?.tenantId as string | undefined;
  const userId = req.auth?.userId as string | undefined;
  if (!tenantId || !userId) return null;
  return { tenantId, userId };
}

function buildCompliancePackHtml(opts: {
  tenantName: string;
  projectName: string;
  projectRef?: string | null;
  fpc?: any | null;
  dops: Array<any>;
}) {
  const { tenantName, projectName, projectRef, fpc, dops } = opts;
  const fpcBlock = fpc
    ? `
      <section class="card">
        <h2>Factory Production Control (FPC)</h2>
        <div class="row"><strong>Version:</strong> ${fpc.version || ""}</div>
        <div class="row"><strong>Status:</strong> ${fpc.status || ""}</div>
        <div class="row"><strong>Issued:</strong> ${fpc.issuedAt ? new Date(fpc.issuedAt).toLocaleDateString() : ""}</div>
        <div class="row"><strong>Expires:</strong> ${fpc.expiresAt ? new Date(fpc.expiresAt).toLocaleDateString() : ""}</div>
        ${fpc.details ? `<pre>${JSON.stringify(fpc.details, null, 2)}</pre>` : ""}
      </section>
    `
    : `
      <section class="card">
        <h2>Factory Production Control (FPC)</h2>
        <p>No FPC record linked.</p>
      </section>
    `;

  const dopBlocks = dops.length
    ? dops
        .map(
          (dop) => `
        <section class="card">
          <h2>Declaration of Performance (DoP)</h2>
          <div class="row"><strong>Product Type:</strong> ${dop.productType?.name || dop.productTypeId}</div>
          <div class="row"><strong>Version:</strong> ${dop.version || ""}</div>
          <div class="row"><strong>Status:</strong> ${dop.status || ""}</div>
          <div class="row"><strong>Issued:</strong> ${dop.issuedAt ? new Date(dop.issuedAt).toLocaleDateString() : ""}</div>
          <div class="row"><strong>Expires:</strong> ${dop.expiresAt ? new Date(dop.expiresAt).toLocaleDateString() : ""}</div>
          ${dop.performance ? `<pre>${JSON.stringify(dop.performance, null, 2)}</pre>` : ""}
        </section>
      `,
        )
        .join("\n")
    : `
      <section class="card">
        <h2>Declarations of Performance (DoP)</h2>
        <p>No DoP records linked.</p>
      </section>
    `;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; }
          h1 { margin: 0 0 4px; font-size: 24px; }
          h2 { margin: 0 0 8px; font-size: 16px; }
          .muted { color: #64748b; font-size: 12px; }
          .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-top: 14px; }
          .row { margin-bottom: 6px; font-size: 13px; }
          pre { background: #f8fafc; padding: 10px; border-radius: 6px; white-space: pre-wrap; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>Compliance Pack</h1>
        <div class="muted">Tenant: ${tenantName}</div>
        <div class="muted">Project: ${projectName}${projectRef ? ` (${projectRef})` : ""}</div>
        ${fpcBlock}
        ${dopBlocks}
      </body>
    </html>
  `;
}

router.get("/:projectId", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { tenantId } = auth;
    const authz = await checkTjnAuthorised(tenantId);
    if (!authz.ok) return res.status(403).json({ error: "tjn_not_authorised" });
    const projectId = String(req.params.projectId);

    const item = await db.projectCompliance.findFirst({
      where: { projectId, tenantId },
      include: { fpc: true },
    });

    return res.json({ ok: true, item });
  } catch (e: any) {
    console.error("[/project-compliance/:projectId] get failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.patch("/:projectId", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { tenantId } = auth;
    const authz = await checkTjnAuthorised(tenantId);
    if (!authz.ok) return res.status(403).json({ error: "tjn_not_authorised" });
    const projectId = String(req.params.projectId);
    const body = req.body || {};

    const existing = await db.projectCompliance.findFirst({ where: { projectId, tenantId } });
    const item = existing
      ? await db.projectCompliance.update({
          where: { id: existing.id },
          data: {
            status: body.status !== undefined ? String(body.status) : undefined,
            goodInChecks: body.goodInChecks !== undefined ? body.goodInChecks : undefined,
            fpcId: body.fpcId !== undefined ? (body.fpcId ? String(body.fpcId) : null) : undefined,
            metadata: body.metadata !== undefined ? body.metadata : undefined,
          },
        })
      : await db.projectCompliance.create({
          data: {
            tenantId,
            projectId,
            status: body.status ? String(body.status) : "IN_PROGRESS",
            goodInChecks: body.goodInChecks ?? undefined,
            fpcId: body.fpcId ? String(body.fpcId) : undefined,
            metadata: body.metadata ?? undefined,
          },
        });

    return res.json({ ok: true, item });
  } catch (e: any) {
    console.error("[/project-compliance/:projectId] update failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/:projectId/signoff", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { tenantId, userId } = auth;
    const authz = await checkTjnAuthorised(tenantId);
    if (!authz.ok) return res.status(403).json({ error: "tjn_not_authorised" });
    const projectId = String(req.params.projectId);

    const existing = await db.projectCompliance.findFirst({ where: { projectId, tenantId } });
    if (!existing) return res.status(404).json({ error: "not_found" });

    const item = await db.projectCompliance.update({
      where: { id: existing.id },
      data: {
        status: "SIGNED_OFF",
        signedOffAt: new Date(),
        signedByUserId: userId,
      },
    });

    return res.json({ ok: true, item });
  } catch (e: any) {
    console.error("[/project-compliance/:projectId/signoff] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/:projectId/compliance-pack", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { tenantId } = auth;
    const authz = await checkTjnAuthorised(tenantId);
    if (!authz.ok) return res.status(403).json({ error: "tjn_not_authorised" });
    const projectId = String(req.params.projectId);
    const body = req.body || {};

    const project = await db.project.findFirst({ where: { id: projectId, tenantId } });
    if (!project) return res.status(404).json({ error: "not_found" });

    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const compliance = await db.projectCompliance.findFirst({ where: { projectId, tenantId } });

    const productTypeIds = Array.isArray(body.productTypeIds)
      ? body.productTypeIds.map(String)
      : Array.isArray((project.metadata as any)?.productTypeIds)
        ? (project.metadata as any).productTypeIds.map(String)
        : [];

    const [fpc, dops] = await Promise.all([
      compliance?.fpcId
        ? db.fpc.findFirst({ where: { id: compliance.fpcId, tenantId } })
        : db.fpc.findFirst({ where: { tenantId, status: "ACTIVE" }, orderBy: [{ createdAt: "desc" }] }),
      productTypeIds.length
        ? db.doP.findMany({
            where: { tenantId, productTypeId: { in: productTypeIds } },
            include: { productType: true },
          })
        : Promise.resolve([]),
    ]);

    // Generate PDF
    let puppeteer: any;
    try {
      // @ts-ignore
      puppeteer = require("puppeteer");
    } catch (err: any) {
      console.error("[/project-compliance/:projectId/compliance-pack] puppeteer missing:", err?.message || err);
      return res.status(500).json({ error: "render_failed", reason: "puppeteer_not_installed" });
    }

    const html = buildCompliancePackHtml({
      tenantName: tenant?.name || "Tenant",
      projectName: project.projectName || "Project",
      projectRef: project.referenceNumber || null,
      fpc,
      dops,
    });

    const filenameSafe = `${project.projectName || project.id}`.replace(/[^\w.\-]+/g, "_");
    const filename = `${filenameSafe}__compliance_pack.pdf`;
    const filepath = path.join(UPLOAD_DIR, `${Date.now()}__${filename}`);

    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    let pdfSizeBytes = 0;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
      await page.pdf({ path: filepath, format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
      const stat = fs.statSync(filepath);
      pdfSizeBytes = stat.size;
      await page.close();
    } finally {
      await browser.close();
    }

    const fileRow = await db.uploadedFile.create({
      data: {
        tenantId,
        quoteId: null,
        kind: FileKind.OTHER,
        name: filename,
        path: path.relative(process.cwd(), filepath),
        mimeType: "application/pdf",
        sizeBytes: pdfSizeBytes,
      },
    });

    const pack = await db.compliancePack.create({
      data: {
        tenantId,
        projectId,
        fileId: fileRow.id,
        status: "GENERATED",
        metadata: {
          productTypeIds,
          fpcId: fpc?.id || null,
          dopIds: dops.map((d: any) => d.id),
        },
      },
    });

    const base = (
      process.env.APP_API_URL ||
      process.env.API_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${process.env.PORT || 4000}`
    ).replace(/\/$/, "");
    const token = jwt.sign({ t: tenantId }, env.APP_JWT_SECRET, { expiresIn: "7d" });
    const fileUrl = `${base}/files/${encodeURIComponent(fileRow.id)}?jwt=${encodeURIComponent(token)}`;

    return res.json({ ok: true, pack, fileUrl });
  } catch (e: any) {
    console.error("[/project-compliance/:projectId/compliance-pack] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
