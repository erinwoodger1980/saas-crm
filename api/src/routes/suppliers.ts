import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function authTenantId(req: any): string | null {
  return req.auth?.tenantId || null;
}

function authUserId(req: any): string | null {
  return req.auth?.userId || null;
}

// GET /suppliers - List all suppliers (global, shared across tenants)
router.get("/", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    // Show ALL suppliers, not just tenant-specific ones
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        tenant: {
          select: { name: true, slug: true }
        }
      }
    });

    return res.json({ ok: true, items: suppliers });
  } catch (e: any) {
    console.error("[GET /suppliers] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// POST /suppliers - Create a new supplier
router.post("/", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { name, contactPerson, email, phone, address, notes } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name_required" });
    }

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    return res.json({ ok: true, supplier });
  } catch (e: any) {
    console.error("[POST /suppliers] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// PATCH /suppliers/:id - Update a supplier (only creator tenant can edit)
router.patch("/:id", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { id } = req.params;
    const { name, contactPerson, email, phone, address, notes } = req.body;

    // Verify supplier belongs to the tenant that created it
    const existing = await prisma.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(403).json({ error: "can_only_edit_own_suppliers" });
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(contactPerson !== undefined && { contactPerson: contactPerson?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    });

    return res.json({ ok: true, supplier });
  } catch (e: any) {
    console.error("[PATCH /suppliers/:id] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// DELETE /suppliers/:id - Delete a supplier (only creator tenant can delete)
router.delete("/:id", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { id } = req.params;

    // Verify supplier belongs to the tenant that created it
    const existing = await prisma.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(403).json({ error: "can_only_delete_own_suppliers" });
    }

    await prisma.supplier.delete({
      where: { id },
    });

    return res.json({ ok: true, id });
  } catch (e: any) {
    console.error("[DELETE /suppliers/:id] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
