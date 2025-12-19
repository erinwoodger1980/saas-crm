// api/src/routes/scene-state.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

/**
 * GET /api/scene-state?tenantId=...&entityType=...&entityId=...
 * Load a persisted scene configuration for a given entity.
 */
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const tenantId = String(req.query.tenantId || "");
    const entityType = String(req.query.entityType || "");
    const entityId = String(req.query.entityId || "");

    if (!tenantId || !entityType || !entityId) {
      return res.status(400).json({ error: "missing_params" });
    }

    // Enforce tenant boundary
    if (req.auth.tenantId !== tenantId) {
      return res.status(403).json({ error: "forbidden" });
    }

    const sceneState = await prisma.sceneState.findUnique({
      where: {
        tenantId_entityType_entityId: {
          tenantId,
          entityType,
          entityId,
        },
      },
      select: {
        id: true,
        config: true,
        updatedAt: true,
        modifiedBy: true,
      },
    });

    if (!sceneState) {
      return res.status(404).json({ error: "not_found" });
    }

    return res.json({
      success: true,
      data: {
        id: sceneState.id,
        config: sceneState.config,
        updatedAt: sceneState.updatedAt,
        modifiedBy: sceneState.modifiedBy,
      },
    });
  } catch (e: any) {
    console.error("[GET /api/scene-state] failed:", e?.message || e);
    return res.json({ success: true, data: null, message: "scene_state_unavailable" });
  }
});

/**
 * POST /api/scene-state
 * Body: { tenantId, entityType, entityId, config }
 * Upsert the scene configuration for the given entity.
 */
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const { tenantId, entityType, entityId, config } = req.body || {};

    if (!tenantId || !entityType || !entityId || !config) {
      return res.status(400).json({ error: "missing_fields" });
    }

    // Enforce tenant boundary
    if (req.auth.tenantId !== tenantId) {
      return res.status(403).json({ error: "forbidden" });
    }

    // Basic shape guards
    if (!config?.version || !config?.camera || !config?.dimensions) {
      return res.status(400).json({ error: "invalid_config" });
    }

    // Update timestamp and modifier
    const stampedConfig = { ...config, updatedAt: new Date().toISOString() };

    const sceneState = await prisma.sceneState.upsert({
      where: {
        tenantId_entityType_entityId: {
          tenantId,
          entityType,
          entityId,
        },
      },
      create: {
        tenantId,
        entityType,
        entityId,
        config: stampedConfig,
        modifiedBy: String(req.auth.userId || "system"),
      },
      update: {
        config: stampedConfig,
        modifiedBy: String(req.auth.userId || "system"),
      },
      select: { id: true, updatedAt: true },
    });

    return res.json({ success: true, data: sceneState });
  } catch (e: any) {
    console.error("[POST /api/scene-state] failed:", e?.message || e);
    return res.json({ success: false, message: "scene_state_persist_failed" });
  }
});

/**
 * DELETE /api/scene-state?tenantId=...&entityType=...&entityId=...
 * Remove a persisted scene configuration.
 */
router.delete("/", requireAuth, async (req: any, res) => {
  try {
    const tenantId = String(req.query.tenantId || "");
    const entityType = String(req.query.entityType || "");
    const entityId = String(req.query.entityId || "");

    if (!tenantId || !entityType || !entityId) {
      return res.status(400).json({ error: "missing_params" });
    }

    // Enforce tenant boundary
    if (req.auth.tenantId !== tenantId) {
      return res.status(403).json({ error: "forbidden" });
    }

    await prisma.sceneState.delete({
      where: {
        tenantId_entityType_entityId: {
          tenantId,
          entityType,
          entityId,
        },
      },
    });

    return res.json({ success: true });
  } catch (e: any) {
    console.error("[DELETE /api/scene-state] failed:", e?.message || e);
    return res.json({ success: false, message: "scene_state_delete_failed" });
  }
});

export default router;
