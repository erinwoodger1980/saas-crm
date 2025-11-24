/**
 * Import material costs from Door Production spreadsheet
 * Usage: npx ts-node import-material-costs.ts <tenant_id>
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';

const EXCEL_PATH = '/Users/Erin/Desktop/open ai quote sheet no macros.xlsx';

const prisma = new PrismaClient();

interface DoorCoreData {
  code: string;
  name: string;
  supplier: string;
  unitCost: Prisma.Decimal;
  currency: string;
  fireRating: string;
  maxHeight: Prisma.Decimal;
  maxWidth: Prisma.Decimal;
  isActive: boolean;
}

interface IronmongeryData {
  category: 'HINGE' | 'LOCK' | 'LEVER_HANDLE';
  code: string;
  name: string;
  supplier: string;
  unitCost: Prisma.Decimal;
  currency: string;
  isActive: boolean;
}

async function parseCores(worksheet: ExcelJS.Worksheet): Promise<DoorCoreData[]> {
  console.log('\n' + '='.repeat(80));
  console.log('PARSING DOOR CORES');
  console.log('='.repeat(80));

  const cores: DoorCoreData[] = [];
  const seenCores = new Set<string>();

  // Find header row with CORE and RATING columns
  let headerRow = 0;
  let coreCol = 0;
  let ratingCol = 0;

  for (let row = 1; row <= Math.min(20, worksheet.rowCount); row++) {
    const rowObj = worksheet.getRow(row);
    rowObj.eachCell((cell, colNumber) => {
      const value = cell.value?.toString().trim().toUpperCase();
      if (value === 'CORE') coreCol = colNumber;
      if (value === 'RATING' || value === 'FIRE RATING') ratingCol = colNumber;
    });
    if (coreCol && ratingCol) {
      headerRow = row;
      break;
    }
  }

  if (!coreCol) {
    console.log('WARNING: Could not find CORE column');
    return cores;
  }

  console.log(`Found CORE column at ${coreCol}, RATING at ${ratingCol || 'N/A'}`);

  // Extract unique core values
  for (let row = headerRow + 1; row <= Math.min(headerRow + 1000, worksheet.rowCount); row++) {
    const rowObj = worksheet.getRow(row);
    const coreValue = rowObj.getCell(coreCol).value?.toString().trim();
    const ratingValue = ratingCol ? rowObj.getCell(ratingCol).value?.toString().trim() : 'FD30';

    if (coreValue) {
      const key = `${coreValue}|${ratingValue}`;
      if (!seenCores.has(key)) {
        seenCores.add(key);
        cores.push({
          code: coreValue.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 50),
          name: coreValue,
          supplier: 'TBC',
          unitCost: new Prisma.Decimal(0),
          currency: 'GBP',
          fireRating: ratingValue || 'FD30',
          maxHeight: new Prisma.Decimal(2400),
          maxWidth: new Prisma.Decimal(1200),
          isActive: true
        });
      }
    }
  }

  console.log(`Extracted ${cores.length} unique door cores`);
  cores.slice(0, 10).forEach(core => {
    console.log(`  - ${core.name} (${core.fireRating})`);
  });

  return cores;
}

async function parseIronmongery(worksheet: ExcelJS.Worksheet): Promise<IronmongeryData[]> {
  console.log('\n' + '='.repeat(80));
  console.log('PARSING IRONMONGERY');
  console.log('='.repeat(80));

  const items: IronmongeryData[] = [];

  // Find columns for hinges, locks, handles
  let headerRow = 0;
  let hingeCol = 0;
  let lockCol = 0;
  let handleCol = 0;

  for (let row = 1; row <= Math.min(20, worksheet.rowCount); row++) {
    const rowObj = worksheet.getRow(row);
    rowObj.eachCell((cell, colNumber) => {
      const value = cell.value?.toString().trim().toUpperCase();
      if (value === 'HINGE' || value === 'HINGES') hingeCol = colNumber;
      if (value === 'LOCK') lockCol = colNumber;
      if (value === 'HANDLE' || value === 'HANDLES') handleCol = colNumber;
    });
    if (hingeCol || lockCol || handleCol) {
      headerRow = row;
      break;
    }
  }

  console.log(`Found columns - HINGE: ${hingeCol || 'N/A'}, LOCK: ${lockCol || 'N/A'}, HANDLE: ${handleCol || 'N/A'}`);

  const seenHinges = new Set<string>();
  const seenLocks = new Set<string>();
  const seenHandles = new Set<string>();

  // Extract unique values
  for (let row = headerRow + 1; row <= Math.min(headerRow + 1000, worksheet.rowCount); row++) {
    const rowObj = worksheet.getRow(row);

    if (hingeCol) {
      const value = rowObj.getCell(hingeCol).value?.toString().trim();
      if (value && !seenHinges.has(value)) {
        seenHinges.add(value);
        items.push({
          category: 'HINGE',
          code: value.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 50),
          name: value,
          supplier: 'TBC',
          unitCost: new Prisma.Decimal(0),
          currency: 'GBP',
          isActive: true
        });
      }
    }

    if (lockCol) {
      const value = rowObj.getCell(lockCol).value?.toString().trim();
      if (value && !seenLocks.has(value)) {
        seenLocks.add(value);
        items.push({
          category: 'LOCK',
          code: value.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 50),
          name: value,
          supplier: 'TBC',
          unitCost: new Prisma.Decimal(0),
          currency: 'GBP',
          isActive: true
        });
      }
    }

    if (handleCol) {
      const value = rowObj.getCell(handleCol).value?.toString().trim();
      if (value && !seenHandles.has(value)) {
        seenHandles.add(value);
        items.push({
          category: 'LEVER_HANDLE',
          code: value.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 50),
          name: value,
          supplier: 'TBC',
          unitCost: new Prisma.Decimal(0),
          currency: 'GBP',
          isActive: true
        });
      }
    }
  }

  console.log(`Extracted ${items.length} ironmongery items`);
  console.log(`  Hinges: ${items.filter(i => i.category === 'HINGE').length}`);
  console.log(`  Locks: ${items.filter(i => i.category === 'LOCK').length}`);
  console.log(`  Handles: ${items.filter(i => i.category === 'LEVER_HANDLE').length}`);

  return items;
}

async function checkLookupSheets(workbook: ExcelJS.Workbook) {
  console.log('\n' + '='.repeat(80));
  console.log('CHECKING FOR LOOKUP/PRICE SHEETS');
  console.log('='.repeat(80));

  workbook.eachSheet((worksheet, sheetId) => {
    const name = worksheet.name.toLowerCase();
    if (name.includes('price') || name.includes('cost') || name.includes('material') || 
        name.includes('lookup') || name.includes('reference')) {
      console.log(`\nFound potential lookup sheet: ${worksheet.name}`);
      console.log('Sample data:');
      
      for (let row = 1; row <= Math.min(20, worksheet.rowCount); row++) {
        const rowObj = worksheet.getRow(row);
        const values: string[] = [];
        for (let col = 1; col <= Math.min(10, worksheet.columnCount); col++) {
          const value = rowObj.getCell(col).value?.toString().substring(0, 30);
          if (value) values.push(value);
        }
        if (values.length > 0) {
          console.log(`  Row ${row}: ${values.join(' | ')}`);
        }
      }
    }
  });
}

async function importDoorCores(tenantId: string, cores: DoorCoreData[]) {
  console.log(`\nImporting ${cores.length} door cores...`);

  for (const core of cores) {
    try {
      await prisma.doorCore.upsert({
        where: {
          tenantId_code: {
            tenantId,
            code: core.code
          }
        },
        update: {
          name: core.name,
          supplier: core.supplier,
          unitCost: core.unitCost,
          fireRating: core.fireRating,
          updatedAt: new Date()
        },
        create: {
          tenantId,
          ...core
        }
      });
      console.log(`  ✓ ${core.name}`);
    } catch (error) {
      console.log(`  ✗ ${core.name}: ${error}`);
    }
  }
}

async function importIronmongery(tenantId: string, items: IronmongeryData[]) {
  console.log(`\nImporting ${items.length} ironmongery items...`);

  for (const item of items) {
    try {
      await prisma.ironmongeryItem.upsert({
        where: {
          tenantId_code: {
            tenantId,
            code: item.code
          }
        },
        update: {
          category: item.category,
          name: item.name,
          supplier: item.supplier,
          unitCost: item.unitCost,
          updatedAt: new Date()
        },
        create: {
          tenantId,
          ...item
        }
      });
      console.log(`  ✓ ${item.category}: ${item.name}`);
    } catch (error) {
      console.log(`  ✗ ${item.name}: ${error}`);
    }
  }
}

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('ERROR: Tenant ID required');
    console.error('Usage: npx ts-node import-material-costs.ts <tenant_id>');
    
    // List available tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
      take: 10
    });
    
    console.log('\nAvailable tenants:');
    tenants.forEach((t: { id: string; name: string }) => console.log(`  ${t.id} - ${t.name}`));
    
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('MATERIAL COST IMPORT');
  console.log('='.repeat(80));
  console.log(`Excel file: ${EXCEL_PATH}`);
  console.log(`Tenant ID: ${tenantId}`);

  // Load workbook
  console.log('\nLoading workbook...');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);

  console.log(`\nAvailable sheets: ${workbook.worksheets.map(ws => ws.name).join(', ')}`);

  // Check for lookup sheets
  await checkLookupSheets(workbook);

  // Find Door Production sheet
  let doorSheet = workbook.worksheets.find(ws => 
    ws.name.toLowerCase().includes('door') && ws.name.toLowerCase().includes('production')
  );

  if (!doorSheet) {
    doorSheet = workbook.worksheets[0];
  }

  console.log(`\nUsing sheet: ${doorSheet.name}`);

  // Parse materials
  const cores = await parseCores(doorSheet);
  const ironmongery = await parseIronmongery(doorSheet);

  if (cores.length === 0 && ironmongery.length === 0) {
    console.log('\n⚠️  No materials extracted. Please check Excel file structure.');
    process.exit(1);
  }

  // Import to database
  if (cores.length > 0) {
    await importDoorCores(tenantId, cores);
  }

  if (ironmongery.length > 0) {
    await importIronmongery(tenantId, ironmongery);
  }

  console.log('\n' + '='.repeat(80));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(80));
  console.log(`Imported ${cores.length} door cores`);
  console.log(`Imported ${ironmongery.length} ironmongery items`);
  console.log('\n⚠️  NOTE: Unit costs are set to £0.00 - please update manually in Settings > Material Costs');

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
