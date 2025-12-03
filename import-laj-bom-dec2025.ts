/**
 * Import Lewis Aldridge Joinery BOM December 2025
 * 
 * This script:
 * 1. Reads the CSV file
 * 2. Creates/updates fire door schedule projects
 * 3. Creates WON opportunities for each project
 * 4. Sets delivery date from "APPROX DATE" column
 * 5. Sets start date as 4 weeks prior to delivery date
 * 6. Updates lead status to WON
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from './api/src/prisma';

interface BOMRow {
  DATE: string;
  MJS: string;
  CUSTOMER: string;
  'JOB DESCRIPTION': string;
  'DATE RECEIVED IN RED FOLDER': string;
  'JOB LOCATION': string;
  'SIGN OFF STATUS': string;
  'LAJ SCHEDULER': string;
  'DATE SIGNED OFF': string;
  'LEAD TIME IN WEEKS': string;
  'APPROX DATE ( AUTO ADDS LEAD TIME WEEKS ) TO SIGNED OFF DATE': string;
  'APPROX WORKING DAYS REMAINING': string;
  BLANKS: string;
  Column42: string; // BLANKS date
  LIPPINGS: string;
  Column52: string; // LIPPINGS date
  FACINGS: string;
  Column62: string; // FACINGS date
  GLASS: string;
  Column72: string; // GLASS date
  CASSETTES: string;
  Column82: string; // CASSETTES date
  TIMBERS: string;
  Column92: string; // TIMBERS date
  IRONMONGERY: string;
  Column112: string; // IRONMONGERY date
  'DOOR SETS': string;
  LEAVES: string;
  NOTES: string;
}

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr || dateStr.trim() === '' || dateStr === '00-Jan-00') return null;
  
  try {
    // Handle Excel date format like "21-Mar-25"
    if (dateStr.includes('-')) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        // If year is 2-digit, assume 2000s
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
        const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
        let year = parseInt(parts[2], 10);
        
        // Convert 2-digit year to 4-digit
        if (year < 100) {
          year = year < 50 ? 2000 + year : 1900 + year;
        }
        
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    // Try generic date parsing
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (e) {
    console.warn(`Failed to parse date: ${dateStr}`);
  }
  
  return null;
}

function cleanString(value: string | undefined | null): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  return cleaned === '' ? null : cleaned;
}

async function importBOM() {
  try {
    console.log('🔥 Starting Lewis Aldridge Joinery BOM Import (December 2025)...\n');
    
    // Find Lewis Aldridge tenant
    const tenant = await prisma.tenant.findFirst({
      where: { name: { contains: 'Lewis Aldridge', mode: 'insensitive' } }
    });
    
    if (!tenant) {
      throw new Error('Lewis Aldridge Joinery tenant not found!');
    }
    
    console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})\n`);
    
    // Find a user for this tenant to use as createdBy
    const user = await prisma.user.findFirst({
      where: { tenantId: tenant.id }
    });
    
    if (!user) {
      throw new Error('No user found for Lewis Aldridge tenant!');
    }
    
    // Read CSV file
    const csvPath = path.join(process.env.HOME || '', 'Desktop', 'DEC 2025 BOM.csv');
    console.log(`📄 Reading CSV from: ${csvPath}\n`);
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n').filter(l => l.trim());
    
    // Parse headers (first line)
    const headers = lines[0].split(',').map(h => h.trim());
    console.log(`Found ${headers.length} columns\n`);
    
    // Parse rows
    const records: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      records.push(row);
    }
    
    console.log(`Found ${records.length} rows in CSV\n`);
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const row of records) {
      try {
        const mjsNumber = cleanString(row.MJS);
        const customer = cleanString(row.CUSTOMER);
        const jobDescription = cleanString(row['JOB DESCRIPTION']);
        
        // Skip empty rows
        if (!mjsNumber || !customer) {
          skipped++;
          continue;
        }
        
        console.log(`\n📦 Processing MJS ${mjsNumber} - ${customer} - ${jobDescription || 'N/A'}`);
        
        // Parse dates
        const deliveryDate = parseDate(row['APPROX DATE ( AUTO ADDS LEAD TIME WEEKS ) TO SIGNED OFF DATE']);
        const startDate = deliveryDate ? new Date(deliveryDate.getTime() - (4 * 7 * 24 * 60 * 60 * 1000)) : null; // 4 weeks before
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
        
        // Parse status values
        const jobLocation = cleanString(row['JOB LOCATION']) || 'NOT LOOKED AT';
        const signOffStatus = cleanString(row['SIGN OFF STATUS']) || 'NOT LOOKED AT';
        const scheduledBy = cleanString(row['LAJ SCHEDULER']);
        
        // Parse door counts
        const doorSets = row['DOOR SETS'] ? parseInt(row['DOOR SETS'], 10) : null;
        const leaves = row.LEAVES ? parseInt(row.LEAVES, 10) : null;
        
        // Check if project already exists
        const existingProject = await prisma.fireDoorScheduleProject.findFirst({
          where: {
            tenantId: tenant.id,
            mjsNumber: mjsNumber,
          }
        });
        
        const projectData: any = {
          tenantId: tenant.id,
          mjsNumber: mjsNumber,
          clientName: customer,
          jobName: jobDescription || `${customer} Project`,
          dateReceived: dateReceived || new Date(),
          approxDeliveryDate: deliveryDate,
          signOffDate: signOffDate,
          jobLocation: jobLocation,
          signOffStatus: signOffStatus,
          scheduledBy: scheduledBy,
          lastUpdatedBy: user.id,
          lastUpdatedAt: new Date(),
          
          // Material dates
          blanksDateOrdered: blanksDateOrdered,
          lippingsDateOrdered: lippingsDateOrdered,
          facingsDateOrdered: facingsDateOrdered,
          glassDateOrdered: glassDateOrdered,
          cassettesDateOrdered: cassettesDateOrdered,
          timbersDateOrdered: timbersDateOrdered,
          ironmongeryDateOrdered: ironmongeryDateOrdered,
          
          // Door counts
          doorSets: doorSets,
          leaves: leaves,
          
          // Notes
          deliveryNotes: cleanString(row.NOTES),
        };
        
        let project;
        
        if (existingProject) {
          console.log(`  🔄 Updating existing project ${existingProject.id}`);
          project = await prisma.fireDoorScheduleProject.update({
            where: { id: existingProject.id },
            data: projectData,
          });
          updated++;
        } else {
          console.log(`  ✨ Creating new project`);
          project = await prisma.fireDoorScheduleProject.create({
            data: projectData,
          });
          created++;
        }
        
        // Now create/update the opportunity and lead
        let lead = await prisma.lead.findFirst({
          where: {
            tenantId: tenant.id,
            contactName: customer,
          },
        });
        
        if (!lead) {
          console.log(`  👤 Creating lead for ${customer}`);
          lead = await prisma.lead.create({
            data: {
              tenantId: tenant.id,
              createdById: user.id,
              contactName: customer,
              capturedAt: dateReceived || new Date(),
              status: 'WON' as any,
            },
          });
        } else {
          // Update lead status to WON
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: 'WON' as any },
          });
        }
        
        // Check if opportunity exists
        let opportunity = project.projectId
          ? await prisma.opportunity.findFirst({
              where: { id: project.projectId, tenantId: tenant.id },
            })
          : null;
        
        if (!opportunity) {
          console.log(`  💼 Creating WON opportunity`);
          opportunity = await prisma.opportunity.create({
            data: {
              tenantId: tenant.id,
              leadId: lead.id,
              title: jobDescription || `${customer} - ${mjsNumber}`,
              stage: 'WON' as any,
              startDate: startDate,
              deliveryDate: deliveryDate,
              wonAt: signOffDate || dateReceived || new Date(),
              createdAt: dateReceived || new Date(),
            },
          });
          
          // Link back to project
          await prisma.fireDoorScheduleProject.update({
            where: { id: project.id },
            data: { projectId: opportunity.id },
          });
        } else {
          console.log(`  🔄 Updating existing opportunity ${opportunity.id}`);
          await prisma.opportunity.update({
            where: { id: opportunity.id },
            data: {
              stage: 'WON' as any,
              startDate: startDate,
              deliveryDate: deliveryDate,
              title: jobDescription || opportunity.title,
              wonAt: signOffDate || opportunity.wonAt || new Date(),
            },
          });
        }
        
        console.log(`  ✅ Success! Project: ${project.id}, Opportunity: ${opportunity.id}`);
        
      } catch (error) {
        console.error(`  ❌ Error processing row:`, error);
        errors++;
      }
    }
    
    console.log('\n=== Import Complete ===');
    console.log(`✅ Created: ${created} projects`);
    console.log(`🔄 Updated: ${updated} projects`);
    console.log(`⏭️  Skipped: ${skipped} rows`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📊 Total: ${records.length} rows processed\n`);
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importBOM()
  .then(() => {
    console.log('✅ Import completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
