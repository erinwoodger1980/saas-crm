/**
 * Dual-Write Service for Legacy Questionnaire → ConfiguredProduct Migration
 * 
 * This service bridges the legacy QuestionnaireAnswer system with the new
 * canonical ConfiguredProduct model on QuoteLine.
 * 
 * When a QuestionnaireAnswer is saved:
 * 1. Look up the LegacyQuestionMapping for the field
 * 2. Transform the value using the mapping's expression
 * 3. Write to QuoteLine.configuredProduct.selections[attributeCode]
 * 4. Mark provenance as 'legacy'
 * 
 * This allows incremental migration while preserving all existing functionality.
 */

import { prisma } from '../prisma';

interface ConfiguredProduct {
  productTypeId?: string;
  selections: Record<string, any>;
  derived?: {
    bom?: any[];
    processes?: any[];
    costs?: any;
    drawing?: any;
  };
  provenance?: Record<string, 'user' | 'ai' | 'default' | 'legacy'>;
}

/**
 * Syncs a QuestionnaireAnswer to the canonical ConfiguredProduct
 */
export async function syncAnswerToConfiguredProduct(
  quoteId: string,
  fieldId: string,
  value: any,
  tenantId: string
): Promise<void> {
  try {
    // 1. Find the legacy mapping for this field
    const mapping = await prisma.legacyQuestionMapping.findUnique({
      where: { legacyFieldId: fieldId },
      include: {
        legacyField: true
      }
    });

    if (!mapping || !mapping.isActive) {
      // No mapping exists, skip dual-write
      return;
    }

    // 2. Get the QuoteLine(s) for this quote
    const quoteLines = await prisma.quoteLine.findMany({
      where: { quoteId }
    });

    if (quoteLines.length === 0) {
      console.warn(`No quote lines found for quote ${quoteId}`);
      return;
    }

    // 3. Transform the value if needed
    let transformedValue = value;
    if (mapping.transformExpression) {
      try {
        transformedValue = transformValue(value, mapping.transformExpression);
      } catch (error) {
        console.error(`Transform failed for field ${fieldId}:`, error);
        transformedValue = value; // Fall back to raw value
      }
    }

    // 4. Update each quote line's configuredProduct
    for (const quoteLine of quoteLines) {
      const currentConfig: ConfiguredProduct = (quoteLine.configuredProduct as any) || {
        selections: {},
        provenance: {}
      };

      // Merge the new selection
      currentConfig.selections = currentConfig.selections || {};
      currentConfig.selections[mapping.attributeCode] = transformedValue;

      // Track provenance
      currentConfig.provenance = currentConfig.provenance || {};
      currentConfig.provenance[mapping.attributeCode] = 'legacy';

      // Save back
      await prisma.quoteLine.update({
        where: { id: quoteLine.id },
        data: {
          configuredProduct: currentConfig as any
        }
      });
    }

    console.log(`✓ Synced ${mapping.attributeCode} = ${transformedValue} to ${quoteLines.length} quote line(s)`);
  } catch (error) {
    console.error('Error syncing answer to configuredProduct:', error);
    // Don't throw - we don't want to break the legacy save flow
  }
}

/**
 * Syncs an entire QuestionnaireResponse to ConfiguredProduct
 */
export async function syncResponseToConfiguredProduct(
  responseId: string
): Promise<void> {
  const response = await prisma.questionnaireResponse.findUnique({
    where: { id: responseId },
    include: {
      answers: {
        include: {
          field: true
        }
      }
    }
  });

  if (!response || !response.quoteId) {
    return;
  }

  // Get all mappings for this tenant
  const mappings = await prisma.legacyQuestionMapping.findMany({
    where: {
      tenantId: response.tenantId,
      isActive: true
    }
  });

  const mappingsByFieldId = new Map(
    mappings.map(m => [m.legacyFieldId, m])
  );

  // Build the selections object
  const selections: Record<string, any> = {};
  const provenance: Record<string, 'legacy'> = {};

  for (const answer of response.answers) {
    const mapping = mappingsByFieldId.get(answer.fieldId);
    if (!mapping) continue;

    let value = answer.value;
    if (mapping.transformExpression) {
      try {
        value = transformValue(value, mapping.transformExpression);
      } catch (error) {
        console.error(`Transform failed for field ${answer.fieldId}:`, error);
      }
    }

    selections[mapping.attributeCode] = value;
    provenance[mapping.attributeCode] = 'legacy';
  }

  // Update all quote lines for this quote
  const quoteLines = await prisma.quoteLine.findMany({
    where: { quoteId: response.quoteId }
  });

  for (const quoteLine of quoteLines) {
    const currentConfig: ConfiguredProduct = (quoteLine.configuredProduct as any) || {
      selections: {},
      provenance: {}
    };

    // Merge selections
    currentConfig.selections = {
      ...currentConfig.selections,
      ...selections
    };

    // Merge provenance
    currentConfig.provenance = {
      ...currentConfig.provenance,
      ...provenance
    };

    await prisma.quoteLine.update({
      where: { id: quoteLine.id },
      data: {
        configuredProduct: currentConfig as any
      }
    });
  }

  console.log(`✓ Synced ${response.answers.length} answers to ${quoteLines.length} quote line(s)`);
}

/**
 * Creates legacy mappings for existing QuestionnaireFields
 */
export async function createLegacyMappingsForTenant(
  tenantId: string
): Promise<number> {
  console.log(`Creating legacy mappings for tenant ${tenantId}...`);

  // Get all active attributes
  const attributes = await prisma.attribute.findMany({
    where: { tenantId, isActive: true }
  });

  const attributesByCode = new Map(
    attributes.map(a => [a.code, a])
  );

  // Get all questionnaire fields that need mapping
  const fields = await prisma.questionnaireField.findMany({
    where: {
      tenantId,
      isActive: true,
      isStandard: true // Only map standard fields initially
    }
  });

  let mappingCount = 0;

  for (const field of fields) {
    // Try to match field key to attribute code
    const attributeCode = inferAttributeCodeFromField(field.key);
    const attribute = attributesByCode.get(attributeCode);

    if (!attribute) {
      console.log(`  ⚠️  No attribute match for field ${field.key}`);
      continue;
    }

    // Check if mapping already exists
    const existing = await prisma.legacyQuestionMapping.findUnique({
      where: { legacyFieldId: field.id }
    });

    if (existing) {
      console.log(`  ⏩ Mapping already exists for ${field.key}`);
      continue;
    }

    // Create the mapping
    await prisma.legacyQuestionMapping.create({
      data: {
        tenantId,
        legacyFieldId: field.id,
        legacyFieldKey: field.key,
        attributeCode,
        isActive: true
      }
    });

    mappingCount++;
    console.log(`  ✓ Mapped ${field.key} → ${attributeCode}`);
  }

  console.log(`✅ Created ${mappingCount} legacy mappings`);
  return mappingCount;
}

/**
 * Infers attribute code from legacy field key
 * Examples:
 *   width → width
 *   overallWidth → width
 *   timber_group → timberGroup
 *   finish_type → finish
 */
function inferAttributeCodeFromField(fieldKey: string): string {
  const key = fieldKey.toLowerCase();

  // Direct matches
  if (key === 'width' || key.includes('overall') && key.includes('width')) return 'width';
  if (key === 'height' || key.includes('overall') && key.includes('height')) return 'height';
  if (key.includes('timber') || key.includes('wood')) return 'timberGroup';
  if (key.includes('finish')) return 'finish';
  if (key.includes('glaz')) return 'glazingType';
  if (key.includes('hardware') || key.includes('ironmongery')) return 'hardwarePack';
  if (key.includes('colour') || key.includes('color')) {
    if (key.includes('inside') || key.includes('internal')) return 'colourInside';
    if (key.includes('outside') || key.includes('external')) return 'colourOutside';
    return 'colourInside'; // Default
  }
  if (key.includes('panel') && key.includes('count')) return 'panelCount';
  if (key.includes('opening')) return 'opening';

  // Fallback: use the key as-is but camelCase it
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transforms a value using a simple expression
 * Supports:
 *   - "value" - returns value as-is
 *   - "value.toUpperCase()" - calls method on value
 *   - "parseInt(value)" - wraps in function
 *   - Custom JS expressions (eval - use with caution!)
 */
function transformValue(value: any, expression: string): any {
  if (!expression || expression === 'value') {
    return value;
  }

  try {
    // Simple string methods
    if (expression === 'value.toUpperCase()') return String(value).toUpperCase();
    if (expression === 'value.toLowerCase()') return String(value).toLowerCase();
    if (expression === 'value.trim()') return String(value).trim();

    // Type conversions
    if (expression === 'parseInt(value)') return parseInt(value);
    if (expression === 'parseFloat(value)') return parseFloat(value);
    if (expression === 'String(value)') return String(value);
    if (expression === 'Boolean(value)') return Boolean(value);

    // For more complex transforms, use Function constructor (safer than eval)
    const transform = new Function('value', `return ${expression}`);
    return transform(value);
  } catch (error) {
    console.error(`Transform expression failed: ${expression}`, error);
    return value;
  }
}

export {
  transformValue,
  inferAttributeCodeFromField,
  ConfiguredProduct
};
