#!/usr/bin/env node

// Script to create a seed template tenant with sample data
// This template will be used to populate new tenant accounts with ready-to-go data

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const SEED_TENANT_ID = 'seed_template_tenant';
const SEED_USER_ID = 'seed_template_user';

function makeId() {
  try {
    return randomUUID();
  } catch {
    return `field-${Math.random().toString(36).slice(2, 10)}`;
  }
}

async function createSeedTemplate() {
  console.log('🌱 Creating seed template data...');

  try {
    // Create seed tenant
    const seedTenant = await prisma.tenant.upsert({
      where: { id: SEED_TENANT_ID },
      update: {},
      create: {
        id: SEED_TENANT_ID,
        name: 'Seed Template Tenant',
        createdAt: new Date(),
        subscriptionStatus: 'ACTIVE',
        plan: 'PRO',
        seatsOffice: 999,
        seatsWorkshop: 999,
        seatsDisplay: 999,
      }
    });

    // Create seed user
    const seedUser = await prisma.user.upsert({
      where: { id: SEED_USER_ID },
      update: {},
      create: {
        id: SEED_USER_ID,
        tenantId: SEED_TENANT_ID,
        email: 'template@seed.local',
        name: 'Template User',
        role: 'admin',
        signupCompleted: true,
      }
    });

    // Create sample questionnaire fields for joinery companies (doors & windows)
    const questionnaireFields = [
      {
        id: makeId(),
        key: 'project_type',
        label: 'What type of joinery project do you need?',
        type: 'select',
        required: true,
        options: [
          'Interior Doors',
          'External Doors',
          'Windows',
          'Door & Window Combination',
          'Shopfront/Commercial Glazing',
          'Bi-fold Doors',
          'Sliding Doors',
          'French Doors',
          'Other Custom Joinery'
        ],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 1
      },
      {
        id: makeId(),
        key: 'property_type',
        label: 'Property type',
        type: 'select',
        required: true,
        options: [
          'Residential - New Build',
          'Residential - Renovation',
          'Commercial Building',
          'Retail/Shopfront',
          'Industrial',
          'Heritage/Period Property'
        ],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 2
      },
      {
        id: makeId(),
        key: 'material_preference',
        label: 'What material would you prefer?',
        type: 'select',
        required: true,
        options: [
          'Timber',
          'uPVC',
          'Aluminium',
          'Composite',
          'Steel',
          'Not sure - need advice'
        ],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 3
      },
      {
        id: makeId(),
        key: 'glass_type',
        label: 'Glass requirements (for windows/glazed doors)',
        type: 'select',
        required: false,
        options: [
          'Single Glazed',
          'Double Glazed',
          'Triple Glazed',
          'Toughened/Safety Glass',
          'Acoustic Glass',
          'Low-E Glass',
          'Decorative/Obscure Glass',
          'Not applicable'
        ],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 4
      },
      {
        id: makeId(),
        key: 'quantity',
        label: 'How many units do you need?',
        type: 'select',
        required: true,
        options: [
          '1-2 units',
          '3-5 units',
          '6-10 units',
          '11-20 units',
          '20+ units'
        ],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 5
      },
      {
        id: makeId(),
        key: 'budget_range',
        label: 'What is your budget range?',
        type: 'select',
        required: true,
        options: [
          'Under $2,000',
          '$2,000 - $5,000',
          '$5,000 - $10,000',
          '$10,000 - $20,000',
          '$20,000 - $50,000',
          'Over $50,000'
        ],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 6
      },
      {
        id: makeId(),
        key: 'timeline',
        label: 'When do you need this completed?',
        type: 'select',
        required: true,
        options: [
          'ASAP (Rush job)',
          'Within 2 weeks',
          '2-4 weeks',
          '1-2 months',
          '2-3 months',
          '3+ months',
          'Flexible timing'
        ],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 7
      },
      {
        id: makeId(),
        key: 'measurements_available',
        label: 'Do you have measurements available?',
        type: 'select',
        required: true,
        options: [
          'Yes, I have precise measurements',
          'Yes, but need verification',
          'No, need site measure',
          'Unsure'
        ],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 8
      },
      {
        id: makeId(),
        key: 'installation_required',
        label: 'Do you need installation services?',
        type: 'select',
        required: true,
        options: [
          'Yes, full installation',
          'Yes, supply and fit',
          'No, supply only',
          'Not sure yet'
        ],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 9
      },
      {
        id: makeId(),
        key: 'security_features',
        label: 'Security features required?',
        type: 'select',
        required: false,
        options: [
          'Standard locks',
          'Multi-point locking',
          'Anti-snap cylinders',
          'Security hinges',
          'Laminated glass',
          'All security features',
          'Not required'
        ],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 10
      },
      {
        id: makeId(),
        key: 'project_description',
        label: 'Please describe your project requirements',
        type: 'textarea',
        required: true,
        options: [],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 11
      },
      {
        id: makeId(),
        key: 'special_requirements',
        label: 'Any special requirements?',
        type: 'textarea',
        required: false,
        options: [],
        askInQuestionnaire: true,
        showOnLead: true,
        sortOrder: 12
      }
    ];

    // Create tenant settings with questionnaire
    const tenantSettings = await prisma.tenantSettings.upsert({
      where: { tenantId: SEED_TENANT_ID },
      update: {
        questionnaire: questionnaireFields,
        brandName: "Acme Joinery",
        introHtml: "<p>Thank you for your enquiry about our custom doors and windows. Please provide some details below so we can prepare the best quote for your project.</p>",
        questionnaireEmailSubject: "Complete Your Joinery Project Details",
        questionnaireEmailBody: "Hi there,\n\nThanks for reaching out about your joinery project! To provide you with an accurate quote, please take a few minutes to complete our project questionnaire:\n\n{QUESTIONNAIRE_LINK}\n\nThis helps us understand your specific requirements and ensure we deliver exactly what you need.\n\nBest regards,\nThe Acme Joinery Team"
      },
      create: {
        tenantId: SEED_TENANT_ID,
        slug: 'acme-joinery-template',
        brandName: "Acme Joinery",
        introHtml: "<p>Thank you for your enquiry about our custom doors and windows. Please provide some details below so we can prepare the best quote for your project.</p>",
        questionnaire: questionnaireFields,
        questionnaireEmailSubject: "Complete Your Joinery Project Details",
        questionnaireEmailBody: "Hi there,\n\nThanks for reaching out about your joinery project! To provide you with an accurate quote, please take a few minutes to complete our project questionnaire:\n\n{QUESTIONNAIRE_LINK}\n\nThis helps us understand your specific requirements and ensure we deliver exactly what you need.\n\nBest regards,\nThe Acme Joinery Team",
        links: [],
        taskPlaybook: {}
      }
    });

    console.log(`✅ Created tenant settings with ${questionnaireFields.length} joinery-specific questionnaire fields`);

    // Create sample task templates (these would be used in task playbook)
    console.log('✅ Seed template data created successfully!');
    console.log(`   Tenant ID: ${SEED_TENANT_ID}`);
    console.log(`   User ID: ${SEED_USER_ID}`);
    console.log(`   Questionnaire fields: ${questionnaireFields.length} (joinery-specific)`);
    console.log(`   Brand: Acme Joinery (doors & windows specialist)`);

  } catch (error) {
    console.error('❌ Failed to create seed template:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createSeedTemplate().catch(console.error);
}

export { createSeedTemplate, SEED_TENANT_ID };