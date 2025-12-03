import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

interface BOMRow {
  MJS: string;
  CUSTOMER: string;
  'JOB DESCRIPTION': string;
  'DATE RECEIVED IN RED FOLDER': string;
  'JOB LOCATION': string;
  'SIGN OFF STATUS': string;
  'LAJ SCHEDULER': string;
  'DATE SIGNED OFF': string;
  'APPROX DATE ( AUTO ADDS LEAD TIME WEEKS ) TO SIGNED OFF DATE': string;
  'BLANKS': string;
  'Column42': string;
  'LIPPINGS': string;
  'Column52': string;
  'FACINGS': string;
  'Column62': string;
  'GLASS': string;
  'Column72': string;
  'CASSETTES': string;
  'Column82': string;
  'TIMBERS': string;
  'Column92': string;
  'IRONMONGERY': string;
  'Column112': string;
  'DOOR SETS': string;
  LEAVES: string;
  NOTES: string;
}

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr || dateStr.trim() === '' || dateStr === '00-Jan-00') return null;
  
  try {
    // Try parsing DD-MMM-YY format (21-Mar-25)
    if (dateStr.includes('-')) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        // Fix two-digit years
        if (parsed.getFullYear() < 100) {
          parsed.setFullYear(2000 + parsed.getFullYear());
        }
        return parsed;
      }
    }
    
    // Try DD/MM/YYYY or DD/MM/YY format
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        
        if (year < 100) {
          year = year < 50 ? 2000 + year : 1900 + year;
        }
        
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          // Ensure we're creating date at midnight UTC to avoid timezone issues
          return new Date(Date.UTC(year, month, day));
        }
      }
    }
    
    // Try standard parsing
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  return null;
}

function cleanString(value: string | undefined | null): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  return cleaned === '' ? null : cleaned;
}

// Trigger BOM import from uploaded CSV
router.post('/trigger-bom-import', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).auth?.tenantId;
    const userId = (req as any).auth?.userId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin/developer
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId }
    });

    if (!user || (user.role !== 'owner' && !user.isDeveloper)) {
      return res.status(403).json({ error: 'Forbidden - admin access required' });
    }

    const csvContent = req.body.csvContent as string;
    
    if (!csvContent) {
      return res.status(400).json({ error: 'CSV content required' });
    }

    const lines = csvContent.split('\n').filter(l => l.trim());
    
    // Skip first header row and use second row with actual field names
    const headers = lines[1].split(',').map(h => h.trim());
    
    const records: any[] = [];
    for (let i = 2; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      records.push(row);
    }
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];
    
    for (const row of records) {
      try {
        const mjsNumber = cleanString(row.MJS);
        const customer = cleanString(row.CUSTOMER);
        const jobDescription = cleanString(row['JOB DESCRIPTION']);
        
        if (!mjsNumber || !customer) {
          skipped++;
          continue;
        }
        
        // Parse dates
        const dateReceivedRaw = row['DATE RECEIVED IN RED FOLDER'];
        const dateReceived = parseDate(dateReceivedRaw);
        const deliveryDate = parseDate(row['APPROX DATE ( AUTO ADDS LEAD TIME WEEKS ) TO SIGNED OFF DATE']);
        const signOffDate = parseDate(row['DATE SIGNED OFF']);
        
        // Parse material dates
        const blanksDateOrdered = parseDate(row.Column42);
        const lippingsDateOrdered = parseDate(row.Column52);
        const facingsDateOrdered = parseDate(row.Column62);
        const glassDateOrdered = parseDate(row.Column72);
        const cassettesDateOrdered = parseDate(row.Column82);
        const timbersDateOrdered = parseDate(row.Column92);
        const ironmongeryDateOrdered = parseDate(row.Column112);
        
        // Parse other fields
        const jobLocation = cleanString(row['JOB LOCATION']) || 'NOT LOOKED AT';
        const signOffStatus = cleanString(row['SIGN OFF STATUS']) || 'NOT LOOKED AT';
        const scheduledBy = cleanString(row['LAJ SCHEDULER']);
        
        const doorSets = row['DOOR SETS'] ? parseInt(row['DOOR SETS'], 10) : null;
        const leaves = row.LEAVES ? parseInt(row.LEAVES, 10) : null;
        
        // Check if project exists
        const existingProject = await prisma.fireDoorScheduleProject.findFirst({
          where: { tenantId, mjsNumber: mjsNumber }
        });
        
        const projectData: any = {
          tenantId,
          mjsNumber,
          clientName: customer,
          jobName: jobDescription || `${customer} Project`,
          dateReceived: dateReceived || new Date(),
          approxDeliveryDate: deliveryDate,
          signOffDate,
          jobLocation,
          signOffStatus,
          scheduledBy,
          lastUpdatedBy: userId,
          lastUpdatedAt: new Date(),
          blanksDateOrdered,
          lippingsDateOrdered,
          facingsDateOrdered,
          glassDateOrdered,
          cassettesDateOrdered,
          timbersDateOrdered,
          ironmongeryDateOrdered,
          doorSets,
          leaves,
          deliveryNotes: cleanString(row.NOTES),
        };
        
        if (existingProject) {
          await prisma.fireDoorScheduleProject.update({
            where: { id: existingProject.id },
            data: projectData,
          });
          updated++;
        } else {
          await prisma.fireDoorScheduleProject.create({
            data: projectData,
          });
          created++;
        }
      } catch (error: any) {
        errors++;
        errorDetails.push(`${row.MJS}: ${error.message}`);
      }
    }
    
    res.json({
      success: true,
      summary: {
        totalRows: records.length,
        created,
        updated,
        skipped,
        errors
      },
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined
    });
  } catch (error: any) {
    console.error('BOM import error:', error);
    res.status(500).json({ error: 'Import failed', detail: error.message });
  }
});

export default router;
