/**
 * Customer Portal API
 * 
 * Authenticated routes for customers to view their quotes, opportunities, and fire door jobs.
 * Customers can only see data linked to their ClientAccount.
 */

import { Router } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../prisma";
import { env } from "../env";

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const base = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, `${ts}__${base}`);
  },
});
const upload = multer({ storage });

function safeNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildSignedFileUrl(fileId: string, tenantId: string, quoteId: string): string {
  const API_BASE = (
    process.env.APP_API_URL ||
    process.env.API_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 4000}`
  ).replace(/\/$/, "");

  const token = jwt.sign({ t: tenantId, q: quoteId }, env.APP_JWT_SECRET, { expiresIn: "15m" });
  return `${API_BASE}/files/${encodeURIComponent(fileId)}?jwt=${encodeURIComponent(token)}`;
}

// Customer authentication middleware
function requireCustomerAuth(req: any, res: any, next: any) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded: any = jwt.verify(token, env.APP_JWT_SECRET);
    
    if (decoded.type !== "customer") {
      return res.status(403).json({ error: "Customer access required" });
    }

    req.customerAuth = {
      clientUserId: decoded.clientUserId,
      clientAccountId: decoded.clientAccountId,
      tenantId: decoded.tenantId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * GET /api/customer-portal/quotes
 * Get all quotes for the customer's account
 */
router.get("/quotes", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;

    const quotes = await prisma.quote.findMany({
      where: {
        clientAccountId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        totalGBP: true,
        currency: true,
        proposalPdfUrl: true,
        createdAt: true,
        updatedAt: true,
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ quotes });
  } catch (error) {
    console.error("[customer-portal/quotes] Error:", error);
    res.status(500).json({ error: "Failed to fetch quotes" });
  }
});

/**
 * GET /api/customer-portal/quotes/:id
 * Get detailed quote information
 */
router.get("/quotes/:id", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;
    const { id } = req.params;

    const quote = await prisma.quote.findFirst({
      where: {
        id,
        clientAccountId,
      },
      include: {
        lines: true,
        clientAccount: {
          select: {
            id: true,
            companyName: true,
            primaryContact: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            postcode: true,
            country: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId: quote.tenantId },
      select: {
        brandName: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        heroImageUrl: true,
        galleryImageUrls: true,
        reviewCount: true,
        reviewScore: true,
        reviewSourceLabel: true,
        quoteDefaults: true,
        testimonials: true,
        website: true,
        phone: true,
        introHtml: true,
        links: true,
      },
    });

    // Build a signed URL map for any referenced image files (line photos + moodboard).
    const fileIds = new Set<string>();
    for (const ln of quote.lines as any[]) {
      const ls: any = (ln as any)?.lineStandard || {};
      const meta: any = (ln as any)?.meta || {};
      const ids = [
        ls.photoInsideFileId,
        ls.photoOutsideFileId,
        ls.photoFileId,
        meta.imageFileId,
      ];
      for (const fid of ids) {
        if (typeof fid === "string" && fid.trim()) fileIds.add(fid.trim());
      }
    }
    const moodboardIds: any = (quote.meta as any)?.customerMoodboardFileIds;
    if (Array.isArray(moodboardIds)) {
      for (const fid of moodboardIds) {
        if (typeof fid === "string" && fid.trim()) fileIds.add(fid.trim());
      }
    }

    const imageUrlMap: Record<string, string> = {};
    for (const fid of fileIds) {
      imageUrlMap[fid] = buildSignedFileUrl(fid, quote.tenantId, quote.id);
    }

    res.json({ quote, tenantSettings, imageUrlMap });
  } catch (error) {
    console.error("[customer-portal/quotes/:id] Error:", error);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

/**
 * POST /api/customer-portal/quotes/:id/lines
 * Create a new customer-provided line item (unit price is not set by the customer).
 * Body: { description?: string; qty?: number }
 */
router.post("/quotes/:id/lines", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;
    const quoteId = String(req.params.id);
    const quote = await prisma.quote.findFirst({ where: { id: quoteId, clientAccountId } });
    if (!quote) return res.status(404).json({ error: "quote_not_found" });

    const description = typeof req.body?.description === "string" && req.body.description.trim()
      ? req.body.description.trim()
      : "Item";
    const qtyRaw = req.body?.qty;
    const qty = qtyRaw == null ? 1 : Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: "invalid_qty" });

    const last = await prisma.quoteLine.findFirst({
      where: { quoteId: quote.id },
      orderBy: [{ sortIndex: "desc" }, { id: "desc" }],
      select: { sortIndex: true },
    });
    const nextSortIndex = (last?.sortIndex ?? 0) + 1;

    const created = await prisma.quoteLine.create({
      data: {
        quoteId: quote.id,
        description,
        sortIndex: nextSortIndex,
        qty,
        unitPrice: 0,
        currency: quote.currency || "GBP",
        meta: {
          customerProvided: true,
        },
      } as any,
    });

    return res.json({ ok: true, line: created });
  } catch (error: any) {
    console.error("[customer-portal/quotes/:id/lines] Error:", error);
    return res.status(500).json({ error: "Failed to create line" });
  }
});

/**
 * PATCH /api/customer-portal/quotes/:id/lines/:lineId
 * Update a customer-facing line item fields (no pricing edits).
 * Body: { description?: string; qty?: number; lineStandard?: object }
 */
router.patch("/quotes/:id/lines/:lineId", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;
    const quoteId = String(req.params.id);
    const lineId = String(req.params.lineId);

    const quote = await prisma.quote.findFirst({ where: { id: quoteId, clientAccountId } });
    if (!quote) return res.status(404).json({ error: "quote_not_found" });

    const existing = await prisma.quoteLine.findFirst({ where: { id: lineId, quoteId: quote.id } });
    if (!existing) return res.status(404).json({ error: "line_not_found" });

    const patch: any = {};
    if (req.body?.description !== undefined) {
      const d = String(req.body.description || "").trim();
      if (!d) return res.status(400).json({ error: "invalid_description" });
      patch.description = d;
    }
    if (req.body?.qty !== undefined) {
      const q = Number(req.body.qty);
      if (!Number.isFinite(q) || q <= 0) return res.status(400).json({ error: "invalid_qty" });
      patch.qty = q;
    }
    if (req.body?.lineStandard && typeof req.body.lineStandard === "object") {
      const incoming = req.body.lineStandard as any;
      const current = ((existing as any).lineStandard as any) || {};
      patch.lineStandard = { ...current, ...incoming };
    }

    // Mark that customer has provided/updated details
    const metaCurrent: any = (existing as any).meta || {};
    patch.meta = { ...metaCurrent, customerUpdatedAt: new Date().toISOString() };

    const saved = await prisma.quoteLine.update({ where: { id: existing.id }, data: patch });
    return res.json({ ok: true, line: saved });
  } catch (error: any) {
    console.error("[customer-portal/quotes/:id/lines/:lineId] Error:", error);
    return res.status(500).json({ error: "Failed to update line" });
  }
});

/**
 * POST /api/customer-portal/quotes/:id/lines/:lineId/photo
 * Upload a photo for a line item and store fileId on lineStandard.photoOutsideFileId.
 * multipart form-data: file
 */
router.post("/quotes/:id/lines/:lineId/photo", requireCustomerAuth, upload.single("file"), async (req: any, res) => {
  try {
    const { clientAccountId, tenantId } = req.customerAuth;
    const quoteId = String(req.params.id);
    const lineId = String(req.params.lineId);

    const quote = await prisma.quote.findFirst({ where: { id: quoteId, clientAccountId } });
    if (!quote) return res.status(404).json({ error: "quote_not_found" });
    const line = await prisma.quoteLine.findFirst({ where: { id: lineId, quoteId: quote.id } });
    if (!line) return res.status(404).json({ error: "line_not_found" });

    const f = req.file as Express.Multer.File;
    if (!f) return res.status(400).json({ error: "no_file" });

    // Store in DB if configured.
    const storeUploadsInDb = String(process.env.UPLOADS_STORE_IN_DB ?? "true").toLowerCase() !== "false";
    const uploadsDbMaxBytes = (() => {
      const raw = Number(process.env.UPLOADS_DB_MAX_BYTES);
      if (Number.isFinite(raw) && raw > 0) return raw;
      return 15 * 1024 * 1024;
    })();

    let contentToStore: Buffer | undefined = undefined;
    if (storeUploadsInDb) {
      try {
        const buf = await fs.promises.readFile(f.path);
        if (buf.length <= uploadsDbMaxBytes) contentToStore = buf;
      } catch (e: any) {
        console.warn("[customer-portal line photo] Failed to read uploaded bytes:", e?.message || e);
      }
    }

    const fileRow = await prisma.uploadedFile.create({
      data: {
        tenantId,
        quoteId: quote.id,
        kind: "LINE_IMAGE" as any,
        name: (typeof f.originalname === "string" && f.originalname.trim()) ? f.originalname.trim() : "photo",
        path: path.relative(process.cwd(), f.path),
        content: contentToStore ? Uint8Array.from(contentToStore) : undefined,
        mimeType: (typeof f.mimetype === "string" && f.mimetype.trim()) ? f.mimetype : "application/octet-stream",
        sizeBytes: f.size,
      },
    });

    const ls: any = (line as any).lineStandard || {};
    const saved = await prisma.quoteLine.update({
      where: { id: line.id },
      data: {
        lineStandard: { ...ls, photoOutsideFileId: fileRow.id },
      } as any,
    });

    return res.json({ ok: true, file: fileRow, line: saved, url: buildSignedFileUrl(fileRow.id, tenantId, quote.id) });
  } catch (error: any) {
    console.error("[customer-portal/quotes/:id/lines/:lineId/photo] Error:", error);
    return res.status(500).json({ error: "upload_failed" });
  }
});

/**
 * POST /api/customer-portal/quotes/:id/moodboard
 * Upload one or more inspiration images and append their fileIds to quote.meta.customerMoodboardFileIds.
 * multipart form-data: files[]
 */
router.post("/quotes/:id/moodboard", requireCustomerAuth, upload.array("files", 10), async (req: any, res) => {
  try {
    const { clientAccountId, tenantId } = req.customerAuth;
    const quoteId = String(req.params.id);
    const quote = await prisma.quote.findFirst({ where: { id: quoteId, clientAccountId } });
    if (!quote) return res.status(404).json({ error: "quote_not_found" });

    const incomingFiles = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
    if (!incomingFiles.length) return res.status(400).json({ error: "no_files" });

    const storeUploadsInDb = String(process.env.UPLOADS_STORE_IN_DB ?? "true").toLowerCase() !== "false";
    const uploadsDbMaxBytes = (() => {
      const raw = Number(process.env.UPLOADS_DB_MAX_BYTES);
      if (Number.isFinite(raw) && raw > 0) return raw;
      return 15 * 1024 * 1024;
    })();

    const savedFiles: any[] = [];
    for (const f of incomingFiles) {
      let contentToStore: Buffer | undefined = undefined;
      if (storeUploadsInDb) {
        try {
          const buf = await fs.promises.readFile(f.path);
          if (buf.length <= uploadsDbMaxBytes) contentToStore = buf;
        } catch (e: any) {
          console.warn("[customer-portal moodboard] Failed to read uploaded bytes:", e?.message || e);
        }
      }

      const fileRow = await prisma.uploadedFile.create({
        data: {
          tenantId,
          quoteId: quote.id,
          kind: "OTHER" as any,
          name: (typeof f.originalname === "string" && f.originalname.trim()) ? f.originalname.trim() : "moodboard",
          path: path.relative(process.cwd(), f.path),
          content: contentToStore ? Uint8Array.from(contentToStore) : undefined,
          mimeType: (typeof f.mimetype === "string" && f.mimetype.trim()) ? f.mimetype : "application/octet-stream",
          sizeBytes: f.size,
        },
      });
      savedFiles.push(fileRow);
    }

    const meta: any = (quote.meta as any) || {};
    const prev: any[] = Array.isArray(meta.customerMoodboardFileIds) ? meta.customerMoodboardFileIds : [];
    const nextIds = [...prev, ...savedFiles.map((f) => f.id)];
    await prisma.quote.update({ where: { id: quote.id }, data: { meta: { ...meta, customerMoodboardFileIds: nextIds } } as any });

    const urlMap: Record<string, string> = {};
    for (const f of savedFiles) {
      urlMap[f.id] = buildSignedFileUrl(f.id, tenantId, quote.id);
    }

    return res.json({ ok: true, files: savedFiles, imageUrlMap: urlMap });
  } catch (error: any) {
    console.error("[customer-portal/quotes/:id/moodboard] Error:", error);
    return res.status(500).json({ error: "upload_failed" });
  }
});

/**
 * GET /api/customer-portal/opportunities
 * Get all opportunities (projects) for the customer's account
 */
router.get("/opportunities", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;

    const opportunities = await prisma.opportunity.findMany({
      where: {
        clientAccountId,
      },
      select: {
        id: true,
        title: true,
        stage: true,
        valueGBP: true,
        startDate: true,
        deliveryDate: true,
        createdAt: true,
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ opportunities });
  } catch (error) {
    console.error("[customer-portal/opportunities] Error:", error);
    res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

/**
 * GET /api/customer-portal/opportunities/:id
 * Get detailed opportunity information
 */
router.get("/opportunities/:id", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;
    const { id } = req.params;

    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        clientAccountId,
      },
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
      },
    });

    if (!opportunity) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ opportunity });
  } catch (error) {
    console.error("[customer-portal/opportunities/:id] Error:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

/**
 * GET /api/customer-portal/fire-door-jobs
 * Get all fire door jobs for the customer's account
 * Includes both FireDoorClientJob records and won Opportunities
 * Returns in Fire Door Schedule format
 */
router.get("/fire-door-jobs", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;

    // Get fire door client jobs
    const fireDoorJobs = await prisma.fireDoorClientJob.findMany({
      where: {
        clientAccountId,
      },
      select: {
        id: true,
        jobName: true,
        projectReference: true,
        status: true,
        totalPrice: true,
        submittedAt: true,
        dateRequired: true,
        doorItems: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
    });

    // Get won opportunities (these are the actual fire door schedule projects)
    const opportunities = await prisma.opportunity.findMany({
      where: {
        clientAccountId,
        stage: "WON",
      },
      select: {
        id: true,
        title: true,
        number: true,
        stage: true,
        valueGBP: true,
        createdAt: true,
        deliveryDate: true,
        installationStartDate: true,
        installationEndDate: true,
        lead: {
          select: {
            id: true,
            number: true,
            custom: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Combine and format both types
    const allJobs = [
      ...fireDoorJobs.map((job) => ({
        id: job.id,
        mjsNumber: job.projectReference,
        jobName: job.jobName,
        projectReference: job.projectReference,
        status: job.status || "PENDING",
        totalPrice: job.totalPrice,
        submittedAt: job.submittedAt,
        dateRequired: job.dateRequired,
        doorItemCount: job.doorItems.length,
        type: "fire-door-job" as const,
        jobLocation: "SUBMITTED",
        signOffStatus: job.status === "APPROVED" ? "SIGNED OFF" : "PENDING",
        orderingStatus: "N/A",
        overallProgress: 0,
      })),
      ...opportunities.map((opp) => {
        const custom = opp.lead?.custom as any || {};
        return {
          id: opp.id,
          mjsNumber: opp.lead?.number || opp.number,
          jobName: opp.title,
          projectReference: opp.number,
          status: opp.stage,
          totalPrice: opp.valueGBP,
          submittedAt: opp.createdAt,
          dateRequired: opp.installationStartDate || opp.deliveryDate,
          doorItemCount: null,
          type: "opportunity" as const,
          jobLocation: custom.jobLocation || custom.Job_Location || "N/A",
          signOffStatus: custom.signOffStatus || custom.Sign_Off_Status || "N/A",
          orderingStatus: custom.orderingStatus || custom.Ordering_Status || "N/A",
          overallProgress: custom.overallProgress || custom.Overall_Progress || 0,
        };
      }),
    ];

    // Sort by submission date
    allJobs.sort((a, b) => {
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return dateB - dateA;
    });

    res.json({ jobs: allJobs });
  } catch (error) {
    console.error("[customer-portal/fire-door-jobs] Error:", error);
    res.status(500).json({ error: "Failed to fetch fire door jobs" });
  }
});

/**
 * GET /api/customer-portal/fire-door-jobs/:id
 * Get detailed fire door job information
 */
router.get("/fire-door-jobs/:id", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;
    const { id } = req.params;

    const job = await prisma.fireDoorClientJob.findFirst({
      where: {
        id,
        clientAccountId,
      },
      include: {
        doorItems: {
          orderBy: {
            sequence: "asc",
          },
        },
        rfis: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ error: "Fire door job not found" });
    }

    res.json({ job });
  } catch (error) {
    console.error("[customer-portal/fire-door-jobs/:id] Error:", error);
    res.status(500).json({ error: "Failed to fetch fire door job" });
  }
});

/**
 * GET /api/customer-portal/dashboard
 * Get dashboard summary for customer
 */
router.get("/dashboard", requireCustomerAuth, async (req: any, res) => {
  try {
    const { clientAccountId } = req.customerAuth;

    const [quoteCount, opportunityCount, fireDoorJobCount, recentQuotes, recentOpportunities] =
      await Promise.all([
        prisma.quote.count({ where: { clientAccountId } }),
        prisma.opportunity.count({ where: { clientAccountId } }),
        prisma.fireDoorClientJob.count({ where: { clientAccountId } }),
        prisma.quote.findMany({
          where: { clientAccountId },
          select: {
            id: true,
            title: true,
            status: true,
            totalGBP: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.opportunity.findMany({
          where: { clientAccountId },
          select: {
            id: true,
            title: true,
            stage: true,
            valueGBP: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

    res.json({
      summary: {
        quoteCount,
        opportunityCount,
        fireDoorJobCount,
      },
      recentQuotes,
      recentOpportunities,
    });
  } catch (error) {
    console.error("[customer-portal/dashboard] Error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

export default router;
