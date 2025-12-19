/**
 * Seed Standard Field Definitions
 * Creates standard fields for clients, leads, and line items
 * Run with: npx tsx scripts/seed-standard-fields.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Standard client fields
const CLIENT_FIELDS = [
  {
    key: 'company_name',
    label: 'Company Name',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Legal business name',
    required: true,
    showInPublicForm: true,
    showInQuote: true,
    defaultContexts: ['client_detail', 'client_list', 'client_modal'],
    sortOrder: 1,
    usedForMLTraining: true,
    mlFeatureName: 'client_company_name',
  },
  {
    key: 'contact_name',
    label: 'Contact Name',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Primary contact person',
    required: true,
    showInPublicForm: true,
    showInQuote: true,
    defaultContexts: ['client_detail', 'client_list', 'client_modal'],
    sortOrder: 2,
  },
  {
    key: 'email',
    label: 'Email Address',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Primary email for contact',
    required: true,
    showInPublicForm: true,
    defaultContexts: ['client_detail', 'client_list', 'client_modal'],
    sortOrder: 3,
  },
  {
    key: 'phone',
    label: 'Phone Number',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Primary phone number',
    showInPublicForm: true,
    defaultContexts: ['client_detail', 'client_list', 'client_modal'],
    sortOrder: 4,
  },
  {
    key: 'mobile',
    label: 'Mobile Number',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Mobile phone number',
    showInPublicForm: true,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 5,
  },
  {
    key: 'address_line1',
    label: 'Address Line 1',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Street address',
    showInPublicForm: true,
    showInQuote: true,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 6,
  },
  {
    key: 'address_line2',
    label: 'Address Line 2',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Apartment, suite, etc.',
    showInPublicForm: true,
    showInQuote: true,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 7,
  },
  {
    key: 'city',
    label: 'City',
    type: 'TEXT',
    scope: 'client',
    helpText: 'City or town',
    showInPublicForm: true,
    showInQuote: true,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 8,
  },
  {
    key: 'county',
    label: 'County',
    type: 'TEXT',
    scope: 'client',
    helpText: 'County or region',
    showInPublicForm: true,
    showInQuote: true,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 9,
  },
  {
    key: 'postcode',
    label: 'Postcode',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Postal code',
    showInPublicForm: true,
    showInQuote: true,
    defaultContexts: ['client_detail', 'client_list', 'client_modal'],
    sortOrder: 10,
  },
  {
    key: 'country',
    label: 'Country',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Country',
    showInPublicForm: true,
    showInQuote: true,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 11,
  },
  {
    key: 'website',
    label: 'Website',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Company website URL',
    showInPublicForm: true,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 12,
  },
  {
    key: 'industry',
    label: 'Industry',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Business industry or sector',
    showInPublicForm: true,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 13,
    usedForMLTraining: true,
    mlFeatureName: 'client_industry',
    mlFeatureWeight: 0.8,
  },
  {
    key: 'company_size',
    label: 'Company Size',
    type: 'SELECT',
    scope: 'client',
    helpText: 'Number of employees',
    options: ['1-10', '11-50', '51-200', '201-500', '500+'],
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 14,
    usedForMLTraining: true,
    mlFeatureName: 'client_company_size',
    mlFeatureWeight: 0.5,
  },
  {
    key: 'vat_number',
    label: 'VAT Number',
    type: 'TEXT',
    scope: 'client',
    helpText: 'VAT registration number',
    showInQuote: true,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 15,
  },
  {
    key: 'payment_terms',
    label: 'Payment Terms',
    type: 'SELECT',
    scope: 'client',
    helpText: 'Default payment terms',
    options: ['Net 7', 'Net 14', 'Net 30', 'Net 60', 'Due on Receipt', 'Stage Payments'],
    showInQuote: true,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 16,
  },
  {
    key: 'credit_limit',
    label: 'Credit Limit',
    type: 'NUMBER',
    scope: 'client',
    helpText: 'Maximum credit allowed',
    unit: 'GBP',
    min: 0,
    decimalPlaces: 2,
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 17,
    isReadOnly: false,
    canBeSetBy: ['admin', 'finance'],
  },
  {
    key: 'account_manager',
    label: 'Account Manager',
    type: 'TEXT',
    scope: 'client',
    helpText: 'Assigned account manager',
    defaultContexts: ['client_detail', 'client_list', 'client_modal'],
    sortOrder: 18,
  },
  {
    key: 'notes',
    label: 'Notes',
    type: 'TEXTAREA',
    scope: 'client',
    helpText: 'General notes about the client',
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 19,
    trackChanges: true,
  },
  {
    key: 'preferred_delivery_method',
    label: 'Preferred Delivery Method',
    type: 'SELECT',
    scope: 'client',
    helpText: 'How client prefers to receive deliveries',
    options: ['Standard Delivery', 'Express Delivery', 'Collection', 'Install Service'],
    defaultContexts: ['client_detail', 'client_modal'],
    sortOrder: 20,
    usedForMLTraining: true,
    mlFeatureName: 'client_delivery_preference',
    mlFeatureWeight: 0.3,
  },
];

// Standard lead fields
const LEAD_FIELDS = [
  {
    key: 'project_type',
    label: 'Project Type',
    type: 'SELECT',
    scope: 'lead',
    helpText: 'Type of project',
    options: ['New Build', 'Renovation', 'Repair', 'Custom Order'],
    required: true,
    showInPublicForm: true,
    defaultContexts: ['lead_modal_details', 'lead_list', 'quote_form'],
    sortOrder: 1,
    usedForMLTraining: true,
    mlFeatureName: 'project_type',
    mlFeatureWeight: 1.5,
  },
  {
    key: 'project_description',
    label: 'Project Description',
    type: 'TEXTAREA',
    scope: 'lead',
    helpText: 'Detailed description of requirements',
    showInPublicForm: true,
    defaultContexts: ['lead_modal_details', 'quote_form'],
    sortOrder: 2,
    usedForMLTraining: true,
    mlFeatureName: 'project_description',
    mlFeatureWeight: 1.2,
  },
  {
    key: 'budget',
    label: 'Budget',
    type: 'NUMBER',
    scope: 'lead',
    helpText: 'Client budget range',
    unit: 'GBP',
    min: 0,
    decimalPlaces: 2,
    showInPublicForm: true,
    defaultContexts: ['lead_modal_details', 'lead_list'],
    sortOrder: 3,
    usedForMLTraining: true,
    mlFeatureName: 'client_budget',
    mlFeatureWeight: 2.0,
  },
  {
    key: 'timeline',
    label: 'Timeline',
    type: 'TEXT',
    scope: 'lead',
    helpText: 'Expected timeline or deadline',
    showInPublicForm: true,
    defaultContexts: ['lead_modal_details', 'lead_list'],
    sortOrder: 4,
    usedForMLTraining: true,
    mlFeatureName: 'project_timeline',
    mlFeatureWeight: 0.8,
  },
  {
    key: 'site_address',
    label: 'Site Address',
    type: 'TEXTAREA',
    scope: 'lead',
    helpText: 'Delivery or installation address',
    showInPublicForm: true,
    defaultContexts: ['lead_modal_details', 'quote_form'],
    sortOrder: 5,
  },
  {
    key: 'requires_site_visit',
    label: 'Requires Site Visit',
    type: 'BOOLEAN',
    scope: 'lead',
    helpText: 'Does this project need a site survey?',
    defaultContexts: ['lead_modal_details'],
    sortOrder: 6,
  },
];

// Standard line item fields
const LINE_ITEM_FIELDS = [
  {
    key: 'product_type',
    label: 'Product Type',
    type: 'SELECT',
    scope: 'line_item',
    helpText: 'Type of product',
    options: ['Door', 'Frame', 'Hardware', 'Custom'],
    required: true,
    isGlobalLineItem: true,
    showInQuote: true,
    defaultContexts: ['line_item_grid', 'quote_line_editor'],
    sortOrder: 1,
    usedForMLTraining: true,
    mlFeatureName: 'line_item_product_type',
    mlFeatureWeight: 2.0,
  },
  {
    key: 'description',
    label: 'Description',
    type: 'TEXTAREA',
    scope: 'line_item',
    helpText: 'Product description',
    required: true,
    isGlobalLineItem: true,
    showInQuote: true,
    defaultContexts: ['line_item_grid', 'quote_line_editor'],
    sortOrder: 2,
    usedForMLTraining: true,
    mlFeatureName: 'line_item_description',
    mlFeatureWeight: 1.5,
  },
  {
    key: 'quantity',
    label: 'Qty',
    type: 'NUMBER',
    scope: 'line_item',
    helpText: 'Quantity',
    required: true,
    isGlobalLineItem: true,
    showInQuote: true,
    min: 0,
    decimalPlaces: 0,
    defaultContexts: ['line_item_grid', 'quote_line_editor'],
    sortOrder: 3,
    usedForMLTraining: true,
    mlFeatureName: 'quantity',
    mlFeatureWeight: 1.0,
  },
  {
    key: 'width',
    label: 'Width (mm)',
    type: 'NUMBER',
    scope: 'line_item',
    helpText: 'Width in millimeters',
    isGlobalLineItem: true,
    showInQuote: true,
    unit: 'mm',
    min: 0,
    decimalPlaces: 0,
    defaultContexts: ['line_item_grid', 'quote_line_editor'],
    sortOrder: 4,
    usedForMLTraining: true,
    mlFeatureName: 'width_mm',
    mlFeatureWeight: 1.8,
  },
  {
    key: 'height',
    label: 'Height (mm)',
    type: 'NUMBER',
    scope: 'line_item',
    helpText: 'Height in millimeters',
    isGlobalLineItem: true,
    showInQuote: true,
    unit: 'mm',
    min: 0,
    decimalPlaces: 0,
    defaultContexts: ['line_item_grid', 'quote_line_editor'],
    sortOrder: 5,
    usedForMLTraining: true,
    mlFeatureName: 'height_mm',
    mlFeatureWeight: 1.8,
  },
  {
    key: 'thickness',
    label: 'Thickness (mm)',
    type: 'NUMBER',
    scope: 'line_item',
    helpText: 'Thickness in millimeters',
    isGlobalLineItem: true,
    showInQuote: true,
    unit: 'mm',
    min: 0,
    decimalPlaces: 0,
    defaultContexts: ['line_item_grid', 'quote_line_editor'],
    sortOrder: 6,
    usedForMLTraining: true,
    mlFeatureName: 'thickness_mm',
    mlFeatureWeight: 1.5,
  },
  {
    key: 'material',
    label: 'Material',
    type: 'TEXT',
    scope: 'line_item',
    helpText: 'Material type',
    isGlobalLineItem: true,
    showInQuote: true,
    defaultContexts: ['line_item_grid', 'quote_line_editor'],
    sortOrder: 7,
    usedForMLTraining: true,
    mlFeatureName: 'material_type',
    mlFeatureWeight: 2.0,
  },
  {
    key: 'finish',
    label: 'Finish',
    type: 'TEXT',
    scope: 'line_item',
    helpText: 'Surface finish',
    isGlobalLineItem: true,
    showInQuote: true,
    defaultContexts: ['line_item_grid', 'quote_line_editor'],
    sortOrder: 8,
    usedForMLTraining: true,
    mlFeatureName: 'finish_type',
    mlFeatureWeight: 1.2,
  },
  {
    key: 'unit_price',
    label: 'Unit Price',
    type: 'NUMBER',
    scope: 'line_item',
    helpText: 'Price per unit',
    isGlobalLineItem: true,
    showInQuote: true,
    unit: 'GBP',
    min: 0,
    decimalPlaces: 2,
    defaultContexts: ['line_item_grid', 'quote_line_editor'],
    sortOrder: 9,
    canBeSetBy: ['ml_estimate', 'manual', 'supplier_quote'],
    usedForMLTraining: true,
    mlFeatureName: 'unit_price',
    mlFeatureWeight: 3.0,
  },
  {
    key: 'total_price',
    label: 'Total Price',
    type: 'NUMBER',
    scope: 'line_item',
    helpText: 'Total line price (calculated)',
    isGlobalLineItem: true,
    showInQuote: true,
    unit: 'GBP',
    min: 0,
    decimalPlaces: 2,
    isReadOnly: true,
    calculationFormula: 'quantity * unit_price',
    defaultContexts: ['line_item_grid', 'quote_line_editor'],
    sortOrder: 10,
  },
  {
    key: 'margin_percentage',
    label: 'Margin %',
    type: 'NUMBER',
    scope: 'line_item',
    helpText: 'Profit margin percentage',
    isGlobalLineItem: true,
    unit: '%',
    min: 0,
    max: 100,
    decimalPlaces: 1,
    defaultContexts: ['line_item_grid'],
    sortOrder: 11,
    canBeSetBy: ['manual'],
    usedForMLTraining: true,
    mlFeatureName: 'margin_percentage',
    mlFeatureWeight: 1.5,
  },
];

async function seedStandardFields() {
  console.log('🌱 Seeding standard field definitions...\n');

  // Get the first tenant (or create one for testing)
  let tenant = await prisma.tenant.findFirst();
  
  if (!tenant) {
    console.log('⚠️  No tenant found. Please create a tenant first.');
    return;
  }

  console.log(`Using tenant: ${tenant.name} (${tenant.id})\n`);

  // Seed client fields
  console.log('📝 Creating client fields...');
  for (const field of CLIENT_FIELDS) {
    const existing = await prisma.questionnaireField.findFirst({
      where: {
        tenantId: tenant.id,
        key: field.key,
        scope: field.scope,
      },
    });

    if (existing) {
      console.log(`   ⏭️  ${field.key} already exists`);
      continue;
    }

    await prisma.questionnaireField.create({
      data: {
        ...field,
        tenantId: tenant.id,
        options: field.options || [],
        canBeSetBy: field.canBeSetBy || [],
        defaultContexts: field.defaultContexts || [],
      },
    });
    console.log(`   ✅ Created ${field.key}`);
  }

  // Seed lead fields
  console.log('\n📝 Creating lead fields...');
  for (const field of LEAD_FIELDS) {
    const existing = await prisma.questionnaireField.findFirst({
      where: {
        tenantId: tenant.id,
        key: field.key,
        scope: field.scope,
      },
    });

    if (existing) {
      console.log(`   ⏭️  ${field.key} already exists`);
      continue;
    }

    await prisma.questionnaireField.create({
      data: {
        ...field,
        tenantId: tenant.id,
        options: field.options || [],
        canBeSetBy: field.canBeSetBy || [],
        defaultContexts: field.defaultContexts || [],
      },
    });
    console.log(`   ✅ Created ${field.key}`);
  }

  // Seed line item fields
  console.log('\n📝 Creating line item fields...');
  for (const field of LINE_ITEM_FIELDS) {
    const existing = await prisma.questionnaireField.findFirst({
      where: {
        tenantId: tenant.id,
        key: field.key,
        scope: field.scope,
      },
    });

    if (existing) {
      console.log(`   ⏭️  ${field.key} already exists`);
      continue;
    }

    await prisma.questionnaireField.create({
      data: {
        ...field,
        tenantId: tenant.id,
        options: field.options || [],
        canBeSetBy: field.canBeSetBy || [],
        defaultContexts: field.defaultContexts || [],
      },
    });
    console.log(`   ✅ Created ${field.key}`);
  }

  console.log('\n✨ Standard field seeding complete!');
  console.log(`   Client fields: ${CLIENT_FIELDS.length}`);
  console.log(`   Lead fields: ${LEAD_FIELDS.length}`);
  console.log(`   Line item fields: ${LINE_ITEM_FIELDS.length}`);
}

// Run the seed
seedStandardFields()
  .catch((error) => {
    console.error('❌ Error seeding fields:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
