# Client Management System

## Overview

The Client table has been added to properly structure customer relationships in the CRM. Previously, the system created a new Lead for each inquiry, even if the customer (e.g., "MAYWINS" or "LLOYD WORRALL") already existed. This caused:

1. **Duplicate customer records** - Same customer appearing multiple times
2. **Data fragmentation** - Customer information scattered across multiple leads
3. **Unique constraint violations** - Could only create one opportunity per lead

## New Structure

### Client Model
```prisma
model Client {
  id            String        @id @default(cuid())
  tenantId      String
  name          String
  email         String?
  phone         String?
  address       String?
  city          String?
  postcode      String?
  country       String?       @default("UK")
  contactPerson String?
  companyName   String?
  isActive      Boolean       @default(true)
  notes         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  
  tenant        Tenant        @relation(fields: [tenantId], references: [id])
  leads         Lead[]
  opportunities Opportunity[]
}
```

### Relationships

**Before:**
```
Lead (1) ←→ (1) Opportunity
```

**After:**
```
Client (1) ←→ (N) Leads
Client (1) ←→ (N) Opportunities
Lead (1) ←→ (1) Opportunity
```

## Benefits

1. **Single Source of Truth** - One Client record per customer
2. **Multiple Projects** - Client can have many opportunities/leads
3. **Better Tracking** - See all projects for a customer in one place
4. **Data Integrity** - No more duplicate customer names
5. **Relationship History** - Track customer journey across multiple inquiries

## Migration Results

The system successfully migrated all existing data:

- **Total Clients Created**: 519
- **Leads Linked**: 5,681
- **Opportunities Linked**: 170

### Example Migrations

**LAJ Joinery:**
- Created 36 unique clients from 42 leads
- Customers like "MAYWINS", "LLOYD WORRALL", "MARSHDALE" now have single client records
- Multiple projects (from CSV import) now properly link to same client

**Demo Tenant:**
- Created 281 unique clients from 1,997 leads  
- Consolidated test data and seed data properly

## Usage in Code

### Creating a New Lead with Client

```typescript
// Find or create client first
let client = await prisma.client.findFirst({
  where: { 
    tenantId: tenant.id, 
    name: customerName 
  }
});

if (!client) {
  client = await prisma.client.create({
    data: {
      tenantId: tenant.id,
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    }
  });
}

// Then create lead linked to client
const lead = await prisma.lead.create({
  data: {
    tenantId: tenant.id,
    clientId: client.id,
    contactName: customerName,
    createdById: user.id,
    status: 'NEW',
  }
});
```

### Creating an Opportunity with Client

```typescript
const opportunity = await prisma.opportunity.create({
  data: {
    tenantId: tenant.id,
    leadId: lead.id,
    clientId: client.id,  // Link to client
    title: 'Project Title',
    stage: 'WON',
  }
});
```

### Querying Client with All Projects

```typescript
const client = await prisma.client.findUnique({
  where: { id: clientId },
  include: {
    leads: true,
    opportunities: {
      where: { stage: 'WON' },
      include: {
        lead: true,
        timeEntries: true,
      }
    }
  }
});

// Now you can see:
// - All leads from this client
// - All won opportunities
// - Total time/revenue across all projects
```

## API Endpoints to Update

Consider creating these new endpoints:

1. **GET /clients** - List all clients for tenant
2. **GET /clients/:id** - Get client with all leads/opportunities
3. **POST /clients** - Create new client
4. **PATCH /clients/:id** - Update client information
5. **GET /clients/:id/opportunities** - All opportunities for client
6. **GET /clients/:id/revenue** - Total revenue from client

## BOM Import Integration

The BOM import script has been updated to:

1. Check if client exists by name
2. Create client if new
3. Find or create lead linked to client
4. Create opportunity linked to both lead AND client
5. Multiple CSV rows for same customer now correctly link to same client

This prevents the duplicate opportunity errors that were occurring when importing fire door schedules.

## Future Enhancements

1. **Client Dashboard** - Show all projects, revenue, timeline for each client
2. **Client Portal** - Allow clients to log in and view their projects
3. **Client Merging** - Tools to merge duplicate clients if needed
4. **Client Tags** - Categorize clients (VIP, regular, one-time, etc.)
5. **Client Communication History** - Track all emails, calls, meetings with client
6. **Client Reporting** - Revenue by client, project count, average project value

## Database Indexes

The following indexes have been added for performance:

```sql
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");
CREATE INDEX "Client_tenantId_name_idx" ON "Client"("tenantId", "name");
CREATE INDEX "Client_tenantId_email_idx" ON "Client"("tenantId", "email");
CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");
CREATE INDEX "Lead_tenantId_clientId_idx" ON "Lead"("tenantId", "clientId");
CREATE INDEX "Opportunity_clientId_idx" ON "Opportunity"("clientId");
CREATE INDEX "Opportunity_tenantId_clientId_idx" ON "Opportunity"("tenantId", "clientId");
```

## Notes

- The `contactName` field on Lead is still maintained for backwards compatibility
- Client.name should match Lead.contactName for consistency
- ClientAccount is a separate legacy model that may be merged with Client in future
- The unique constraint on Opportunity.leadId remains (one opportunity per lead)
- Multiple opportunities per client is now supported through multiple leads
