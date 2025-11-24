/**
 * Client Account Utilities
 * 
 * Helpers for matching and syncing ClientAccount records with Leads/Opportunities
 * Enables reuse of customer data across fire door portal and CRM
 */

import { prisma } from "../prisma";

interface ContactInfo {
  email?: string | null;
  contactName?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
}

/**
 * Find or create ClientAccount from contact information
 * Matches by email within tenant, creates new account if not found
 */
export async function findOrCreateClientAccount(
  tenantId: string,
  contactInfo: ContactInfo
): Promise<string | null> {
  if (!contactInfo.email) {
    return null; // Cannot match without email
  }

  // Try to find existing account by email
  let clientAccount = await prisma.clientAccount.findFirst({
    where: {
      tenantId,
      email: contactInfo.email,
    },
  });

  // Create new account if not found
  if (!clientAccount) {
    clientAccount = await prisma.clientAccount.create({
      data: {
        tenantId,
        email: contactInfo.email,
        companyName: contactInfo.contactName || contactInfo.email.split("@")[0], // Fallback to email username
        primaryContact: contactInfo.contactName || undefined,
        phone: contactInfo.phone || undefined,
        address: contactInfo.address || undefined,
        city: contactInfo.city || undefined,
        postcode: contactInfo.postcode || undefined,
        isActive: true,
      },
    });
  } else {
    // Update existing account with any new information
    const updates: any = {};
    if (contactInfo.contactName && !clientAccount.primaryContact) {
      updates.primaryContact = contactInfo.contactName;
    }
    if (contactInfo.phone && !clientAccount.phone) {
      updates.phone = contactInfo.phone;
    }
    if (contactInfo.address && !clientAccount.address) {
      updates.address = contactInfo.address;
    }
    if (contactInfo.city && !clientAccount.city) {
      updates.city = contactInfo.city;
    }
    if (contactInfo.postcode && !clientAccount.postcode) {
      updates.postcode = contactInfo.postcode;
    }

    // Only update if there's something to update
    if (Object.keys(updates).length > 0) {
      clientAccount = await prisma.clientAccount.update({
        where: { id: clientAccount.id },
        data: updates,
      });
    }
  }

  return clientAccount.id;
}

/**
 * Link a Lead to its ClientAccount
 * Matches by email, creates account if needed
 */
export async function linkLeadToClientAccount(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      tenantId: true,
      clientAccountId: true,
      email: true,
      contactName: true,
    },
  });

  if (!lead || lead.clientAccountId) {
    return; // Already linked or lead not found
  }

  const clientAccountId = await findOrCreateClientAccount(lead.tenantId, {
    email: lead.email,
    contactName: lead.contactName,
  });

  if (clientAccountId) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { clientAccountId },
    });
  }
}

/**
 * Link an Opportunity to its ClientAccount
 * Uses Lead's email if available, creates account if needed
 */
export async function linkOpportunityToClientAccount(opportunityId: string): Promise<void> {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      lead: {
        select: {
          email: true,
          contactName: true,
          clientAccountId: true,
        },
      },
    },
  });

  if (!opportunity || opportunity.clientAccountId) {
    return; // Already linked or opportunity not found
  }

  // Use Lead's clientAccountId if available
  if (opportunity.lead.clientAccountId) {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { clientAccountId: opportunity.lead.clientAccountId },
    });
    return;
  }

  // Otherwise find/create from Lead data
  const clientAccountId = await findOrCreateClientAccount(opportunity.tenantId, {
    email: opportunity.lead.email,
    contactName: opportunity.lead.contactName,
  });

  if (clientAccountId) {
    // Update both opportunity and lead
    await prisma.$transaction([
      prisma.opportunity.update({
        where: { id: opportunityId },
        data: { clientAccountId },
      }),
      prisma.lead.update({
        where: { id: opportunity.leadId },
        data: { clientAccountId },
      }),
    ]);
  }
}

/**
 * Get enriched client data from ClientAccount for a Lead
 * Returns contact info from customer account if linked
 */
export async function getEnrichedLeadData(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      clientAccount: {
        select: {
          companyName: true,
          primaryContact: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          postcode: true,
          country: true,
        },
      },
    },
  });

  if (!lead) {
    return null;
  }

  // Merge Lead data with ClientAccount data (ClientAccount takes precedence)
  return {
    ...lead,
    contactName: lead.clientAccount?.primaryContact || lead.contactName,
    email: lead.clientAccount?.email || lead.email,
    phone: lead.clientAccount?.phone,
    address: lead.clientAccount?.address,
    city: lead.clientAccount?.city,
    postcode: lead.clientAccount?.postcode,
    country: lead.clientAccount?.country,
    companyName: lead.clientAccount?.companyName,
  };
}
