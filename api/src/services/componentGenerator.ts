import { PrismaClient } from '@prisma/client';

interface PropertyMapping {
  source: 'field' | 'lookup' | 'calculated' | 'constant';
  field?: string;
  lookupTable?: string;
  matchFields?: Record<string, string>;
  returnField?: string;
  formula?: string;
  value?: any;
  type?: string;
  default?: any;
}

interface CreationRules {
  conditions?: Array<{
    field: string;
    operator: 'in' | '>' | '>=' | '==' | '<' | '<=';
    value?: any;
    values?: any[];
  }>;
  quantity: {
    source: 'field' | 'constant' | 'calculated';
    field?: string;
    value?: number;
    formula?: string;
  };
}

interface GenerateComponentsOptions {
  lineItemId: string;
  tenantId: string;
  forceRegenerate?: boolean;
}

export class ComponentGeneratorService {
  constructor(private prisma: PrismaClient) {}

  async generateComponents(options: GenerateComponentsOptions) {
    const { lineItemId, tenantId, forceRegenerate } = options;

    console.log('[ComponentGenerator] Starting generation for line item:', lineItemId);

    // 1. Load line item with all fields
    const lineItem = await this.prisma.fireDoorLineItem.findUnique({
      where: { id: lineItemId },
    });

    if (!lineItem) {
      throw new Error('Line item not found');
    }

    console.log('[ComponentGenerator] Line item loaded:', {
      doorRef: lineItem.doorRef,
      rating: lineItem.rating,
      doorsetType: lineItem.doorsetType,
    });

    // 2. Get all component definitions for tenant
    // Component definitions not available in current schema
    const definitions: any[] = [];

    console.log('[ComponentGenerator] Found', definitions.length, 'component definitions');

    // 3. Delete existing components if regenerating
    if (forceRegenerate) {
      // Component instance model not available in current schema
      console.log('[ComponentGenerator] Component instance deletion skipped');
    }

    // 4. Generate components
    const components = [];

    for (const definition of definitions) {
      try {
        // Check creation rules
        if (!this.shouldCreateComponent(definition, lineItem)) {
          console.log('[ComponentGenerator] Skipping', definition.name, '- conditions not met');
          continue;
        }

        // Calculate quantity
        const quantity = this.calculateQuantity(definition, lineItem);
        if (quantity <= 0) {
          console.log('[ComponentGenerator] Skipping', definition.name, '- quantity is 0');
          continue;
        }

        // Extract properties
        const propertyMappings = definition.propertyMappings as unknown as Record<
          string,
          PropertyMapping
        >;
        const properties = await this.extractProperties(propertyMappings, lineItem, tenantId);

        // Calculate costs
        const unitCost = properties.unitCost || properties.coreCost || null;
        const totalCost = unitCost ? Number(unitCost) * quantity : null;

        console.log('[ComponentGenerator] Creating', definition.name, 'x', quantity, '- cost:', totalCost);

        // Create component instance - not available in schema
        const component = {
          id: 'temp-' + definition.id,
          tenantId,
          fireDoorLineItemId: lineItemId,
          definitionId: definition.id,
          properties,
          quantity,
          unitCost: unitCost ? String(unitCost) : null,
          totalCost: totalCost ? String(totalCost) : null,
        };
        components.push(component);
      } catch (error) {
        console.error('[ComponentGenerator] Error creating', definition.name, ':', error);
        // Continue with other components
      }
    }

    console.log('[ComponentGenerator] Generated', components.length, 'components');
    return components;
  }

  private shouldCreateComponent(definition: any, lineItem: any): boolean {
    const rules = definition.creationRules as CreationRules;
    if (!rules.conditions || rules.conditions.length === 0) return true;

    for (const condition of rules.conditions) {
      const value = lineItem[condition.field];

      switch (condition.operator) {
        case 'in':
          if (!condition.values?.includes(value)) return false;
          break;
        case '>':
          if (!(Number(value) > Number(condition.value))) return false;
          break;
        case '>=':
          if (!(Number(value) >= Number(condition.value))) return false;
          break;
        case '==':
          if (value !== condition.value) return false;
          break;
        case '<':
          if (!(Number(value) < Number(condition.value))) return false;
          break;
        case '<=':
          if (!(Number(value) <= Number(condition.value))) return false;
          break;
      }
    }

    return true;
  }

  private calculateQuantity(definition: any, lineItem: any): number {
    const rules = definition.creationRules as CreationRules;

    if (rules.quantity.source === 'field') {
      return Number(lineItem[rules.quantity.field!]) || 0;
    }

    if (rules.quantity.source === 'constant') {
      return rules.quantity.value || 1;
    }

    if (rules.quantity.source === 'calculated' && rules.quantity.formula) {
      return this.evaluateFormula(rules.quantity.formula, lineItem);
    }

    return 1;
  }

  private async extractProperties(
    mappings: Record<string, PropertyMapping>,
    lineItem: any,
    tenantId: string
  ): Promise<any> {
    const properties: any = {};

    for (const [key, mapping] of Object.entries(mappings)) {
      try {
        switch (mapping.source) {
          case 'field':
            properties[key] = lineItem[mapping.field!] ?? mapping.default;
            break;

          case 'lookup':
            const lookupValue = await this.executeLookup(
              mapping.lookupTable!,
              mapping.matchFields!,
              mapping.returnField!,
              lineItem,
              tenantId
            );
            properties[key] = lookupValue;
            break;

          case 'calculated':
            properties[key] = this.evaluateFormula(mapping.formula!, {
              ...properties,
              ...lineItem,
            });
            break;

          case 'constant':
            properties[key] = mapping.value;
            break;
        }
      } catch (error) {
        console.error('[ComponentGenerator] Error extracting property', key, ':', error);
        properties[key] = null;
      }
    }

    return properties;
  }

  private async executeLookup(
    tableName: string,
    matchFields: Record<string, string>,
    returnField: string,
    lineItem: any,
    tenantId: string
  ): Promise<any> {
    try {
      const lookupTable = await this.prisma.lookupTable.findFirst({
        where: { tenantId, id: tableName },
        include: {},
      });

      if (!lookupTable) {
        console.warn('[ComponentGenerator] Lookup table not found:', tableName);
        return null;
      }

      // Substitute field values in match criteria
      const resolvedMatches: any = {};
      for (const [key, template] of Object.entries(matchFields)) {
        resolvedMatches[key] = this.substituteTemplate(template, lineItem);
      }

      // Find matching row
      const rows = (lookupTable as any)?.rows || [];
      const matchingRow = rows.find?.((row: any) =>
        Object.entries(resolvedMatches).every(([key, value]) => {
          // Handle string comparison case-insensitively
          const rowValue = String((row as any)[key] || '').trim().toLowerCase();
          const matchValue = String(value || '').trim().toLowerCase();
          return rowValue === matchValue;
        })
      );

      return (matchingRow as any)?.[returnField] ?? null;
    } catch (error) {
      console.error('[ComponentGenerator] Lookup error:', error);
      return null;
    }
  }

  private substituteTemplate(template: string, data: any): any {
    if (!template || typeof template !== 'string') return template;
    
    return template.replace(/\$\{(\w+)\}/g, (_, field) => {
      return data[field] ?? '';
    });
  }

  private evaluateFormula(formula: string, context: any): any {
    try {
      // Substitute variables
      const resolved = this.substituteTemplate(formula, context);
      
      // Simple arithmetic evaluation
      // In production, use a safe expression evaluator like mathjs
      const result = eval(resolved);
      return result;
    } catch (error) {
      console.error('[ComponentGenerator] Formula evaluation error:', error);
      return null;
    }
  }
}
