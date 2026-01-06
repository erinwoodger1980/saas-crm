/**
 * Public Fire Door Client Portal API
 * 
 * Endpoints for public job submission without authentication.
 * Validates tenant slug and feature flag before processing.
 */

import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { findOrCreateClientAccount } from "../lib/clientAccount";

const router = Router();

/**
 * POST /api/public/fire-doors/:tenantSlug/jobs
 * 
 * Public endpoint for clients to submit fire door orders.
 * No authentication required - uses tenant slug from URL.
 * 
 * Body structure:
 * {
 *   clientInfo: {
 *     companyName: string;
 *     email: string;
 *     phone?: string;
 *     address?: string;
 *     city?: string;
 *     postcode?: string;
 *     country?: string;
 *     primaryContact?: string;
 *   },
 *   jobDetails: {
 *     jobName: string;
 *     projectReference?: string;
 *     siteAddress?: string;
 *     deliveryAddress?: string;
 *     contactName?: string;
 *     contactPhone?: string;
 *     contactEmail?: string;
 *     poNumber?: string;
 *     quoteReference?: string;
 *     dateRequired?: string (ISO date);
 *     specialInstructions?: string;
 *   },
 *   doorItems: Array<{
 *     // All 70 CSV fields as defined in schema
 *     sequence?: number;
 *     doorRef?: string;
 *     location?: string;
 *     quantity?: number;
 *     type?: string;
 *     coreType?: string;
 *     fireRating?: string;
 *     // ... etc
 *   }>
 * }
 */
router.post("/:tenantSlug/jobs", async (req, res) => {
  try {
    const { tenantSlug } = req.params;
    const { clientInfo, jobDetails, doorItems } = req.body;

    // Validate required fields
    if (!clientInfo?.companyName || !clientInfo?.email) {
      return res.status(400).json({ 
        error: "client_info_required",
        message: "Company name and email are required" 
      });
    }

    if (!jobDetails?.jobName) {
      return res.status(400).json({ 
        error: "job_name_required",
        message: "Job name is required" 
      });
    }

    if (!doorItems || !Array.isArray(doorItems) || doorItems.length === 0) {
      return res.status(400).json({ 
        error: "door_items_required",
        message: "At least one door item is required" 
      });
    }

    // Find tenant by slug and check feature flag
    const tenant = await prisma.tenant.findFirst({
      where: { 
        slug: tenantSlug
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!tenant) {
      return res.status(404).json({ 
        error: "tenant_not_found",
        message: "Company not found" 
      });
    }

    // Check if fire door portal is enabled for this tenant
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId: tenant.id },
      select: { isFireDoorManufacturer: true }
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ 
        error: "feature_not_enabled",
        message: "Fire door portal is not enabled for this company" 
      });
    }

    // Find or create ClientAccount
    const clientAccountId = await findOrCreateClientAccount(tenant.id, {
      email: clientInfo.email,
      contactName: clientInfo.companyName || clientInfo.primaryContact,
      phone: clientInfo.phone,
      address: clientInfo.address,
      city: clientInfo.city,
      postcode: clientInfo.postcode,
    });

    if (!clientAccountId) {
      return res.status(500).json({ 
        error: "account_creation_failed",
        message: "Failed to create client account" 
      });
    }

    // Create FireDoorClientJob with all door items in a transaction
    const job = await prisma.$transaction(async (tx: any) => {
      // Create the job
      const newJob = await tx.fireDoorClientJob.create({
        data: {
          tenantId: tenant.id,
          clientAccountId,
          jobName: jobDetails.jobName,
          projectReference: jobDetails.projectReference,
          siteAddress: jobDetails.siteAddress,
          deliveryAddress: jobDetails.deliveryAddress,
          contactPerson: jobDetails.contactName,
          contactPhone: jobDetails.contactPhone,
          contactEmail: jobDetails.contactEmail,
          poNumber: jobDetails.poNumber,
          quoteReference: jobDetails.quoteReference,
          dateRequired: jobDetails.dateRequired ? new Date(jobDetails.dateRequired) : null,
          clientNotes: jobDetails.specialInstructions,
          status: "PENDING_REVIEW",
          submittedAt: new Date(),
        },
      });

      // Create all door items (bulk insert is more efficient but this is clearer)
      const doorItemPromises = doorItems.map((item, index) => {
        const quantityNumber = (() => {
          if (item.quantity == null || item.quantity === "") return null;
          const n = Number.parseInt(String(item.quantity), 10);
          return Number.isFinite(n) ? n : null;
        })();

        const masterLeafWidthDecimal = (() => {
          if (item.masterLeafWidth == null || item.masterLeafWidth === "") return undefined;
          const n = Number(item.masterLeafWidth);
          return Number.isFinite(n) ? new Prisma.Decimal(String(n)) : undefined;
        })();

        const rawRowJson = item.rawRowJson ?? item;

        return tx.fireDoorClientDoorItem.create({
          data: {
            tenantId: tenant.id,
            fireDoorClientJobId: newJob.id,
            rowNumber: item.rowNumber ?? index + 1,
            sequence: String(item.sequence ?? index + 1),
            doorRef: item.doorRef,
            location: item.location,
            quantity: quantityNumber ?? undefined,
            type: item.type,
            coreType: item.coreType,
            fireRating: item.fireRating,
            acousticRating: item.acousticRating,
            configuration: item.configuration,
            masterLeafWidth: masterLeafWidthDecimal,
            hingeType: item.hingeType,
            handing: item.hingeHanding,
            comments: item.comments,
            rawRowJson,
          },
        });
      });

      await Promise.all(doorItemPromises);

      return newJob;
    });

    // Return success with job reference
    res.status(201).json({
      success: true,
      jobId: job.id,
      jobReference: job.id.slice(0, 8).toUpperCase(),
      status: job.status,
      message: `Your fire door order "${job.jobName}" has been submitted successfully. You will receive a confirmation email shortly.`,
      doorItemCount: doorItems.length,
    });

    // TODO: Send confirmation email to client
    // TODO: Trigger pricing workflow (async)
    // TODO: Notify internal team of new submission

  } catch (error) {
    console.error("[public-fire-doors] Job submission failed:", error);
    res.status(500).json({ 
      error: "submission_failed",
      message: "Failed to submit fire door order. Please try again or contact support.",
      details: process.env.NODE_ENV === "development" ? (error as Error).message : undefined
    });
  }
});

/**
 * GET /api/public/fire-doors/:tenantSlug/validate
 * 
 * Check if a tenant slug is valid and has fire door portal enabled.
 * Useful for client-side validation before showing the form.
 */
router.get("/:tenantSlug/validate", async (req, res) => {
  try {
    const { tenantSlug } = req.params;

    const tenant = await prisma.tenant.findFirst({
      where: { 
        slug: tenantSlug
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!tenant) {
      return res.status(404).json({ 
        valid: false,
        error: "tenant_not_found" 
      });
    }

    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId: tenant.id },
      select: { isFireDoorManufacturer: true }
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ 
        valid: false,
        error: "feature_not_enabled" 
      });
    }

    res.json({
      valid: true,
      tenantId: tenant.id,
      tenantName: tenant.name,
    });

  } catch (error) {
    console.error("[public-fire-doors] Validation failed:", error);
    res.status(500).json({ 
      valid: false,
      error: "validation_failed" 
    });
  }
});

export default router;
