/**
 * Fire Door Import Integration Tests
 * Tests for the fire door CSV import API endpoints
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../src/prisma';

// Sample CSV data for testing
const SAMPLE_CSV = `Item,Code,Quantity,Door Ref,Location,Fire Rating,Leaf Height,M Leaf Width,Value,Cost of Labour,Cost of Materials
Product,FD001,1,DR-001,Ground Floor,FD30S,2100,926,£1104.00,£200.00,£800.00
Product,FD002,2,DR-002,First Floor,FD60,2100,826,£950.00,£180.00,£700.00
Header,,,,,,,,,
Product,FD003,1,DR-003,Second Floor,NFR,2100,726,£750.00,£150.00,£550.00`;

describe('Fire Door Import (Database Integration)', () => {
  let testTenantId: string;
  let testUserId: string;
  let testImportId: string;

  beforeAll(async () => {
    // Create test tenant and user
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Fire Door Manufacturer',
        slug: `test-fire-door-${Date.now()}`,
      },
    });
    testTenantId = tenant.id;

    // Enable fire door manufacturer feature
    await prisma.tenantSettings.create({
      data: {
        tenantId: testTenantId,
        slug: tenant.slug,
        brandName: 'Test Fire Door Co',
        isFireDoorManufacturer: true,
      },
    });

    const user = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        email: `test-fire-${Date.now()}@example.com`,
        name: 'Test User',
        role: 'admin',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testImportId) {
      await prisma.fireDoorLineItem.deleteMany({
        where: { fireDoorImportId: testImportId },
      });
      await prisma.fireDoorImport.deleteMany({
        where: { id: testImportId },
      });
    }

    await prisma.user.deleteMany({
      where: { tenantId: testTenantId },
    });

    await prisma.tenantSettings.deleteMany({
      where: { tenantId: testTenantId },
    });

    await prisma.tenant.deleteMany({
      where: { id: testTenantId },
    });

    await prisma.$disconnect();
  });

  test('creates import and line items correctly', async () => {
    // Parse CSV using our library
    const { parseFireDoorCSV, calculateTotalValue } = await import('../src/lib/fireDoorImport');
    const parsedRows = parseFireDoorCSV(SAMPLE_CSV);
    const totalValue = calculateTotalValue(parsedRows);

    // Create import record
    const importRecord = await prisma.fireDoorImport.create({
      data: {
        tenantId: testTenantId,
        createdById: testUserId,
        sourceName: 'test-import.csv',
        status: 'COMPLETED',
        totalValue,
        currency: 'GBP',
        rowCount: parsedRows.length,
      },
    });

    testImportId = importRecord.id;

    // Create line items
    const lineItems = await Promise.all(
      parsedRows.map((row, idx) =>
        prisma.fireDoorLineItem.create({
          data: {
            fireDoorImportId: importRecord.id,
            tenantId: testTenantId,
            rowIndex: idx,
            itemType: row.itemType,
            code: row.code,
            quantity: row.quantity,
            doorRef: row.doorRef,
            location: row.location,
            fireRating: row.fireRating,
            leafHeight: row.leafHeight,
            masterLeafWidth: row.masterLeafWidth,
            unitValue: row.unitValue,
            labourCost: row.labourCost,
            materialCost: row.materialCost,
            lineTotal: row.lineTotal,
            rawRowJson: row.rawRowJson as any,
          },
        })
      )
    );

    // Verify import record
    expect(importRecord.status).toBe('COMPLETED');
    expect(importRecord.rowCount).toBe(3);
    expect(Number(importRecord.totalValue)).toBe(3854); // 1104 + (950*2) + 750

    // Verify line items
    expect(lineItems).toHaveLength(3);

    // Verify first line item
    const firstItem = lineItems[0];
    expect(firstItem.code).toBe('FD001');
    expect(firstItem.quantity).toBe(1);
    expect(firstItem.doorRef).toBe('DR-001');
    expect(firstItem.location).toBe('Ground Floor');
    expect(firstItem.fireRating).toBe('FD30S');
    expect(firstItem.leafHeight).toBe(2100);
    expect(firstItem.masterLeafWidth).toBe(926);
    expect(Number(firstItem.unitValue)).toBe(1104);
    expect(Number(firstItem.lineTotal)).toBe(1104);

    // Verify second line item (quantity = 2)
    const secondItem = lineItems[1];
    expect(secondItem.code).toBe('FD002');
    expect(secondItem.quantity).toBe(2);
    expect(Number(secondItem.unitValue)).toBe(950);
    expect(Number(secondItem.lineTotal)).toBe(1900); // 950 * 2

    // Verify third line item
    const thirdItem = lineItems[2];
    expect(thirdItem.code).toBe('FD003');
    expect(thirdItem.fireRating).toBe('NFR');
    expect(Number(thirdItem.lineTotal)).toBe(750);
  });

  test('queries import with line items', async () => {
    if (!testImportId) {
      throw new Error('Import not created in previous test');
    }

    const importWithLines = await prisma.fireDoorImport.findUnique({
      where: { id: testImportId },
      include: {
        lineItems: {
          orderBy: { rowIndex: 'asc' },
        },
      },
    });

    expect(importWithLines).not.toBeNull();
    expect(importWithLines?.lineItems).toHaveLength(3);
    expect(importWithLines?.lineItems[0].code).toBe('FD001');
    expect(importWithLines?.lineItems[1].code).toBe('FD002');
    expect(importWithLines?.lineItems[2].code).toBe('FD003');
  });

  test('tenant isolation works correctly', async () => {
    // Create another tenant
    const otherTenant = await prisma.tenant.create({
      data: {
        name: 'Other Tenant',
        slug: `other-tenant-${Date.now()}`,
      },
    });

    // Try to query import from wrong tenant
    const importFromOtherTenant = await prisma.fireDoorImport.findFirst({
      where: {
        id: testImportId,
        tenantId: otherTenant.id, // Wrong tenant
      },
    });

    expect(importFromOtherTenant).toBeNull();

    // Verify it exists for correct tenant
    const importFromCorrectTenant = await prisma.fireDoorImport.findFirst({
      where: {
        id: testImportId,
        tenantId: testTenantId,
      },
    });

    expect(importFromCorrectTenant).not.toBeNull();

    // Clean up
    await prisma.tenant.delete({
      where: { id: otherTenant.id },
    });
  });

  test('filters by fire rating', async () => {
    if (!testImportId) {
      throw new Error('Import not created');
    }

    const fd30Items = await prisma.fireDoorLineItem.findMany({
      where: {
        tenantId: testTenantId,
        fireRating: 'FD30S',
      },
    });

    expect(fd30Items).toHaveLength(1);
    expect(fd30Items[0].code).toBe('FD001');

    const fd60Items = await prisma.fireDoorLineItem.findMany({
      where: {
        tenantId: testTenantId,
        fireRating: 'FD60',
      },
    });

    expect(fd60Items).toHaveLength(1);
    expect(fd60Items[0].code).toBe('FD002');
  });
});
