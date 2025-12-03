import { prisma } from './api/src/prisma';
import * as fs from 'fs';
import * as path from 'path';

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
    
    // Try DD/MM/YYYY format
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

async function importBOM() {
  try {
    console.log('🔥 Starting Lewis Aldridge Joinery BOM Import...\n');
    
    // Find the LAJ Joinery tenant
    const tenant = await prisma.tenant.findFirst({
      where: { name: { contains: 'LAJ', mode: 'insensitive' } }
    });
    
    if (!tenant) {
      throw new Error('LAJ Joinery tenant not found!');
    }
    
    console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})\n`);
    
    // Get a user for creating records
    const user = await prisma.user.findFirst({
      where: { tenantId: tenant.id }
    });
    
    if (!user) {
      throw new Error('No user found for Lewis Aldridge tenant!');
    }
    
    // Read the CSV file
    const csvPath = path.join(process.env.HOME || '', 'Desktop', 'DEC 2025 BOM.csv');
    console.log(`📄 Reading CSV from: ${csvPath}\n`);
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n').filter(l => l.trim());
    
    // Skip first header row (Column1, Column2, etc.) and use second row with actual field names
    const headers = lines[1].split(',').map(h => h.trim());
    console.log(`Found ${headers.length} columns\n`);
    
    const records: any[] = [];
    for (let i = 2; i < lines.length; i++) {
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
        
        if (!mjsNumber || !customer) {
          skipped++;
          continue;
        }
        
        console.log(`Processing MJS ${mjsNumber} - ${customer}`);
        
        // Parse dates
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
        
        // Parse other fields
        const jobLocation = cleanString(row['JOB LOCATION']) || 'NOT LOOKED AT';
        const signOffStatus = cleanString(row['SIGN OFF STATUS']) || 'NOT LOOKED AT';
        const scheduledBy = cleanString(row['LAJ SCHEDULER']);
        
        const doorSets = row['DOOR SETS'] ? parseInt(row['DOOR SETS'], 10) : null;
        const leaves = row.LEAVES ? parseInt(row.LEAVES, 10) : null;
        
        // Check if project exists
        const existingProject = await prisma.fireDoorScheduleProject.findFirst({
          where: { tenantId: tenant.id, mjsNumber: mjsNumber }
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
          blanksDateOrdered: blanksDateOrdered,
          lippingsDateOrdered: lippingsDateOrdered,
          facingsDateOrdered: facingsDateOrdered,
          glassDateOrdered: glassDateOrdered,
          cassettesDateOrdered: cassettesDateOrdered,
          timbersDateOrdered: timbersDateOrdered,
          ironmongeryDateOrdered: ironmongeryDateOrdered,
          doorSets: doorSets,
          leaves: leaves,
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
          console.log('  ✨ Creating new project');
          project = await prisma.fireDoorScheduleProject.create({
            data: projectData,
          });
          created++;
        }
        
        // Find or create client
        let client = await prisma.client.findFirst({
          where: { 
            tenantId: tenant.id, 
            name: customer 
          }
        });
        
        if (!client) {
          console.log(`  👤 Creating client: ${customer}`);
          client = await prisma.client.create({
            data: {
              tenantId: tenant.id,
              name: customer,
              createdAt: dateReceived || new Date(),
            },
          });
        }
        
        // Find or create lead for this client
        let lead = await prisma.lead.findFirst({
          where: { 
            tenantId: tenant.id, 
            clientId: client.id,
            contactName: customer 
          }
        });
        
        if (!lead) {
          console.log(`  📋 Creating lead for ${customer}`);
          lead = await prisma.lead.create({
            data: {
              tenantId: tenant.id,
              createdById: user.id,
              clientId: client.id,
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
        
        // Find or create opportunity
        let opportunity = project.projectId
          ? await prisma.opportunity.findFirst({ where: { id: project.projectId, tenantId: tenant.id } })
          : null;
        
        // If no opportunity linked to project, check if lead already has an opportunity
        if (!opportunity) {
          opportunity = await prisma.opportunity.findFirst({
            where: { leadId: lead.id, tenantId: tenant.id }
          });
        }
        
        if (!opportunity) {
          console.log('  💼 Creating WON opportunity');
          opportunity = await prisma.opportunity.create({
            data: {
              tenantId: tenant.id,
              leadId: lead.id,
              clientId: client.id,
              title: jobDescription || `${customer} - ${mjsNumber}`,
              stage: 'WON' as any,
              startDate: startDate,
              deliveryDate: deliveryDate,
              wonAt: signOffDate || dateReceived || new Date(),
              createdAt: dateReceived || new Date(),
            },
          });
          
          await prisma.fireDoorScheduleProject.update({
            where: { id: project.id },
            data: { projectId: opportunity.id },
          });
        } else {
          console.log(`  🔄 Updating existing opportunity ${opportunity.id}`);
          await prisma.opportunity.update({
            where: { id: opportunity.id },
            data: {
              clientId: client.id,
              stage: 'WON' as any,
              startDate: startDate,
              deliveryDate: deliveryDate,
              title: jobDescription || opportunity.title,
              wonAt: signOffDate || opportunity.wonAt || new Date(),
            },
          });
          
          // Link the project to the opportunity if not already linked
          if (project.projectId !== opportunity.id) {
            await prisma.fireDoorScheduleProject.update({
              where: { id: project.id },
              data: { projectId: opportunity.id },
            });
          }
        }
        
        console.log(`  ✅ Success! Project: ${project.id}, Opportunity: ${opportunity.id}`);
        
      } catch (error) {
        console.error('  ❌ Error:', error);
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

importBOM().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
