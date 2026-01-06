/**
 * Sage Business Cloud Accounting API Routes
 * 
 * OAuth flow, sync, and document management for Sage integration.
 * Based on existing Gmail OAuth patterns.
 */

import express, { Response } from "express";
import { prisma } from "../prisma";
import {
  getSageConnection,
  sageRequest,
  fetchSalesInvoices,
  fetchSalesCreditNotes,
  fetchPurchaseInvoices,
  fetchPurchaseCreditNotes,
  extractOrderRef,
} from "../lib/accounting/sage-client";

const router = express.Router();

const SAGE_AUTH_BASE = "https://www.sageone.com";
const SAGE_SCOPES = "full_access"; // Adjust based on actual needs

// ============================================================================
// GET /accounting/sage/connect
// Redirect to Sage OAuth authorization
// ============================================================================
router.get("/connect", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const clientId = process.env.SAGE_CLIENT_ID;
    const redirectUri = process.env.SAGE_REDIRECT_URI || "http://localhost:4000/accounting/sage/callback";

    if (!clientId) {
      return res.status(500).json({ error: "Sage OAuth not configured" });
    }

    // Store tenantId in state for callback
    const state = Buffer.from(JSON.stringify({ tenantId })).toString("base64");

    const authUrl = new URL(`${SAGE_AUTH_BASE}/oauth2/auth`);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("scope", SAGE_SCOPES);
    authUrl.searchParams.append("state", state);

    console.log(`[Sage] Redirecting tenant ${tenantId} to Sage OAuth`);
    res.redirect(authUrl.toString());
  } catch (error: any) {
    console.error("[Sage] Connect error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /accounting/sage/callback
// OAuth callback - exchange code for tokens
// ============================================================================
router.get("/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error("[Sage] OAuth error:", error);
      return res.redirect(`/settings/accounting?error=${error}`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: "Missing code or state" });
    }

    // Decode state to get tenantId
    const stateData = JSON.parse(Buffer.from(state as string, "base64").toString());
    const tenantId = stateData.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: "Invalid state" });
    }

    const clientId = process.env.SAGE_CLIENT_ID;
    const clientSecret = process.env.SAGE_CLIENT_SECRET;
    const redirectUri = process.env.SAGE_REDIRECT_URI || "http://localhost:4000/accounting/sage/callback";

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Sage OAuth not configured" });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(`${SAGE_AUTH_BASE}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code: code as string,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[Sage] Token exchange failed:", errorText);
      return res.redirect(`/settings/accounting?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope, requested_by_id } = tokens;

    // Get business info from Sage
    let businessId = requested_by_id; // Fallback to requested_by_id
    try {
      const businessInfo = await fetch("https://api.accounting.sage.com/v3.1/user", {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      });
      
      if (businessInfo.ok) {
        const userData = await businessInfo.json();
        businessId = userData.business?.id || requested_by_id;
      }
    } catch (err) {
      console.warn("[Sage] Could not fetch business info:", err);
    }

    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    // Store or update connection
    await prisma.tenantAccountingConnection.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: "sage",
        },
      },
      create: {
        tenantId,
        provider: "sage",
        status: "active",
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        scope,
        businessId,
        region: "uk",
      },
      update: {
        status: "active",
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
        scope,
        businessId,
        updatedAt: new Date(),
      },
    });

    console.log(`[Sage] Successfully connected for tenant ${tenantId}`);
    res.redirect("/settings/accounting?connected=sage");
  } catch (error: any) {
    console.error("[Sage] Callback error:", error);
    res.redirect(`/settings/accounting?error=${encodeURIComponent(error.message)}`);
  }
});

// ============================================================================
// POST /accounting/sage/disconnect
// Disconnect Sage integration
// ============================================================================
router.post("/disconnect", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await prisma.tenantAccountingConnection.updateMany({
      where: {
        tenantId,
        provider: "sage",
      },
      data: {
        status: "disconnected",
        accessToken: null,
        refreshToken: null,
        updatedAt: new Date(),
      },
    });

    console.log(`[Sage] Disconnected for tenant ${tenantId}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Sage] Disconnect error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /accounting/sage/status
// Get connection status
// ============================================================================
router.get("/status", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const connection = await prisma.tenantAccountingConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: "sage",
        },
      },
      select: {
        id: true,
        status: true,
        businessId: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!connection) {
      return res.json({ connected: false });
    }

    res.json({
      connected: connection.status === "active",
      ...connection,
    });
  } catch (error: any) {
    console.error("[Sage] Status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /accounting/sage/sync
// Sync documents from Sage
// ============================================================================
router.post("/sync", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { fromDate, toDate } = req.body;

    console.log(`[Sage] Starting sync for tenant ${tenantId}`);

    // Default to last 90 days if no date range specified
    const defaultFromDate = fromDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const defaultToDate = toDate || new Date().toISOString().split("T")[0];

    const connection = await getSageConnection(tenantId);

    let totalSynced = 0;
    let totalAutoLinked = 0;

    // Sync sales invoices
    const salesInvoices = await fetchSalesInvoices(tenantId, {
      fromDate: defaultFromDate,
      toDate: defaultToDate,
      itemsPerPage: 200,
    });

    for (const invoice of salesInvoices.invoices) {
      const { synced, autoLinked } = await upsertAccountingDocument(
        tenantId,
        connection.id,
        "sage",
        "sales_invoice",
        invoice
      );
      if (synced) totalSynced++;
      if (autoLinked) totalAutoLinked++;
    }

    // Sync sales credit notes
    const salesCredits = await fetchSalesCreditNotes(tenantId, {
      fromDate: defaultFromDate,
      toDate: defaultToDate,
      itemsPerPage: 200,
    });

    for (const credit of salesCredits.credits) {
      const { synced, autoLinked } = await upsertAccountingDocument(
        tenantId,
        connection.id,
        "sage",
        "sales_credit",
        credit
      );
      if (synced) totalSynced++;
      if (autoLinked) totalAutoLinked++;
    }

    // Sync purchase invoices
    const purchaseInvoices = await fetchPurchaseInvoices(tenantId, {
      fromDate: defaultFromDate,
      toDate: defaultToDate,
      itemsPerPage: 200,
    });

    for (const invoice of purchaseInvoices.invoices) {
      const { synced, autoLinked } = await upsertAccountingDocument(
        tenantId,
        connection.id,
        "sage",
        "purchase_invoice",
        invoice
      );
      if (synced) totalSynced++;
      if (autoLinked) totalAutoLinked++;
    }

    // Sync purchase credit notes
    const purchaseCredits = await fetchPurchaseCreditNotes(tenantId, {
      fromDate: defaultFromDate,
      toDate: defaultToDate,
      itemsPerPage: 200,
    });

    for (const credit of purchaseCredits.credits) {
      const { synced, autoLinked } = await upsertAccountingDocument(
        tenantId,
        connection.id,
        "sage",
        "purchase_credit",
        credit
      );
      if (synced) totalSynced++;
      if (autoLinked) totalAutoLinked++;
    }

    // Update last sync time
    await prisma.tenantAccountingConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    console.log(`[Sage] Sync complete for tenant ${tenantId}: ${totalSynced} documents, ${totalAutoLinked} auto-linked`);

    res.json({
      success: true,
      synced: totalSynced,
      autoLinked: totalAutoLinked,
      fromDate: defaultFromDate,
      toDate: defaultToDate,
    });
  } catch (error: any) {
    console.error("[Sage] Sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Upsert accounting document and attempt auto-linking
 */
async function upsertAccountingDocument(
  tenantId: string,
  connectionId: string,
  provider: string,
  externalType: string,
  sageDoc: any
): Promise<{ synced: boolean; autoLinked: boolean }> {
  const orderRef = extractOrderRef(sageDoc.reference);
  
  let linkedEntityType: string | null = null;
  let linkedEntityId: string | null = null;
  let autoLinked = false;

  // Attempt auto-link if we found an order reference
  if (orderRef) {
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        tenantId,
        number: orderRef,
      },
      select: { id: true },
    });

    if (opportunity) {
      linkedEntityType = "opportunity";
      linkedEntityId = opportunity.id;
      autoLinked = true;
      console.log(`[Sage] Auto-linked ${externalType} ${sageDoc.invoice_number || sageDoc.id} to opportunity ${orderRef}`);
    }
  }

  await prisma.accountingDocument.upsert({
    where: {
      tenantId_provider_externalId: {
        tenantId,
        provider,
        externalId: sageDoc.id,
      },
    },
    create: {
      tenantId,
      connectionId,
      provider,
      externalId: sageDoc.id,
      externalType,
      documentNumber: sageDoc.invoice_number || sageDoc.displayed_as,
      referenceText: sageDoc.reference,
      contactName: sageDoc.contact?.name || sageDoc.contact?.displayed_as,
      currency: sageDoc.currency?.id || "GBP",
      total: sageDoc.total_amount || 0,
      tax: sageDoc.tax_amount || 0,
      net: sageDoc.net_amount || 0,
      issueDate: sageDoc.date ? new Date(sageDoc.date) : null,
      dueDate: sageDoc.due_date ? new Date(sageDoc.due_date) : null,
      updatedAtExternal: sageDoc.updated_at ? new Date(sageDoc.updated_at) : null,
      linkedEntityType,
      linkedEntityId,
      autoLinked,
      status: sageDoc.status?.id || sageDoc.status?.displayed_as,
      rawJson: sageDoc,
    },
    update: {
      documentNumber: sageDoc.invoice_number || sageDoc.displayed_as,
      referenceText: sageDoc.reference,
      contactName: sageDoc.contact?.name || sageDoc.contact?.displayed_as,
      currency: sageDoc.currency?.id || "GBP",
      total: sageDoc.total_amount || 0,
      tax: sageDoc.tax_amount || 0,
      net: sageDoc.net_amount || 0,
      issueDate: sageDoc.date ? new Date(sageDoc.date) : null,
      dueDate: sageDoc.due_date ? new Date(sageDoc.due_date) : null,
      updatedAtExternal: sageDoc.updated_at ? new Date(sageDoc.updated_at) : null,
      status: sageDoc.status?.id || sageDoc.status?.displayed_as,
      rawJson: sageDoc,
      updatedAt: new Date(),
      // Only update linking if it was auto-linked now and wasn't manually linked before
      ...(autoLinked && !linkedEntityId
        ? {
            linkedEntityType,
            linkedEntityId,
            autoLinked,
          }
        : {}),
    },
  });

  return { synced: true, autoLinked };
}

// ============================================================================
// GET /accounting/sage/unlinked
// Get unlinked documents
// ============================================================================
router.get("/unlinked", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { type } = req.query; // 'sales' or 'purchase'

    const where: any = {
      tenantId,
      provider: "sage",
      linkedEntityId: null,
    };

    if (type === "sales") {
      where.externalType = { in: ["sales_invoice", "sales_credit"] };
    } else if (type === "purchase") {
      where.externalType = { in: ["purchase_invoice", "purchase_credit"] };
    }

    const documents = await prisma.accountingDocument.findMany({
      where,
      orderBy: { issueDate: "desc" },
      take: 100,
    });

    res.json({ documents });
  } catch (error: any) {
    console.error("[Sage] Unlinked error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /accounting/sage/link
// Manually link document to opportunity
// ============================================================================
router.post("/link", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { accountingDocumentId, opportunityId } = req.body;

    if (!accountingDocumentId || !opportunityId) {
      return res.status(400).json({ error: "Missing accountingDocumentId or opportunityId" });
    }

    // Verify opportunity belongs to tenant
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        tenantId,
      },
    });

    if (!opportunity) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    // Update document
    const updated = await prisma.accountingDocument.updateMany({
      where: {
        id: accountingDocumentId,
        tenantId,
      },
      data: {
        linkedEntityType: "opportunity",
        linkedEntityId: opportunityId,
        autoLinked: false,
        updatedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    console.log(`[Sage] Manually linked document ${accountingDocumentId} to opportunity ${opportunityId}`);

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Sage] Link error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /accounting/sage/wip/:opportunityId
// Get WIP data for an opportunity
// ============================================================================
router.get("/wip/:opportunityId", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { opportunityId } = req.params;
    const { asOfDate } = req.query;

    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        tenantId,
      },
    });

    if (!opportunity) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    const dateFilter = asOfDate ? { lte: new Date(asOfDate as string) } : undefined;

    // Get sales documents (invoiced to date)
    const salesDocs = await prisma.accountingDocument.findMany({
      where: {
        tenantId,
        linkedEntityId: opportunityId,
        linkedEntityType: "opportunity",
        externalType: { in: ["sales_invoice", "sales_credit"] },
        ...(dateFilter ? { issueDate: dateFilter } : {}),
      },
    });

    let invoicedToDate = 0;
    for (const doc of salesDocs) {
      if (doc.externalType === "sales_invoice") {
        invoicedToDate = invoicedToDate + Number(doc.total);
      } else {
        // Credit notes reduce invoiced amount
        invoicedToDate = invoicedToDate - Number(doc.total);
      }
    }

    // Get purchase documents (materials invoiced to date)
    const purchaseDocs = await prisma.accountingDocument.findMany({
      where: {
        tenantId,
        linkedEntityId: opportunityId,
        linkedEntityType: "opportunity",
        externalType: { in: ["purchase_invoice", "purchase_credit"] },
        ...(dateFilter ? { issueDate: dateFilter } : {}),
      },
    });

    let materialsInvoicedToDate = 0;
    for (const doc of purchaseDocs) {
      if (doc.externalType === "purchase_invoice") {
        materialsInvoicedToDate = materialsInvoicedToDate + Number(doc.total);
      } else {
        // Credit notes reduce cost
        materialsInvoicedToDate = materialsInvoicedToDate - Number(doc.total);
      }
    }

    const contractValue = opportunity.valueGBP ? Number(opportunity.valueGBP) : 0;
    const marginToDate = invoicedToDate - materialsInvoicedToDate;

    res.json({
      opportunityId,
      contractValue,
      invoicedToDate,
      materialsInvoicedToDate,
      marginToDate,
      salesDocuments: salesDocs.length,
      purchaseDocuments: purchaseDocs.length,
    });
  } catch (error: any) {
    console.error("[Sage] WIP error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
