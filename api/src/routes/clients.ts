// api/src/routes/clients.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

/* ------------------------------------------------------------------ */
/* Helper: auth                                                        */
/* ------------------------------------------------------------------ */

function headerString(req: any, key: string): string | undefined {
  const raw = req.headers?.[key];
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

function getAuth(req: any) {
  return {
    tenantId:
      (req.auth?.tenantId as string | undefined) ?? headerString(req, "x-tenant-id"),
    userId:
      (req.auth?.userId as string | undefined) ?? headerString(req, "x-user-id"),
    email: (req.auth?.email as string | undefined) ?? headerString(req, "x-user-email"),
  };
}

/* ------------------------------------------------------------------ */
/* GET /clients - List all clients                                    */
/* ------------------------------------------------------------------ */

router.get("/", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const clients = await prisma.client.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        email: true,
        phone: true,
        companyName: true,
        address: true,
        city: true,
        postcode: true,
        notes: true,
        tags: true,
        userId: true,
        createdAt: true,
        contacts: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isPrimary: true,
          },
          orderBy: [
            { isPrimary: "desc" },
            { createdAt: "asc" },
          ],
        },
        _count: {
          select: {
            leads: true,
            opportunities: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Note: Quotes are related through leads, so we need to count them separately
    const clientsWithCounts = await Promise.all(
      clients.map(async (client) => {
        const quotes = await prisma.opportunity.count({
          where: {
            clientId: client.id,
          },
        });

        return {
          ...client,
          _count: {
            ...client._count,
            quotes,
          },
        };
      })
    );

    res.json(clientsWithCounts);
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /clients/:id - Get single client                               */
/* ------------------------------------------------------------------ */

router.get("/:id", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const client = await prisma.client.findFirst({
      where: {
        id,
        tenantId,
      },
      select: {
        id: true,
        name: true,
        type: true,
        email: true,
        phone: true,
        companyName: true,
        address: true,
        city: true,
        postcode: true,
        notes: true,
        tags: true,
        contactPerson: true,
        country: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        linkedTenantId: true,
        linkedTenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        contacts: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            mobile: true,
            position: true,
            isPrimary: true,
            notes: true,
          },
          orderBy: [
            { isPrimary: "desc" },
            { createdAt: "asc" },
          ],
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /clients/:id/leads - Get leads for a client                   */
/* ------------------------------------------------------------------ */

router.get("/:id/leads", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const leads = await prisma.lead.findMany({
      where: {
        clientId: id,
        tenantId,
      },
      select: {
        id: true,
        number: true,
        contactName: true,
        status: true,
        estimatedValue: true,
        capturedAt: true,
      },
      orderBy: {
        capturedAt: "desc",
      },
    });

    res.json(leads);
  } catch (error) {
    console.error("Error fetching client leads:", error);
    res.status(500).json({ error: "Failed to fetch client leads" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /clients/:id/opportunities - Get opportunities for a client   */
/* ------------------------------------------------------------------ */

router.get("/:id/opportunities", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const opportunities = await prisma.opportunity.findMany({
      where: {
        clientId: id,
        lead: {
          tenantId,
        },
      },
      select: {
        id: true,
        leadId: true,
        stage: true,
        valueGBP: true,
        createdAt: true,
        lead: {
          select: {
            contactName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(opportunities);
  } catch (error) {
    console.error("Error fetching client opportunities:", error);
    res.status(500).json({ error: "Failed to fetch client opportunities" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /clients/:id/quotes - Get quotes for a client                 */
/* ------------------------------------------------------------------ */

router.get("/:id/quotes", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    // Get all opportunities for this client, then find their related quotes
    const quotes = await prisma.opportunity.findMany({
      where: {
        clientId: id,
        lead: {
          tenantId,
        },
      },
      select: {
        id: true,
        leadId: true,
        stage: true,
        valueGBP: true,
        createdAt: true,
        lead: {
          select: {
            contactName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(quotes);
  } catch (error) {
    console.error("Error fetching client quotes:", error);
    res.status(500).json({ error: "Failed to fetch client quotes" });
  }
});

/* ------------------------------------------------------------------ */
/* POST /clients - Create new client                                  */
/* ------------------------------------------------------------------ */

router.post("/", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      name,
      email,
      phone,
      mobile,
      companyName,
      address,
      city,
      postcode,
      notes,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Client name is required" });
    }

    // Check for duplicate client (same name and email)
    if (email) {
      const existing = await prisma.client.findFirst({
        where: {
          tenantId,
          name: name.trim(),
          email: email.trim(),
          isActive: true,
        },
      });

      if (existing) {
        return res.status(409).json({ 
          error: "A client with this name and email already exists" 
        });
      }
    }

    const client = await prisma.client.create({
      data: {
        tenantId,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        companyName: companyName?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        postcode: postcode?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    res.status(201).json(client);
  } catch (error) {
    console.error("Error creating client:", error);
    res.status(500).json({ error: "Failed to create client" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /clients/:id - Update client                                 */
/* ------------------------------------------------------------------ */

router.patch("/:id", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const {
      name,
      email,
      phone,
      companyName,
      address,
      city,
      postcode,
      notes,
      tags,
      type,
      linkedTenantId,
      userId: assignedUserId,
    } = req.body;

    // Verify client exists and belongs to tenant
    const existing = await prisma.client.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (companyName !== undefined) updateData.companyName = companyName?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (postcode !== undefined) updateData.postcode = postcode?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
    if (type !== undefined) updateData.type = ["trade", "public", "reseller"].includes(type) ? type : "public";
    if (linkedTenantId !== undefined) updateData.linkedTenantId = linkedTenantId || null;
    if (assignedUserId !== undefined) updateData.userId = assignedUserId ? String(assignedUserId) : null;

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
    });

    res.json(client);
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ error: "Failed to update client" });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /clients/:id - Delete (soft delete) client                  */
/* ------------------------------------------------------------------ */

router.delete("/:id", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    // Verify client exists and belongs to tenant
    const existing = await prisma.client.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Soft delete by setting isActive to false
    await prisma.client.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting client:", error);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /clients/:id/contacts - Get all contacts for a client         */
/* ------------------------------------------------------------------ */

router.get("/:id/contacts", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    // Verify client belongs to tenant
    const client = await prisma.client.findFirst({
      where: { id, tenantId },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const contacts = await prisma.clientContact.findMany({
      where: { clientId: id },
      orderBy: [
        { isPrimary: "desc" },
        { createdAt: "asc" },
      ],
    });

    res.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

/* ------------------------------------------------------------------ */
/* POST /clients/:id/contacts - Add contact to client                */
/* ------------------------------------------------------------------ */

router.post("/:id/contacts", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { name, email, phone, mobile, position, isPrimary, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Contact name is required" });
    }

    // Verify client belongs to tenant
    const client = await prisma.client.findFirst({
      where: { id, tenantId },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // If marking as primary, unset other primary contacts
    if (isPrimary) {
      await prisma.clientContact.updateMany({
        where: { clientId: id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.clientContact.create({
      data: {
        clientId: id,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        mobile: mobile?.trim() || null,
        position: position?.trim() || null,
        isPrimary: Boolean(isPrimary),
        notes: notes?.trim() || null,
      },
    });

    // Two-way sync: if this contact has an email, link/update Leads that use it.
    if (contact.email) {
      await prisma.lead.updateMany({
        where: { tenantId, email: { equals: contact.email, mode: "insensitive" } },
        data: { clientId: id, contactName: contact.name },
      });
    }

    res.status(201).json(contact);
  } catch (error) {
    console.error("Error creating contact:", error);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /clients/:id/contacts/:contactId - Update contact           */
/* ------------------------------------------------------------------ */

router.patch("/:id/contacts/:contactId", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, contactId } = req.params;
    const { name, email, phone, mobile, position, isPrimary, notes } = req.body;

    // Verify client belongs to tenant
    const client = await prisma.client.findFirst({
      where: { id, tenantId },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Verify contact belongs to client
    const existing = await prisma.clientContact.findFirst({
      where: { id: contactId, clientId: id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // If marking as primary, unset other primary contacts
    if (isPrimary && !existing.isPrimary) {
      await prisma.clientContact.updateMany({
        where: { clientId: id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (mobile !== undefined) updateData.mobile = mobile?.trim() || null;
    if (position !== undefined) updateData.position = position?.trim() || null;
    if (isPrimary !== undefined) updateData.isPrimary = Boolean(isPrimary);
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    const contact = await prisma.clientContact.update({
      where: { id: contactId },
      data: updateData,
    });

    // Two-way sync: update leads linked by the contact email.
    const oldEmail = existing.email ? String(existing.email).trim() : null;
    const newEmail = contact.email ? String(contact.email).trim() : null;
    if (oldEmail && newEmail && oldEmail.toLowerCase() !== newEmail.toLowerCase()) {
      // Contact email changed: move leads from old -> new within this client
      await prisma.lead.updateMany({
        where: { tenantId, clientId: id, email: { equals: oldEmail, mode: "insensitive" } },
        data: { email: newEmail, contactName: contact.name },
      });
    } else if (newEmail) {
      // Keep lead name in sync and ensure they point at this client
      await prisma.lead.updateMany({
        where: { tenantId, email: { equals: newEmail, mode: "insensitive" } },
        data: { clientId: id, contactName: contact.name },
      });
    }

    res.json(contact);
  } catch (error) {
    console.error("Error updating contact:", error);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /clients/:id/contacts/:contactId - Delete contact          */
/* ------------------------------------------------------------------ */

router.delete("/:id/contacts/:contactId", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, contactId } = req.params;

    // Verify client belongs to tenant
    const client = await prisma.client.findFirst({
      where: { id, tenantId },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Verify contact belongs to client
    const existing = await prisma.clientContact.findFirst({
      where: { id: contactId, clientId: id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Contact not found" });
    }

    await prisma.clientContact.delete({
      where: { id: contactId },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /clients/:id/portal-access - Get client's portal access info  */
/* ------------------------------------------------------------------ */

router.get("/:id/portal-access", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    // Verify client belongs to tenant
    const client = await prisma.client.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
      },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (!client.companyName && !client.email) {
      return res.status(400).json({ error: "Client must have a company name or email" });
    }

    // Find ClientAccount linked to this client
    const clientAccount = await prisma.clientAccount.findFirst({
      where: {
        tenantId,
        OR: [
          client.companyName ? { companyName: client.companyName } : null,
          client.email ? { email: client.email } : null,
        ].filter(Boolean) as any,
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    });

    res.json({
      hasAccess: !!clientAccount,
      clientAccount: clientAccount || null,
    });
  } catch (error) {
    console.error("Error getting portal access:", error);
    res.status(500).json({ error: "Failed to get portal access" });
  }
});

/* ------------------------------------------------------------------ */
/* POST /clients/:id/portal-access - Create portal access for client */
/* ------------------------------------------------------------------ */

router.post("/:id/portal-access", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Verify client belongs to tenant
    const client = await prisma.client.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        phone: true,
      },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (!client.companyName && !client.email) {
      return res.status(400).json({ error: "Client must have a company name or email" });
    }

    // Check if email already exists
    const existingUser = await prisma.clientUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Find or create ClientAccount
    let clientAccount = await prisma.clientAccount.findFirst({
      where: {
        tenantId,
        OR: [
          client.companyName ? { companyName: client.companyName } : null,
          client.email ? { email: client.email } : null,
        ].filter(Boolean) as any,
      },
    });

    if (!clientAccount) {
      clientAccount = await prisma.clientAccount.create({
        data: {
          tenantId,
          companyName: client.companyName || client.name,
          email: client.email || email.toLowerCase().trim(),
          phone: client.phone,
          isActive: true,
        },
      });
    }

    // Create ClientUser with hashed password
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);

    const clientUser = await prisma.clientUser.create({
      data: {
        clientAccountId: clientAccount.id,
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      clientUser,
      clientAccount,
    });
  } catch (error: any) {
    console.error("Error creating portal access:", error);
    res.status(500).json({ error: "Failed to create portal access", message: error.message });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /clients/:id/portal-access/:userId - Update portal user     */
/* ------------------------------------------------------------------ */

router.patch("/:id/portal-access/:userId", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, userId } = req.params;
    const { password, isActive, firstName, lastName } = req.body;

    // Verify client belongs to tenant
    const client = await prisma.client.findFirst({
      where: { id, tenantId },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Verify user exists and belongs to this tenant's client account
    const existingUser = await prisma.clientUser.findFirst({
      where: {
        id: userId,
        clientAccount: { tenantId },
      },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "Portal user not found" });
    }

    const updateData: any = {};
    
    if (password) {
      const bcrypt = require("bcryptjs");
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (firstName !== undefined) updateData.firstName = firstName?.trim() || null;
    if (lastName !== undefined) updateData.lastName = lastName?.trim() || null;

    const updatedUser = await prisma.clientUser.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating portal access:", error);
    res.status(500).json({ error: "Failed to update portal access" });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /clients/:id/portal-access/:userId - Delete portal user    */
/* ------------------------------------------------------------------ */

router.delete("/:id/portal-access/:userId", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, userId } = req.params;

    // Verify client belongs to tenant
    const client = await prisma.client.findFirst({
      where: { id, tenantId },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Verify user exists and belongs to this tenant's client account
    const existingUser = await prisma.clientUser.findFirst({
      where: {
        id: userId,
        clientAccount: { tenantId },
      },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "Portal user not found" });
    }

    await prisma.clientUser.delete({
      where: { id: userId },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting portal access:", error);
    res.status(500).json({ error: "Failed to delete portal access" });
  }
});

export default router;
