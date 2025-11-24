import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

// Basic shape for create/update
interface CreateRfiBody {
  projectId: string;
  rowId?: string | null;
  columnKey: string;
  title?: string;
  message: string;
  visibleToClient?: boolean;
}

interface UpdateRfiBody {
  title?: string;
  message?: string;
  status?: string; // open | answered | closed
  visibleToClient?: boolean;
}

const router = Router();

// List RFIs by project (optionally filter status & column)
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { projectId, status, columnKey, includeClosed } = req.query as Record<string, string | undefined>;

    if (!projectId) {
      return res.status(400).json({ ok: false, error: "projectId is required" });
    }

    const rfis = await prisma.rfi.findMany({
      where: {
        tenantId,
        projectId,
        ...(status && { status }),
        ...(columnKey && { columnKey }),
        ...(includeClosed !== "true" && { NOT: { status: "closed" } }),
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ok: true, items: rfis });
  } catch (err: any) {
    console.error("List RFIs error", err);
    res.status(500).json({ ok: false, error: "Failed to list RFIs" });
  }
});

// Create RFI
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const userId = req.auth.userId;
    const body: CreateRfiBody = req.body;

    if (!body.projectId || !body.columnKey || !body.message) {
      return res.status(400).json({ ok: false, error: "projectId, columnKey, message are required" });
    }

    const rfi = await prisma.rfi.create({
      data: {
        tenantId,
        projectId: body.projectId,
        rowId: body.rowId || null,
        columnKey: body.columnKey,
        title: body.title || null,
        message: body.message,
        status: "open",
        visibleToClient: body.visibleToClient !== undefined ? body.visibleToClient : true,
        createdById: userId,
      },
    });

    res.json({ ok: true, item: rfi });
  } catch (err: any) {
    console.error("Create RFI error", err);
    res.status(500).json({ ok: false, error: "Failed to create RFI" });
  }
});

// Update RFI
router.put("/:id", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { id } = req.params;
    const body: UpdateRfiBody = req.body;

    const existing = await prisma.rfi.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "RFI not found" });
    }

    const updated = await prisma.rfi.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.message !== undefined && { message: body.message }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.visibleToClient !== undefined && { visibleToClient: body.visibleToClient }),
      },
    });

    res.json({ ok: true, item: updated });
  } catch (err: any) {
    console.error("Update RFI error", err);
    res.status(500).json({ ok: false, error: "Failed to update RFI" });
  }
});

export default router;
