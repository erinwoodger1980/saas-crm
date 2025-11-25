import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface CSVRow {
  DATE?: string;
  MJS?: string;
  CUSTOMER?: string;
  'JOB DESCRIPTION'?: string;
  'DATE RECEIVED IN RED FOLDER'?: string;
  'JOB LOCATION'?: string;
  'SIGN OFF STATUS'?: string;
  'LAJ SCHEDULER'?: string;
  'DATE SIGNED OFF'?: string;
  'LEAD TIME IN WEEKS'?: string;
  'APPROX DATE ( AUTO ADDS LEAD TIME WEEKS ) TO SIGNED OFF DATE'?: string;
  'APPROX WORKING DAYS REMAINING'?: string;
  BLANKS?: string;
  LIPPINGS?: string;
  FACINGS?: string;
  GLASS?: string;
  CASSETTES?: string;
  TIMBERS?: string;
  IRONMONGERY?: string;
  HIDDEN?: string;
  'DOOR PAPERWORK'?: string;
  'FINAL CNC SHEET'?: string;
  'FINAL CHECKS SHEET'?: string;
  'DELIVERY CHECKLIST'?: string;
  'FRAMES PAPERWORK'?: string;
  'PAPERWORK COMMENTS'?: string;
  'BLANKS CUT'?: string;
  EDGEBAND?: string;
  CALIBRATE?: string;
  FACINGS?: string;
  'FINAL CNC'?: string;
  FINISH?: string;
  SAND?: string;
  'SPRAY '?: string;
  CUT?: string;
  CNC?: string;
  BUILD?: string;
  PROGRESS?: string;
  TRANSPORT?: string;
  'DOOR SETS'?: string;
  LEAVES?: string;
  NOTES?: string;
}

function parseDate(dateStr?: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Handle DD/MM/YYYY format
  const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Handle DD-MMM-YY format (e.g., "00-Jan-00")
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0] === '00') return null; // Invalid date marker
  }
  
  return null;
}

function parsePercentage(pct?: string): number | null {
  if (!pct || pct.trim() === '' || pct.toLowerCase() === 'n/a') return null;
  const cleaned = pct.replace('%', '').trim();
  const num = parseInt(cleaned);
  return isNaN(num) ? null : Math.min(100, Math.max(0, num));
}

function parseInt(str?: string): number | null {
  if (!str || str.trim() === '') return null;
  const num = Number.parseInt(str.trim());
  return isNaN(num) ? null : num;
}

async function importBOM(csvPath: string, tenantId: string) {
  console.log('Reading CSV file:', csvPath);
  
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV, skipping first row (it's a header row with Column1, Column2, etc.)
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    from_line: 2, // Start from line 2 (skip the first header row)
    relax_quotes: true,
    relax_column_count: true,
  }) as CSVRow[];
  
  console.log(`Found ${records.length} rows to import`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const row of records) {
    try {
      // Skip rows without MJS number
      const mjsNumber = row.MJS?.trim();
      if (!mjsNumber) {
        skipped++;
        continue;
      }
      
      // Check if project already exists
      const existing = await prisma.fireDoorScheduleProject.findFirst({
        where: {
          tenantId,
          mjsNumber,
        },
      });
      
      if (existing) {
        console.log(`Skipping MJS ${mjsNumber} - already exists`);
        skipped++;
        continue;
      }
      
      // Map CSV columns to database fields
      const projectData = {
        tenantId,
        mjsNumber,
        jobName: row['JOB DESCRIPTION']?.trim() || null,
        clientName: row.CUSTOMER?.trim() || null,
        dateReceived: parseDate(row['DATE RECEIVED IN RED FOLDER']),
        jobLocation: row['JOB LOCATION']?.trim() || null,
        signOffStatus: row['SIGN OFF STATUS']?.trim() || null,
        scheduledBy: row['LAJ SCHEDULER']?.trim() || null,
        signOffDate: parseDate(row['DATE SIGNED OFF']),
        leadTimeWeeks: parseInt(row['LEAD TIME IN WEEKS']),
        approxDeliveryDate: parseDate(row['APPROX DATE ( AUTO ADDS LEAD TIME WEEKS ) TO SIGNED OFF DATE']),
        workingDaysRemaining: parseInt(row['APPROX WORKING DAYS REMAINING']),
        
        // BOM Materials - Note: CSV has separate columns for status and dates
        // We'll use the first column as status
        blanksStatus: row.BLANKS?.trim() || null,
        blanksDateOrdered: null,
        blanksDateExpected: null,
        blanksDateReceived: null,
        blanksChecked: false,
        
        lippingsStatus: row.LIPPINGS?.trim() || null,
        lippingsDateOrdered: null,
        lippingsDateExpected: null,
        lippingsDateReceived: null,
        lippingsChecked: false,
        
        facingsStatus: row.FACINGS?.trim() || null,
        facingsDateOrdered: null,
        facingsDateExpected: null,
        facingsDateReceived: null,
        facingsChecked: false,
        
        glassStatus: row.GLASS?.trim() || null,
        glassDateOrdered: null,
        glassDateExpected: null,
        glassDateReceived: null,
        glassChecked: false,
        
        cassettesStatus: row.CASSETTES?.trim() || null,
        cassettesDateOrdered: null,
        cassettesDateExpected: null,
        cassettesDateReceived: null,
        cassettesChecked: false,
        
        timbersStatus: row.TIMBERS?.trim() || null,
        timbersDateOrdered: null,
        timbersDateExpected: null,
        timbersDateReceived: null,
        timbersChecked: false,
        
        ironmongeryStatus: row.IRONMONGERY?.trim() || null,
        ironmongeryDateOrdered: null,
        ironmongeryDateExpected: null,
        ironmongeryDateReceived: null,
        ironmongeryChecked: false,
        
        // Paperwork
        doorPaperworkStatus: row['DOOR PAPERWORK']?.trim() || null,
        finalCncSheetStatus: row['FINAL CNC SHEET']?.trim() || null,
        finalChecksSheetStatus: row['FINAL CHECKS SHEET']?.trim() || null,
        deliveryChecklistStatus: row['DELIVERY CHECKLIST']?.trim() || null,
        framesPaperworkStatus: row['FRAMES PAPERWORK']?.trim() || null,
        paperworkComments: row['PAPERWORK COMMENTS']?.trim() || null,
        
        // Production percentages
        blanksCutPercent: parsePercentage(row['BLANKS CUT']),
        edgebandPercent: parsePercentage(row.EDGEBAND),
        calibratePercent: parsePercentage(row.CALIBRATE),
        facingsPercent: parsePercentage(row.FACINGS), // This might conflict with FACINGS status above
        finalCncPercent: parsePercentage(row['FINAL CNC']),
        finishPercent: parsePercentage(row.FINISH),
        sandPercent: parsePercentage(row.SAND),
        sprayPercent: parsePercentage(row['SPRAY ']),
        cutPercent: parsePercentage(row.CUT),
        cncPercent: parsePercentage(row.CNC),
        buildPercent: parsePercentage(row.BUILD),
        overallProgress: parsePercentage(row.PROGRESS),
        
        // Production details
        transportStatus: row.TRANSPORT?.trim() || null,
        doorSets: parseInt(row['DOOR SETS']),
        leaves: parseInt(row.LEAVES),
        deliveryNotes: row.NOTES?.trim() || null,
        
        lastUpdatedAt: new Date(),
      };
      
      await prisma.fireDoorScheduleProject.create({
        data: projectData as any,
      });
      
      console.log(`✅ Imported MJS ${mjsNumber} - ${projectData.jobName}`);
      imported++;
      
    } catch (error: any) {
      console.error(`❌ Error importing row:`, error.message);
      console.error('Row data:', row);
      errors++;
    }
  }
  
  console.log(`\n=== Import Summary ===`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${records.length}`);
}

// Main execution
const csvPath = process.argv[2] || '/Users/Erin/Desktop/Copy BOM.csv';
const tenantId = process.argv[3];

if (!tenantId) {
  console.error('Usage: tsx import-fire-door-bom.ts <csv-path> <tenant-id>');
  console.error('Example: tsx import-fire-door-bom.ts /path/to/file.csv abc123');
  process.exit(1);
}

importBOM(csvPath, tenantId)
  .then(() => {
    console.log('Import complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
