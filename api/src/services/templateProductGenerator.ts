import { prisma } from '../db';
import { Prisma } from '@prisma/client';

/**
 * Template Product Generator Service
 * 
 * Converts ProductType selections into complete BOMs by:
 * 1. Finding matching ComponentTemplates for the ProductType
 * 2. Pulling materials from LookupTableRows based on user selections
 * 3. Calculating quantities using formula evaluation
 * 4. Generating complete BOM with pricing and 3D data
 */

interface UserSelection {
  productTypeId: string;
  fieldValues: Record<string, string | number | boolean>;
  tenantId: string;
}

interface BOMLineItem {
  id: string;
  componentName: string;
  componentCode: string;
  materialName: string;
  materialCode: string;
  quantity: number;
  quantityUnit: string;
  costPerUnit: number;
  markup: number;
  totalCost: number;
  texture?: string;
  colorHex?: string;
  materialProps?: Record<string, any>;
}

interface GeneratedBOM {
  productTypeId: string;
  lineItems: BOMLineItem[];
  totalMaterialCost: number;
  totalMarkup: number;
  totalPrice: number;
  materials3D: Array<{
    componentId: string;
    materialId: string;
    texture?: string;
    color?: string;
    properties?: Record<string, any>;
  }>;
}

/**
 * Evaluate a formula string with context variables
 * Formulas like: "(leafHeight * 2 + leafWidth * 2) / 1000"
 */
function evaluateFormula(formula: string, context: Record<string, any>): number {
  try {
    // Replace field references with actual values from context
    let expression = formula;
    
    for (const [key, value] of Object.entries(context)) {
      expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
    }

    // Use Function constructor to safely evaluate (not eval)
    // eslint-disable-next-line no-new-func
    const calc = new Function('Math', `return ${expression}`);
    const result = calc(Math);
    
    return isFinite(result) ? result : 0;
  } catch (error) {
    console.error(`Formula evaluation failed: "${formula}"`, error);
    return 0;
  }
}

/**
 * Convert Decimal to number safely
 */
function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return parseFloat(value.toString());
}

/**
 * Generate a complete BOM from ProductType selection and user input
 */
export async function generateTemplateProduct(
  selection: UserSelection
): Promise<GeneratedBOM> {
  const { productTypeId, fieldValues, tenantId } = selection;

  // 1. Fetch ProductType and validate
  const productType = await prisma.productType.findUnique({
    where: { id: productTypeId },
    include: {
      componentAssignments: {
        include: {
          component: true,
        },
      },
    },
  });

  if (!productType) {
    throw new Error(`ProductType not found: ${productTypeId}`);
  }

  const lineItems: BOMLineItem[] = [];
  const materials3D: GeneratedBOM['materials3D'] = [];

  // 2. For each component assigned to this ProductType
  for (const assignment of productType.componentAssignments) {
    const componentLookup = assignment.component;

    // 3. Find ComponentTemplates that create instances of this component
    const templates = await prisma.componentTemplate.findMany({
      where: {
        componentLookupId: componentLookup.id,
        productTypeIds: { hasSome: [productTypeId] }, // Match product type
      },
      include: {
        lookupTable: {
          include: {
            rows: true,
          },
        },
      },
    });

    if (templates.length === 0) {
      // No template found, create component with base price
      const quantity = evaluateFormula(assignment.quantityFormula || '1', fieldValues);
      
      lineItems.push({
        id: componentLookup.id,
        componentName: componentLookup.name,
        componentCode: componentLookup.code,
        materialName: 'N/A',
        materialCode: 'N/A',
        quantity,
        quantityUnit: 'EA',
        costPerUnit: toNumber(componentLookup.basePrice),
        markup: 0,
        totalCost: quantity * toNumber(componentLookup.basePrice),
      });
      continue;
    }

    // 4. Process each template
    for (const template of templates) {
      // Get the field that specifies which material to use
      const materialFieldName = template.lookupFieldName;
      
      if (!materialFieldName) {
        console.warn(`Template ${template.id} has no lookupFieldName`);
        continue;
      }

      const materialValue = fieldValues[materialFieldName];

      if (!materialValue) {
        console.warn(`Material field "${materialFieldName}" not provided for template ${template.id}`);
        continue;
      }

      // 5. Find the selected material in the lookup table
      const material = await prisma.lookupTableRow.findFirst({
        where: {
          lookupTableId: template.lookupTableId || '',
          value: String(materialValue),
        },
      });

      if (!material) {
        console.warn(
          `Material "${materialValue}" not found in lookup table ${template.lookupTableId}`
        );
        continue;
      }

      // 6. Calculate quantity from template formula
      const quantity = evaluateFormula(template.quantityFormula || '', fieldValues);

      if (quantity <= 0) {
        continue; // Skip zero-quantity components
      }

      // 7. Calculate costs
      const costPerUnit = toNumber(material.costPerUnit);
      const markupPercent = toNumber(material.markup) || 0;
      const markupFactor = 1 + markupPercent / 100;
      const totalCost = quantity * costPerUnit * markupFactor;

      // 8. Create line item
      const lineItem: BOMLineItem = {
        id: `${componentLookup.id}-${material.id}`,
        componentName: componentLookup.name,
        componentCode: componentLookup.code,
        materialName: material.label,
        materialCode: material.value,
        quantity,
        quantityUnit: material.unitType || template.quantityUnit || 'EA',
        costPerUnit,
        markup: markupPercent,
        totalCost,
        texture: material.texture || undefined,
        colorHex: material.colorHex || undefined,
        materialProps: material.materialProps as Record<string, any>,
      };

      lineItems.push(lineItem);

      // 9. Collect 3D data
      if (material.texture || material.colorHex) {
        materials3D.push({
          componentId: componentLookup.id,
          materialId: material.id,
          texture: material.texture || undefined,
          color: material.colorHex || undefined,
          properties: material.materialProps as Record<string, any>,
        });
      }
    }
  }

  // 10. Calculate totals
  const totalMaterialCost = lineItems.reduce((sum, item) => sum + item.costPerUnit * item.quantity, 0);
  const totalMarkup = lineItems.reduce(
    (sum, item) => sum + (item.totalCost - item.costPerUnit * item.quantity),
    0
  );
  const totalPrice = lineItems.reduce((sum, item) => sum + item.totalCost, 0);

  return {
    productTypeId,
    lineItems,
    totalMaterialCost,
    totalMarkup,
    totalPrice,
    materials3D,
  };
}

/**
 * Match AI-detected components to ComponentTemplates
 * Uses aiCategories and aiKeywords for intelligent matching
 */
export async function matchAIComponentsToTemplates(
  aiDetectedComponents: Array<{
    name: string;
    category?: string;
    keywords?: string[];
    confidence?: number;
  }>,
  tenantId: string
): Promise<
  Array<{
    aiComponent: string;
    matchedTemplates: any[];
    confidence: number;
  }>
> {
  const matches = [];

  for (const aiComponent of aiDetectedComponents) {
    const templates = await prisma.componentTemplate.findMany({
      where: {
        OR: [
          // Match by category
          aiComponent.category
            ? {
                aiCategories: { hasSome: [aiComponent.category] },
              }
            : {},
          // Match by keywords
          aiComponent.keywords && aiComponent.keywords.length > 0
            ? {
                aiKeywords: { hasSome: aiComponent.keywords },
              }
            : {},
        ].filter((obj) => Object.keys(obj).length > 0),
      },
      include: {
        componentLookup: true,
        lookupTable: true,
      },
    });

    if (templates.length > 0) {
      matches.push({
        aiComponent: aiComponent.name,
        matchedTemplates: templates,
        confidence: aiComponent.confidence || 0.8,
      });
    }
  }

  return matches;
}

/**
 * Update component costs for a tenant
 * When a user changes material costs, all quotes using that material recalculate automatically
 */
export async function updateComponentCosts(
  lookupTableRowId: string,
  newCostPerUnit: number,
  newMarkup?: number
): Promise<void> {
  const updates: Record<string, any> = {
    costPerUnit: newCostPerUnit,
  };

  if (newMarkup !== undefined) {
    updates.markup = newMarkup;
  }

  await prisma.lookupTableRow.update({
    where: { id: lookupTableRowId },
    data: updates,
  });

  // Note: In a real implementation, you'd trigger quote recalculation here
  // or use a subscription model to notify dependent records
}

/**
 * Get available templates for a given ProductType
 */
export async function getProductTypeTemplates(
  productTypeId: string
): Promise<any[]> {
  return prisma.componentTemplate.findMany({
    where: {
      productTypeIds: { hasSome: [productTypeId] },
    },
    include: {
      componentLookup: true,
      lookupTable: {
        include: {
          rows: true,
        },
      },
    },
  });
}
