import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function authTenantId(req: any): string | null {
  return req.auth?.tenantId || null;
}

// GET /software-profiles - List all software profiles for tenant
router.get("/", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const profiles = await prisma.softwareProfile.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });

    return res.json({ ok: true, items: profiles });
  } catch (e: any) {
    console.error("[GET /software-profiles] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// POST /software-profiles - Create a new software profile
router.post("/", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { name, displayName, matchHints } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name_required" });
    }

    if (!displayName || typeof displayName !== "string") {
      return res.status(400).json({ error: "displayName_required" });
    }

    // Normalize name to lowercase alphanumeric with underscores
    const normalizedName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

    // Check for duplicate
    const existing = await prisma.softwareProfile.findFirst({
      where: { tenantId, name: normalizedName },
    });

    if (existing) {
      return res.status(409).json({ error: "name_already_exists" });
    }

    // Validate matchHints if provided
    let matchHintsJson: string | null = null;
    if (matchHints) {
      try {
        matchHintsJson = JSON.stringify(matchHints);
      } catch {
        return res.status(400).json({ error: "invalid_match_hints" });
      }
    }

    const profile = await prisma.softwareProfile.create({
      data: {
        tenantId,
        name: normalizedName,
        displayName: displayName.trim(),
        matchHints: matchHintsJson,
      },
    });

    return res.json({ ok: true, profile });
  } catch (e: any) {
    console.error("[POST /software-profiles] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// PATCH /software-profiles/:id - Update a software profile
router.patch("/:id", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { id } = req.params;
    const { displayName, matchHints } = req.body;

    // Verify ownership
    const existing = await prisma.softwareProfile.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "profile_not_found" });
    }

    const updateData: any = {};

    if (displayName !== undefined) {
      if (typeof displayName !== "string" || !displayName.trim()) {
        return res.status(400).json({ error: "invalid_displayName" });
      }
      updateData.displayName = displayName.trim();
    }

    if (matchHints !== undefined) {
      try {
        updateData.matchHints = matchHints ? JSON.stringify(matchHints) : null;
      } catch {
        return res.status(400).json({ error: "invalid_match_hints" });
      }
    }

    const profile = await prisma.softwareProfile.update({
      where: { id },
      data: updateData,
    });

    return res.json({ ok: true, profile });
  } catch (e: any) {
    console.error("[PATCH /software-profiles/:id] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// DELETE /software-profiles/:id - Delete a software profile
router.delete("/:id", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.softwareProfile.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "profile_not_found" });
    }

    await prisma.softwareProfile.delete({
      where: { id },
    });

    return res.json({ ok: true, id });
  } catch (e: any) {
    console.error("[DELETE /software-profiles/:id] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
