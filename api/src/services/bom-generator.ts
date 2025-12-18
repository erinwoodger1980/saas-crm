/**
 * Phase 5: BOM Generator & Component Inclusion Rules
 * 
 * Generates dynamic BOMs from ConfiguredProduct selections and component rules
 * Evaluates component inclusion rules and quantity formulas
 */

import { PrismaClient, ComponentLookup } from '@prisma/client';

const prisma = new PrismaClient();

interface BOMLineItem {
  componentId: string;
  componentCode: string;
  componentName: string;
  componentDescription?: string;
  quantity: number;
  unit: string;
  quantityFormula?: string;
  conditionsMet: boolean;
  conditionDetails: string[];
  included: boolean;
}

interface GeneratedBOM {
  quoteId: string;
  lineId: string;
  productTypeId?: string;
  timestamp: string;
  selections: Record<string, any>;
  lineItems: BOMLineItem[];
  totalComponents: number;
  includedComponents: number;
  stats: {
    byCategory: Record<string, number>;
    errors: string[];
  };
}

interface InclusionRule {
  condition: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in' | 'notEmpty';
  value?: any;
  attributeCode?: string;
}

/**
 * Parses and evaluates inclusion rules for a component
 */
export function evaluateInclusionRules(
  rules: Record<string, any> | null,
  selections: Record<string, any>
): {
  conditionsMet: boolean;
  details: string[];
} {
  if (!rules) {
    return { conditionsMet: true, details: ['No conditions'] };
  }

  const details: string[] = [];
  let allMet = true;

  // Handle array of OR conditions
  if (Array.isArray(rules)) {
    // OR logic: any condition met = include
    for (const rule of rules) {
      const { met, detail } = evaluateSingleRule(rule, selections);
      if (met) {
        details.push(`✓ ${detail}`);
        return { conditionsMet: true, details };
      }
      details.push(`✗ ${detail}`);
    }
    allMet = false;
  }
  // Handle object with AND logic
  else if (typeof rules === 'object') {
    for (const [key, condition] of Object.entries(rules)) {
      const { met, detail } = evaluateSingleRule(
        { attributeCode: key, ...condition },
        selections
      );
      details.push(`${met ? '✓' : '✗'} ${detail}`);
      if (!met) allMet = false;
    }
  }

  return { conditionsMet: allMet, details };
}

/**
 * Evaluate a single inclusion rule condition
 */
function evaluateSingleRule(
  rule: Record<string, any>,
  selections: Record<string, any>
): {
  met: boolean;
  detail: string;
} {
  const { attributeCode, operator = 'equals', value } = rule;

  if (!attributeCode) {
    return {
      met: false,
      detail: `Invalid rule: missing attributeCode`
    };
  }

  const selectionValue = selections[attributeCode];

  switch (operator) {
    case 'equals':
      return {
        met: selectionValue === value,
        detail: `${attributeCode} = ${value} (actual: ${selectionValue})`
      };

    case 'contains':
      return {
        met: String(selectionValue || '').includes(String(value)),
        detail: `${attributeCode} contains "${value}"`
      };

    case 'greaterThan':
      return {
        met: Number(selectionValue) > Number(value),
        detail: `${attributeCode} > ${value} (actual: ${selectionValue})`
      };

    case 'lessThan':
      return {
        met: Number(selectionValue) < Number(value),
        detail: `${attributeCode} < ${value} (actual: ${selectionValue})`
      };

    case 'in':
      const inList = Array.isArray(value) ? value : [value];
      return {
        met: inList.includes(selectionValue),
        detail: `${attributeCode} in [${inList.join(', ')}]`
      };

    case 'notEmpty':
      return {
        met: selectionValue !== null && selectionValue !== undefined && selectionValue !== '',
        detail: `${attributeCode} is not empty`
      };

    default:
      return {
        met: false,
        detail: `Unknown operator: ${operator}`
      };
  }
}

/**
 * Evaluates a quantity formula with selection values
 */
export function evaluateQuantityFormula(
  formula: string | null,
  selections: Record<string, any>
): {
  quantity: number;
  expression: string;
} {
  if (!formula) {
    return { quantity: 1, expression: 'default' };
  }

  try {
    // Replace attribute references with values
    let expression = formula;
    const attributeMatches = formula.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];

    for (const match of attributeMatches) {
      const attrCode = match.slice(1, -1); // Remove {}
      const value = selections[attrCode] || 0;
      const numValue = isNaN(value) ? 0 : Number(value);
      expression = expression.replace(match, String(numValue));
    }

    // Safe evaluation using Function constructor
    const result = new Function('return ' + expression)();
    const quantity = Math.max(0, Math.round(Number(result) || 1));

    return { quantity, expression: `${formula} = ${quantity}` };
  } catch (e) {
    console.warn(`Failed to evaluate quantity formula: ${formula}`, e);
    return { quantity: 1, expression: `error: ${formula}` };
  }
}

/**
 * Generate BOM from a quote line with selections
 */
export async function generateBOMForLine(
  quoteId: string,
  lineId: string,
  selections: Record<string, any>,
  productTypeId?: string
): Promise<GeneratedBOM> {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];

  try {
    // Get all components for this product type (or tenant default if no productType)
    let components: ComponentLookup[];

    if (productTypeId) {
      components = await prisma.componentLookup.findMany({
        where: {
          OR: [
            { productTypes: { has: productTypeId } },
            { productTypes: { isEmpty: true } } // Default components
          ]
        }
      });
    } else {
      // Get all components without product type restriction
      components = await prisma.componentLookup.findMany({
        where: {
          productTypes: { isEmpty: true }
        }
      });
    }

    // Generate BOM lines
    const lineItems: BOMLineItem[] = [];
    let includedCount = 0;

    for (const component of components) {
      // Evaluate inclusion rules
      const inclusionRules = component.inclusionRules as any;
      const { conditionsMet, details } = evaluateInclusionRules(
        inclusionRules,
        selections
      );

      // Evaluate quantity formula
      const quantityFormula = component.quantityFormula;
      const { quantity, expression } = evaluateQuantityFormula(quantityFormula, selections);

      const included = conditionsMet && quantity > 0;
      if (included) includedCount++;

      lineItems.push({
        componentId: component.id,
        componentCode: component.code,
        componentName: component.name,
        componentDescription: component.description || undefined,
        quantity: included ? quantity : 0,
        unit: component.unitOfMeasure || 'EA',
        quantityFormula: quantityFormula || undefined,
        conditionsMet,
        conditionDetails: details,
        included
      });
    }

    // Build category stats
    const byCategory: Record<string, number> = {};
    for (const item of lineItems) {
      if (item.included) {
        byCategory[item.componentName] = (byCategory[item.componentName] || 0) + 1;
      }
    }

    return {
      quoteId,
      lineId,
      productTypeId,
      timestamp,
      selections,
      lineItems,
      totalComponents: components.length,
      includedComponents: includedCount,
      stats: {
        byCategory,
        errors
      }
    };
  } catch (e: any) {
    errors.push(e?.message || String(e));
    return {
      quoteId,
      lineId,
      productTypeId,
      timestamp,
      selections,
      lineItems: [],
      totalComponents: 0,
      includedComponents: 0,
      stats: {
        byCategory: {},
        errors
      }
    };
  }
}

/**
 * Generate BOMs for all lines in a quote
 */
export async function generateBOMForQuote(
  quoteId: string
): Promise<GeneratedBOM[]> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lines: true }
  });

  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`);
  }

  const boms: GeneratedBOM[] = [];

  for (const line of quote.lines) {
    const config = line.configuredProduct as any;
    const selections = config?.selections || {};
    const productTypeId = config?.productTypeId;

    const bom = await generateBOMForLine(quoteId, line.id, selections, productTypeId);
    boms.push(bom);
  }

  return boms;
}

/**
 * Store generated BOM in configuredProduct.derived
 */
export async function storeBOMInQuoteLine(
  lineId: string,
  bom: GeneratedBOM
): Promise<void> {
  const line = await prisma.quoteLine.findUnique({
    where: { id: lineId }
  });

  if (!line) {
    throw new Error(`QuoteLine ${lineId} not found`);
  }

  // Update configuredProduct.derived with BOM
  const config = (line.configuredProduct as any) || {};
  const derived = config.derived || {};

  derived.bom = {
    generated: bom.timestamp,
    lineItems: bom.lineItems,
    stats: bom.stats
  };

  await prisma.quoteLine.update({
    where: { id: lineId },
    data: {
      configuredProduct: {
        ...config,
        derived
      }
    }
  });
}

/**
 * Get component details with inclusion rules evaluated
 */
export async function getComponentDetails(
  componentId: string,
  selections?: Record<string, any>
): Promise<any> {
  const component = await prisma.componentLookup.findUnique({
    where: { id: componentId }
  });

  if (!component) {
    throw new Error(`Component ${componentId} not found`);
  }

  let evaluation = null;
  if (selections) {
    const { conditionsMet, details } = evaluateInclusionRules(
      component.inclusionRules as any,
      selections
    );
    const { quantity, expression } = evaluateQuantityFormula(
      component.quantityFormula,
      selections
    );

    evaluation = {
      conditionsMet,
      conditionDetails: details,
      quantity,
      quantityExpression: expression
    };
  }

  return {
    id: component.id,
    code: component.code,
    name: component.name,
    description: component.description,
    unit: component.unitOfMeasure,
    componentType: component.componentType,
    inclusionRules: component.inclusionRules,
    quantityFormula: component.quantityFormula,
    productTypes: component.productTypes,
    evaluation
  };
}

/**
 * Bulk update component inclusion rules
 */
export async function updateComponentInclusionRules(
  componentId: string,
  inclusionRules: Record<string, any> | null
): Promise<void> {
  await prisma.componentLookup.update({
    where: { id: componentId },
    data: { inclusionRules: inclusionRules as any }
  });
}

/**
 * Bulk update component quantity formula
 */
export async function updateComponentQuantityFormula(
  componentId: string,
  quantityFormula: string | null
): Promise<void> {
  await prisma.componentLookup.update({
    where: { id: componentId },
    data: { quantityFormula }
  });
}

export { BOMLineItem, GeneratedBOM, InclusionRule };
