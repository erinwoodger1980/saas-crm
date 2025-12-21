/**
 * Product Resolution System
 * 
 * Converts TemplateDraft (with expressions) → ResolvedProduct (fully evaluated)
 * - Evaluates all #token expressions to concrete numbers
 * - Normalizes units to millimeters
 * - Assigns material keys
 * - Generates estimated profiles where missing
 * - Prepares for BOM/cutlist/pricing generation
 */

import type {
  TemplateDraft,
  ResolvedProduct,
  ResolvedComponentInstance,
  ResolvedMaterialAssignment,
  ResolvedHardwareItem,
  TemplateInstance,
} from '@/types/resolved-product';
import {
  evaluateExpression,
  evaluateDims,
  evaluatePos,
  evaluateRot,
  flattenGlobals,
  type EvaluationContext,
} from './expression-eval';
import { generateBom } from '../costing/bom';
import { generateCutlist } from '../costing/cutlist';
import { generatePricing, estimateLaborHours } from '../costing/pricing';

/**
 * Resolve a template draft into a concrete product
 */
export async function resolveTemplateDraft(
  draft: TemplateDraft
): Promise<ResolvedProduct> {
  const warnings: string[] = [...draft.warnings];
  const questions: string[] = [...draft.questions];
  
  // Flatten globals for expression evaluation
  const flatGlobals = flattenGlobals(draft.globals);
  const context: EvaluationContext = { globals: flatGlobals };
  
  // Resolve instances
  const instances: ResolvedComponentInstance[] = [];
  
  for (const templateInstance of draft.instances) {
    try {
      // Check visibility condition (if present in meta)
      const isVisible = await evaluateVisibility(templateInstance, context);
      if (!isVisible) {
        continue; // Skip invisible components
      }
      
      const resolved = await resolveInstance(templateInstance, context);
      instances.push(resolved);
    } catch (error) {
      warnings.push(`Failed to resolve instance ${templateInstance.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Resolve materials
  const materials: ResolvedMaterialAssignment[] = draft.materials.map(rule => ({
    role: rule.materialRole,
    materialKey: rule.materialKey,
    name: undefined, // Will be populated by material registry lookup
    meta: {},
  }));
  
  // Resolve hardware
  const hardware: ResolvedHardwareItem[] = [];
  for (const hwTemplate of draft.hardware) {
    try {
      const quantity = typeof hwTemplate.quantity === 'string'
        ? (evaluateExpression(hwTemplate.quantity, context) as number)
        : hwTemplate.quantity;
      
      hardware.push({
        id: hwTemplate.id,
        name: hwTemplate.name,
        sku: hwTemplate.sku,
        componentModelId: hwTemplate.componentModelId,
        quantity,
        meta: {},
      });
    } catch (error) {
      warnings.push(`Failed to resolve hardware ${hwTemplate.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return {
    templateId: draft.templateId,
    name: draft.name,
    category: draft.category,
    globals: flatGlobals,
    instances,
    materials,
    hardware,
    bom: [], // Will be populated below
    cutList: [], // Will be populated below
    pricing: {
      subtotal: 0,
      materials: 0,
      hardware: 0,
      finishing: 0,
      total: 0,
      currency: 'GBP',
      breakdown: [],
    }, // Will be populated below
    warnings,
    questions,
    meta: {
      ...draft.meta,
      resolvedAt: new Date().toISOString(),
    },
  };
}

/**
 * Complete product resolution with BOM, cutlist, and pricing
 */
export async function resolveProductComplete(
  draft: TemplateDraft
): Promise<ResolvedProduct> {
  // First resolve the basic product
  let product = await resolveTemplateDraft(draft);
  
  // Generate BOM
  product.bom = generateBom(product);
  
  // Generate cutlist
  product.cutList = generateCutlist(product);
  
  // Generate pricing
  const estimatedHours = estimateLaborHours(product);
  product.pricing = generatePricing(product, { estimatedHours });
  
  return product;
}

/**
 * Resolve a single template instance
 */
async function resolveInstance(
  templateInstance: TemplateInstance,
  context: EvaluationContext
): Promise<ResolvedComponentInstance> {
  // Evaluate dimensions
  const dimsMm = evaluateDims(templateInstance.dims, context);
  
  // Evaluate position
  const posMm = evaluatePos(templateInstance.pos, context);
  
  // Evaluate rotation
  const rotDeg = evaluateRot(templateInstance.rot, context);
  
  // Keep original expressions for back-propagation
  const expr = {
    dims: {
      x: templateInstance.dims.x,
      y: templateInstance.dims.y,
      z: templateInstance.dims.z,
    },
    pos: {
      x: templateInstance.pos.x,
      y: templateInstance.pos.y,
      z: templateInstance.pos.z,
    },
    rot: templateInstance.rot ? {
      x: templateInstance.rot.x,
      y: templateInstance.rot.y,
      z: templateInstance.rot.z,
    } : undefined,
  };
  
  // Assign profile ref (use estimated if missing)
  let profileRef = templateInstance.profileRef;
  
  if (!profileRef && templateInstance.kind === 'profileExtrusion') {
    // Generate estimated profile reference
    profileRef = {
      type: 'estimated',
      estimatedFrom: templateInstance.componentModelId,
      meta: {
        confidence: 0.7,
        source: 'auto-estimated',
      },
    };
  }
  
  // Assign material key (from instance or from global material rules)
  const materialKey = templateInstance.materialKey;
  
  return {
    id: templateInstance.id,
    name: templateInstance.name,
    componentModelId: templateInstance.componentModelId,
    kind: templateInstance.kind,
    dimsMm,
    posMm,
    rotDeg,
    expr,
    profileRef,
    materialRole: templateInstance.materialRole,
    materialKey,
    sku: templateInstance.sku,
    meta: {
      ...templateInstance.meta,
      visible: true,
      selectable: true,
    },
  };
}

/**
 * Evaluate visibility condition from meta
 */
async function evaluateVisibility(
  templateInstance: TemplateInstance,
  context: EvaluationContext
): Promise<boolean> {
  if (!templateInstance.meta?.visible) {
    return true; // Default to visible
  }
  
  const visibleExpr = templateInstance.meta.visible;
  
  // If it's already a boolean, return it
  if (typeof visibleExpr === 'boolean') {
    return visibleExpr;
  }
  
  // If it's a string expression, evaluate it
  if (typeof visibleExpr === 'string') {
    try {
      const result = evaluateExpression(visibleExpr, context);
      return Boolean(result);
    } catch {
      return true; // Default to visible on error
    }
  }
  
  return true;
}

/**
 * Update a resolved product with a component instance change
 * (for editing support - back-propagates to globals or creates override)
 */
export function updateResolvedInstance(
  product: ResolvedProduct,
  instanceId: string,
  updates: Partial<{
    dimsMm: { x?: number; y?: number; z?: number };
    posMm: { x?: number; y?: number; z?: number };
    rotDeg: { x?: number; y?: number; z?: number };
    materialKey: string;
    profileRef: ResolvedComponentInstance['profileRef'];
  }>
): ResolvedProduct {
  const instances = product.instances.map(inst => {
    if (inst.id !== instanceId) return inst;
    
    const updated = { ...inst };
    
    // Update dims (numeric override for now)
    if (updates.dimsMm) {
      updated.dimsMm = { ...updated.dimsMm, ...updates.dimsMm };
    }
    
    // Update pos (numeric override)
    if (updates.posMm) {
      updated.posMm = { ...updated.posMm, ...updates.posMm };
    }
    
    // Update rot (numeric override)
    if (updates.rotDeg) {
      updated.rotDeg = { ...updated.rotDeg, ...updates.rotDeg };
    }
    
    // Update material
    if (updates.materialKey !== undefined) {
      updated.materialKey = updates.materialKey;
    }
    
    // Update profile
    if (updates.profileRef !== undefined) {
      updated.profileRef = updates.profileRef;
    }
    
    return updated;
  });
  
  return {
    ...product,
    instances,
    meta: {
      ...product.meta,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Get component by ID
 */
export function getComponentById(
  product: ResolvedProduct,
  instanceId: string
): ResolvedComponentInstance | undefined {
  return product.instances.find(inst => inst.id === instanceId);
}

/**
 * Get all components of a specific kind
 */
export function getComponentsByKind(
  product: ResolvedProduct,
  kind: ResolvedComponentInstance['kind']
): ResolvedComponentInstance[] {
  return product.instances.filter(inst => inst.kind === kind);
}

/**
 * Get all components with a specific material role
 */
export function getComponentsByMaterialRole(
  product: ResolvedProduct,
  role: ResolvedComponentInstance['materialRole']
): ResolvedComponentInstance[] {
  return product.instances.filter(inst => inst.materialRole === role);
}
