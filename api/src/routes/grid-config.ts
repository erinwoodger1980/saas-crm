import { Router, Request, Response } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/all", async (_req: Request, res: Response) => {
  try {
    const configs = await prisma.gridFieldConfig.findMany({
      orderBy: { fieldName: "asc" },
    });
    return res.json(configs);
  } catch (error) {
    console.error("[grid-config] GET /all failed:", error);
    return res.status(500).json({ error: "Failed to fetch grid configs" });
  }
});

router.get("/:fieldName", async (req: Request, res: Response) => {
  try {
    const { fieldName } = req.params;
    if (!fieldName) return res.status(400).json({ error: "fieldName required" });

    const config = await prisma.gridFieldConfig.findUnique({ where: { fieldName } });
    return res.json(config || {});
  } catch (error) {
    console.error("[grid-config] GET /:fieldName failed:", error);
    return res.status(500).json({ error: "Failed to fetch grid config" });
  }
});

router.post("/:fieldName", async (req: Request, res: Response) => {
  try {
    const { fieldName } = req.params;
    if (!fieldName) return res.status(400).json({ error: "fieldName required" });

    const config = req.body || {};

    const updated = await prisma.gridFieldConfig.upsert({
      where: { fieldName },
      update: {
        inputType: config.inputType,
        lookupTable: config.lookupTable,
        formula: config.formula,
        componentLink: config.componentLink,
        required: !!config.required,
      },
      create: {
        fieldName,
        inputType: config.inputType,
        lookupTable: config.lookupTable,
        formula: config.formula,
        componentLink: config.componentLink,
        required: !!config.required,
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error("[grid-config] POST /:fieldName failed:", error);
    return res.status(500).json({ error: "Failed to save grid config" });
  }
});

export default router;
