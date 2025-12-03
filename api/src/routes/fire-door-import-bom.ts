/**
 * Fire Door BOM Import Endpoint
 * POST /fire-door-schedule/import-bom
 * 
 * Accepts CSV data and imports/updates fire door projects
 */

import express, { Response } from "express";
import { prisma } from "../prisma";

const router = express.Router();

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
  'LEAVES': string;
  'NOTES': string;
}

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr || dateStr.trim() === '' || dateStr === '00-Jan-00') return null;
  
  try {
    // Handle Excel date format like "21-Mar-25"
    if (dateStr.includes('-')) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        if (parsed.getFullYear() < 100) {
          parsed.setFullYear(2000 + parsed.getFullYear());
        }
        return parsed;
      }
    }
    
    // Handle DD/MM/YYYY format
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
          return date;
        }
      }
    }
    
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

router.post("/import-bom", async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const userId = req.auth?.userId || req.auth?.id;
    
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { rows } = req.body;
    
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "Missing rows array in request body" });
    }

    console.log(`Starting BOM import for tenant ${tenantId} with ${rows.length} rows`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const results: any[] = [];

    for (const row of rows) {
      try {
        const mjsNumber = cleanString(row.MJS);
        const customer = cleanString(row.CUSTOMER);
        const jobDescription = cleanString(row['JOB DESCRIPTION']);
        
        if (!mjsNumber || !customer) {
          skipped++;
          continue;
        }
        
        console.log(`Processing MJS ${mjsNumber} - ${customer}`);
        
        // Parse delivery date and calculate start date (4 weeks before)
        const deliveryDate = parseDate(row['APPROX DATE ( AUTO ADDS LEAD TIME WEEKS ) TO SIGNED OFF DATE']);
        const startDate = deliveryDate ? new Date(deliveryDate.getTime() - (4 * 7 * 24 * 60 * 60 * 1000)) : null;
        const dateReceived = parseDate(row['DATE RECEIVED IN RED FOLDER']);
        const signOffDate = parseDate(row['DATE SIGNED OFF']);
        
        // Parse material dates
        const blanksDateOrdered = parseDate(row.Column42);
        const lippingsDateOrdered = parseDate(row.Column52);
        const facingsDateOrdered = parseDate(row.Column62);
        const glassDateOrdered = parseDate(row.Column72);
        const cassettesDateOrdered = parseDate(row.Column82);
        const timbersDateOrdered = parseDate(row.Column92);
        const ironmongeryDateOrdered = parseDate(row.Column112);
        
        const jobLocation = cleanString(row['JOB LOCATION']) || 'NOT LOOKED AT';
        const signOffStatus = cleanString(row['SIGN OFF STATUS']) || 'NOT LOOKED AT';
        const scheduledBy = cleanString(row['LAJ SCHEDULER']);
        
        const doorSets = row['DOOR SETS'] ? parseInt(row['DOOR SETS'], 10) : null;
        const leaves = row.LEAVES ? parseInt(row.LEAVES, 10) : null;
        
        // Check if project exists
        const existingProject = await prisma.fireDoorScheduleProject.findFirst({
          where: { tenantId, mjsNumber },
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
        
        let project;
        
        if (existingProject) {
          project = await prisma.fireDoorScheduleProject.update({
            where: { id: existingProject.id },
            data: projectData,
          });
          updated++;
        } else {
          project = await prisma.fireDoorScheduleProject.create({
            data: projectData,
          });
          created++;
        }
        
        // Create/update lead
        let lead = await prisma.lead.findFirst({
          where: { tenantId, contactName: customer },
        });
        
        if (!lead) {
          lead = await prisma.lead.create({
            data: {
              tenantId,
              createdById: userId,
              contactName: customer,
              capturedAt: dateReceived || new Date(),
              status: 'WON' as any,
            },
          });
        } else {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: 'WON' as any },
          });
        }
        
        // Create/update opportunity
        let opportunity = project.projectId
          ? await prisma.opportunity.findFirst({ where: { id: project.projectId, tenantId } })
          : null;
        
        if (!opportunity) {
          opportunity = await prisma.opportunity.create({
            data: {
              tenantId,
              leadId: lead.id,
              title: jobDescription || `${customer} - ${mjsNumber}`,
              stage: 'WON' as any,
              startDate,
              deliveryDate,
              wonAt: signOffDate || dateReceived || new Date(),
              createdAt: dateReceived || new Date(),
            },
          });
          
          await prisma.fireDoorScheduleProject.update({
            where: { id: project.id },
            data: { projectId: opportunity.id },
          });
        } else {
          await prisma.opportunity.update({
            where: { id: opportunity.id },
            data: {
              stage: 'WON' as any,
              startDate,
              deliveryDate,
              title: jobDescription || opportunity.title,
              wonAt: signOffDate || opportunity.wonAt || new Date(),
            },
          });
        }
        
        results.push({
          mjs: mjsNumber,
          customer,
          status: existingProject ? 'updated' : 'created',
          projectId: project.id,
          opportunityId: opportunity.id,
        });
        
      } catch (error) {
        console.error(`Error processing row:`, error);
        errors++;
        results.push({
          mjs: row.MJS,
          status: 'error',
          error: String(error),
        });
      }
    }

    res.json({
      success: true,
      summary: {
        total: rows.length,
        created,
        updated,
        skipped,
        errors,
      },
      results,
    });
  } catch (error) {
    console.error("BOM import error:", error);
    res.status(500).json({ error: "Failed to import BOM" });
  }
});

export default router;
