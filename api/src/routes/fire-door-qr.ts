import { Router } from "express";
import { prisma } from "../prisma";
import QRCode from "qrcode";

const router = Router();

function authTenantId(req: any): string | null {
  return req.auth?.tenantId || null;
}

function authUserId(req: any): string | null {
  return req.auth?.userId || null;
}

/**
 * GET /fire-door-qr/process-configs
 * Get all process QR configurations for a tenant
 */
router.get("/process-configs", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  try {
    const configs = await prisma.fireDoorProcessQRConfig.findMany({
      where: { tenantId },
      orderBy: { processName: "asc" },
    });

    res.json({ ok: true, configs });
  } catch (e: any) {
    console.error("[fire-door-qr] Failed to get process configs:", e);
    res.status(500).json({ error: e?.message || "Failed to get configs" });
  }
});

/**
 * POST /fire-door-qr/process-configs
 * Create or update a process QR configuration
 */
router.post("/process-configs", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { processName, displayFields, instructions } = req.body;

  if (!processName || !Array.isArray(displayFields)) {
    return res.status(400).json({ error: "processName and displayFields required" });
  }

  try {
    const config = await prisma.fireDoorProcessQRConfig.upsert({
      where: {
        tenantId_processName: { tenantId, processName },
      },
      create: {
        tenantId,
        processName,
        displayFields,
        instructions: instructions || null,
      },
      update: {
        displayFields,
        instructions: instructions || null,
      },
    });

    res.json({ ok: true, config });
  } catch (e: any) {
    console.error("[fire-door-qr] Failed to save config:", e);
    res.status(500).json({ error: e?.message || "Failed to save config" });
  }
});

/**
 * GET /fire-door-qr/line-item/:lineItemId/process/:processName/generate
 * Generate QR code for a line item + process combination
 */
router.get("/line-item/:lineItemId/process/:processName/generate", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { lineItemId, processName } = req.params;

  try {
    // Verify line item exists
    const lineItem = await prisma.fireDoorLineItem.findUnique({
      where: { id: lineItemId },
      include: { import: true },
    });

    if (!lineItem || lineItem.tenantId !== tenantId) {
      return res.status(404).json({ error: "Line item not found" });
    }

    // Generate QR data
    const baseUrl = process.env.WEB_PUBLIC_URL || process.env.PUBLIC_BASE_URL || "https://www.joineryai.app";
    const qrData = `${baseUrl}/fire-door-qr/${lineItemId}/${processName}`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: "M",
    });

    res.json({ ok: true, qrCodeDataUrl, qrData, lineItem: { id: lineItem.id, doorRef: lineItem.doorRef } });
  } catch (e: any) {
    console.error("[fire-door-qr] Failed to generate QR:", e);
    res.status(500).json({ error: e?.message || "Failed to generate QR" });
  }
});

/**
 * GET /fire-door-qr/door-item/:doorItemId/dispatch/generate
 * Generate dispatch/installation QR code for a door item
 */
router.get("/door-item/:doorItemId/dispatch/generate", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { doorItemId } = req.params;

  try {
    const doorItem = await prisma.fireDoorClientDoorItem.findUnique({
      where: { id: doorItemId },
      include: { job: true },
    });

    if (!doorItem || doorItem.tenantId !== tenantId) {
      return res.status(404).json({ error: "Door item not found" });
    }

    const baseUrl = process.env.WEB_PUBLIC_URL || process.env.PUBLIC_BASE_URL || "https://www.joineryai.app";
    const qrData = `${baseUrl}/fire-door-qr/dispatch/${doorItemId}`;

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: "H",
    });

    res.json({ ok: true, qrCodeDataUrl, qrData, doorItem: { id: doorItem.id, doorRef: doorItem.doorRef } });
  } catch (e: any) {
    console.error("[fire-door-qr] Failed to generate dispatch QR:", e);
    res.status(500).json({ error: e?.message || "Failed to generate QR" });
  }
});

/**
 * GET /fire-door-qr/door-item/:doorItemId/maintenance/generate
 * Generate maintenance QR code for a door item
 */
router.get("/door-item/:doorItemId/maintenance/generate", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { doorItemId } = req.params;

  try {
    const doorItem = await prisma.fireDoorClientDoorItem.findUnique({
      where: { id: doorItemId },
      include: { job: true },
    });

    if (!doorItem || doorItem.tenantId !== tenantId) {
      return res.status(404).json({ error: "Door item not found" });
    }

    const baseUrl = process.env.WEB_PUBLIC_URL || process.env.PUBLIC_BASE_URL || "https://www.joineryai.app";
    const qrData = `${baseUrl}/fire-door-qr/maintenance/${doorItemId}`;

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: "H",
    });

    res.json({ ok: true, qrCodeDataUrl, qrData, doorItem: { id: doorItem.id, doorRef: doorItem.doorRef } });
  } catch (e: any) {
    console.error("[fire-door-qr] Failed to generate maintenance QR:", e);
    res.status(500).json({ error: e?.message || "Failed to generate QR" });
  }
});

/**
 * GET /fire-door-qr/scan/:lineItemId/:processName
 * Get data for a scanned process QR code (public endpoint - no auth required)
 */
router.get("/scan/:lineItemId/:processName", async (req, res) => {
  const { lineItemId, processName } = req.params;

  try {
    const lineItem = await prisma.fireDoorLineItem.findUnique({
      where: { id: lineItemId },
      include: { import: true },
    });

    if (!lineItem) {
      return res.status(404).json({ error: "Line item not found" });
    }

    // Get process config
    const config = await prisma.fireDoorProcessQRConfig.findUnique({
      where: {
        tenantId_processName: { tenantId: lineItem.tenantId, processName },
      },
    });

    // Log the scan
    const userId = authUserId(req);
    await prisma.fireDoorQRScan.create({
      data: {
        tenantId: lineItem.tenantId,
        lineItemId,
        scanType: "PROCESS",
        processName,
        scannedBy: userId || undefined,
        deviceInfo: req.headers["user-agent"] || undefined,
      },
    });

    // Format response for frontend
    const data = {
      lineItemId: lineItem.id,
      processName,
      doorRef: lineItem.doorRef,
      lajRef: lineItem.lajRef,
      projectName: "Fire Door Project",
      config: {
        fieldsToShow: config?.displayFields || [],
        customInstructions: config?.instructions || null,
      },
      lineItemData: {
        rating: lineItem.rating,
        doorsetType: lineItem.doorsetType,
        finish: lineItem.doorFinish,
        width: lineItem.masterWidth,
        height: lineItem.doorHeight,
        thickness: lineItem.leafThickness,
        lockType: lineItem.lockType,
        hingeQty: lineItem.qtyOfHinges,
        hingeSide: lineItem.handingFinal,
        glazingType: lineItem.glazingSystem,
        notes: lineItem.notes1,
      },
    };

    res.json({
      ok: true,
      data,
    });
  } catch (e: any) {
    console.error("[fire-door-qr] Failed to process scan:", e);
    res.status(500).json({ error: e?.message || "Failed to process scan" });
  }
});

/**
 * GET /fire-door-qr/scan/dispatch/:doorItemId
 * Get data for a scanned dispatch QR code
 */
router.get("/scan/dispatch/:doorItemId", async (req, res) => {
  const { doorItemId } = req.params;

  try {
    const doorItem = await prisma.fireDoorClientDoorItem.findUnique({
      where: { id: doorItemId },
      include: { job: { include: { clientAccount: true } } },
    });

    if (!doorItem) {
      return res.status(404).json({ error: "Door item not found" });
    }

    // Log the scan
    const userId = authUserId(req);
    await prisma.fireDoorQRScan.create({
      data: {
        tenantId: doorItem.tenantId,
        doorItemId,
        scanType: "DISPATCH",
        scannedBy: userId || undefined,
        deviceInfo: req.headers["user-agent"] || undefined,
      },
    });

    res.json({
      ok: true,
      doorItem,
      scanType: "DISPATCH",
    });
  } catch (e: any) {
    console.error("[fire-door-qr] Failed to process dispatch scan:", e);
    res.status(500).json({ error: e?.message || "Failed to process scan" });
  }
});

/**
 * GET /fire-door-qr/scan/maintenance/:doorItemId
 * Get data for a scanned maintenance QR code (public endpoint - no auth required)
 */
router.get("/scan/maintenance/:doorItemId", async (req, res) => {
  const { doorItemId } = req.params;

  try {
    const doorItem = await prisma.fireDoorClientDoorItem.findUnique({
      where: { id: doorItemId },
      include: {
        job: {
          include: {
            import: true,
          },
        },
        maintenanceRecords: {
          orderBy: { performedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!doorItem) {
      return res.status(404).json({ error: "Door item not found" });
    }

    // Log the scan
    const userId = authUserId(req);
    await prisma.fireDoorQRScan.create({
      data: {
        tenantId: doorItem.tenantId,
        doorItemId,
        scanType: "MAINTENANCE",
        scannedBy: userId || undefined,
        deviceInfo: req.headers["user-agent"] || undefined,
      },
    });

    // Format response data
    const data = {
      id: doorItem.id,
      doorRef: doorItem.doorRef,
      rating: doorItem.fireRating,
      doorsetType: doorItem.type,
      finish: doorItem.doorFinish,
      location: doorItem.location,
      installationDate: doorItem.installationDate,
      lastMaintenanceDate: doorItem.lastMaintenanceDate,
      nextMaintenanceDate: doorItem.nextMaintenanceDate,
      maintenanceNotes: doorItem.maintenanceNotes,
      fittingInstructions: doorItem.fittingInstructions,
      installerNotes: doorItem.installerNotes,
      project: {
        name: "Fire Door Project",
      },
      client: null,
      maintenanceHistory: doorItem.maintenanceRecords.map((record: any) => ({
        id: record.id,
        performedAt: record.performedAt,
        performedByName: record.performedByName || "Unknown",
        findings: record.findings,
        actionsTaken: record.actionsTaken,
        photos: record.photos || [],
        nextDueDate: record.nextDueDate,
      })),
    };

    res.json({
      ok: true,
      data,
    });
  } catch (e: any) {
    console.error("[fire-door-qr] Failed to process maintenance scan:", e);
    res.status(500).json({ error: e?.message || "Failed to process scan" });
  }
});

/**
 * POST /fire-door-qr/maintenance/:doorItemId
 * Add a maintenance record for a door (public endpoint - no auth required)
 */
router.post("/maintenance/:doorItemId", async (req, res) => {
  const { doorItemId } = req.params;
  const { performedByName, findings, actionsTaken, photos, nextDueDate } = req.body;

  if (!performedByName) {
    return res.status(400).json({ error: "performedByName is required" });
  }

  try {
    const doorItem = await prisma.fireDoorClientDoorItem.findUnique({
      where: { id: doorItemId },
    });

    if (!doorItem) {
      return res.status(404).json({ error: "Door item not found" });
    }

    // Create maintenance record without requiring user auth
    const record = await prisma.fireDoorMaintenanceRecord.create({
      data: {
        tenantId: doorItem.tenantId,
        doorItemId,
        performedByName: performedByName,
        performedBy: authUserId(req) || undefined, // Optional if logged in
        maintenanceType: "INSPECTION", // Default type
        status: "COMPLETED", // Default status
        findings: findings || undefined,
        actionsTaken: actionsTaken || undefined,
        photos: photos || [],
        nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined,
      },
    });

    // Update door item maintenance dates
    await prisma.fireDoorClientDoorItem.update({
      where: { id: doorItemId },
      data: {
        lastMaintenanceDate: new Date(),
        nextMaintenanceDate: nextDueDate ? new Date(nextDueDate) : undefined,
        maintenanceNotes: findings || undefined,
      },
    });

    res.json({ ok: true, record });
  } catch (e: any) {
    console.error("[fire-door-qr] Failed to add maintenance record:", e);
    res.status(500).json({ error: e?.message || "Failed to add maintenance record" });
  }
});

/**
 * PUT /fire-door-qr/door-item/:doorItemId/fitting-instructions
 * Update fitting instructions for a door item
 */
router.put("/door-item/:doorItemId/fitting-instructions", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { doorItemId } = req.params;
  const { fittingInstructions, installerNotes } = req.body;

  try {
    const doorItem = await prisma.fireDoorClientDoorItem.update({
      where: { id: doorItemId, tenantId },
      data: {
        fittingInstructions: fittingInstructions || undefined,
        installerNotes: installerNotes || undefined,
      },
    });

    res.json({ ok: true, doorItem });
  } catch (e: any) {
    console.error("[fire-door-qr] Failed to update instructions:", e);
    res.status(500).json({ error: e?.message || "Failed to update instructions" });
  }
});

export default router;
