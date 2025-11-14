import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

function authTenantId(req: any): string | null {
  return (req?.auth?.tenantId as string) || null;
}

/**
 * GET /supplier-quote-requests
 * List all supplier quote requests for the authenticated tenant
 * Supports filtering by status and supplierId
 */
router.get("/", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    const { status, supplierId } = req.query;

    const where: any = { tenantId };

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const requests = await prisma.supplierQuoteRequest.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactPerson: true,
          },
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        uploadedFile: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(requests);
  } catch (err) {
    console.error("Error fetching supplier quote requests:", err);
    res.status(500).json({ error: "Failed to fetch supplier quote requests" });
  }
});

/**
 * GET /supplier-quote-requests/:id
 * Get a single supplier quote request by ID
 */
router.get("/:id", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    const { id } = req.params;

    const request = await prisma.supplierQuoteRequest.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        supplier: true,
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            email: true,
            phone: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
            stage: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        uploadedFile: true,
      },
    });

    if (!request) {
      return res.status(404).json({ error: "Supplier quote request not found" });
    }

    res.json(request);
  } catch (err) {
    console.error("Error fetching supplier quote request:", err);
    res.status(500).json({ error: "Failed to fetch supplier quote request" });
  }
});

/**
 * POST /supplier-quote-requests
 * Create a new supplier quote request
 */
router.post("/", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    const userId = req.user?.userId;

    const { supplierId, leadId, opportunityId, notes } = req.body;

    if (!supplierId) {
      return res.status(400).json({ error: "Supplier ID is required" });
    }

    // Verify supplier belongs to tenant
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    // Verify lead belongs to tenant if provided
    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, tenantId },
      });
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
    }

    // Verify opportunity belongs to tenant if provided
    if (opportunityId) {
      const opportunity = await prisma.opportunity.findFirst({
        where: { id: opportunityId, tenantId },
      });
      if (!opportunity) {
        return res.status(404).json({ error: "Opportunity not found" });
      }
    }

    const request = await prisma.supplierQuoteRequest.create({
      data: {
        tenantId,
        supplierId,
        leadId: leadId || null,
        opportunityId: opportunityId || null,
        requestedById: userId,
        notes: notes || null,
        status: "pending",
        sentAt: new Date(),
      },
      include: {
        supplier: true,
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(request);
  } catch (err) {
    console.error("Error creating supplier quote request:", err);
    res.status(500).json({ error: "Failed to create supplier quote request" });
  }
});

/**
 * PATCH /supplier-quote-requests/:id
 * Update a supplier quote request (status, quoted amount, notes)
 */
router.patch("/:id", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    const { id } = req.params;
    const { status, quotedAmount, notes, uploadedFileId } = req.body;

    // Verify request belongs to tenant
    const existing = await prisma.supplierQuoteRequest.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Supplier quote request not found" });
    }

    const updateData: any = {};

    if (status !== undefined) {
      updateData.status = status;
      if (status === "quote_received" && !existing.receivedAt) {
        updateData.receivedAt = new Date();
      }
    }

    if (quotedAmount !== undefined) {
      updateData.quotedAmount = quotedAmount ? parseFloat(quotedAmount) : null;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (uploadedFileId !== undefined) {
      updateData.uploadedFileId = uploadedFileId || null;
    }

    const request = await prisma.supplierQuoteRequest.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        uploadedFile: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
    });

    res.json(request);
  } catch (err) {
    console.error("Error updating supplier quote request:", err);
    res.status(500).json({ error: "Failed to update supplier quote request" });
  }
});

/**
 * DELETE /supplier-quote-requests/:id
 * Delete a supplier quote request
 */
router.delete("/:id", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    const { id } = req.params;

    // Verify request belongs to tenant
    const existing = await prisma.supplierQuoteRequest.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Supplier quote request not found" });
    }

    await prisma.supplierQuoteRequest.delete({
      where: { id },
    });

    res.json({ message: "Supplier quote request deleted successfully" });
  } catch (err) {
    console.error("Error deleting supplier quote request:", err);
    res.status(500).json({ error: "Failed to delete supplier quote request" });
  }
});

/**
 * GET /supplier-quote-requests/by-supplier-email/:email
 * List all quote requests for a supplier across all tenants (for supplier portal)
 * This endpoint allows suppliers to see all their quote requests
 */
router.get("/by-supplier-email/:email", async (req: any, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find all suppliers with this email across all tenants
    const suppliers = await prisma.supplier.findMany({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (suppliers.length === 0) {
      return res.json([]);
    }

    const supplierIds = suppliers.map((s) => s.id);

    // Get all quote requests for these suppliers
    const requests = await prisma.supplierQuoteRequest.findMany({
      where: {
        supplierId: { in: supplierIds },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactPerson: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        uploadedFile: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(requests);
  } catch (err) {
    console.error("Error fetching supplier quote requests by email:", err);
    res.status(500).json({ error: "Failed to fetch supplier quote requests" });
  }
});

export default router;
