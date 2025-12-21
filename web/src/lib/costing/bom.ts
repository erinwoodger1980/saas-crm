/**
 * Bill of Materials (BOM) Generator
 * 
 * Generates a comprehensive BOM from a ResolvedProduct
 * - Material volumes and areas
 * - Hardware items
 * - Finishing requirements
 */

import type {
  ResolvedProduct,
  ResolvedComponentInstance,
  BomLine,
} from '@/types/resolved-product';

export interface BomOptions {
  includeMaterials?: boolean;
  includeHardware?: boolean;
  includeFinishing?: boolean;
  wasteFactorPercent?: number;
}

/**
 * Generate BOM from resolved product
 */
export function generateBom(
  product: ResolvedProduct,
  options: BomOptions = {}
): BomLine[] {
  const {
    includeMaterials = true,
    includeHardware = true,
    includeFinishing = true,
    wasteFactorPercent = 15,
  } = options;
  
  const bom: BomLine[] = [];
  let lineId = 1;
  
  // Group components by material role and material key
  const materialGroups = new Map<string, ResolvedComponentInstance[]>();
  
  for (const instance of product.instances) {
    if (!includeMaterials && instance.kind !== 'gltf') continue;
    
    const groupKey = `${instance.materialRole}:${instance.materialKey || 'default'}`;
    
    if (!materialGroups.has(groupKey)) {
      materialGroups.set(groupKey, []);
    }
    materialGroups.get(groupKey)!.push(instance);
  }
  
  // Generate BOM lines for each material group
  for (const [groupKey, instances] of materialGroups) {
    const [materialRole, materialKey] = groupKey.split(':');
    
    // Calculate total volume/area for this material
    let totalVolumeMm3 = 0;
    let totalAreaMm2 = 0;
    
    for (const instance of instances) {
      const volume = calculateVolume(instance);
      const area = calculateSurfaceArea(instance);
      
      totalVolumeMm3 += volume;
      totalAreaMm2 += area;
    }
    
    // Convert to standard units
    const volumeM3 = totalVolumeMm3 / 1e9;
    const areaM2 = totalAreaMm2 / 1e6;
    
    // Apply waste factor
    const volumeM3WithWaste = volumeM3 * (1 + wasteFactorPercent / 100);
    const areaM2WithWaste = areaM2 * (1 + wasteFactorPercent / 100);
    
    // Determine unit and quantity based on material role
    let unit = 'm³';
    let quantity = volumeM3WithWaste;
    
    if (materialRole === 'glass' || materialRole === 'panelCore') {
      unit = 'm²';
      quantity = areaM2WithWaste;
    } else if (materialRole === 'rubber' || materialRole === 'seal') {
      // Seals are typically measured in linear meters
      unit = 'm';
      quantity = instances.reduce((sum, inst) => {
        return sum + Math.max(inst.dimsMm.x, inst.dimsMm.y, inst.dimsMm.z) / 1000;
      }, 0);
    }
    
    bom.push({
      id: `bom-${lineId++}`,
      componentId: instances[0].id,
      componentName: `${materialRole} - ${materialKey}`,
      material: materialKey,
      description: `${instances.length} component(s) - ${materialRole}`,
      quantity: Math.ceil(quantity * 100) / 100, // Round to 2 decimals
      unit,
      meta: {
        materialRole,
        componentCount: instances.length,
        wasteFactor: wasteFactorPercent,
      },
    });
  }
  
  // Add hardware items
  if (includeHardware) {
    for (const hw of product.hardware) {
      bom.push({
        id: `bom-${lineId++}`,
        componentId: hw.id,
        componentName: hw.name,
        material: 'Hardware',
        description: hw.componentModelId,
        quantity: hw.quantity,
        unit: 'ea',
        sku: hw.sku,
        supplier: hw.supplier,
        unitCost: hw.unitCost,
        totalCost: hw.unitCost ? hw.unitCost * hw.quantity : undefined,
      });
    }
  }
  
  // Add finishing requirements
  if (includeFinishing) {
    const finishArea = calculateFinishableArea(product);
    
    if (finishArea > 0) {
      bom.push({
        id: `bom-${lineId++}`,
        componentId: 'finishing',
        componentName: 'Finishing',
        material: 'Paint/Stain/Varnish',
        description: 'Surface finishing (all exposed faces)',
        quantity: Math.ceil(finishArea * 100) / 100,
        unit: 'm²',
        meta: {
          totalAreaMm2: finishArea * 1e6,
        },
      });
    }
  }
  
  return bom;
}

/**
 * Calculate volume of a component in mm³
 */
function calculateVolume(instance: ResolvedComponentInstance): number {
  const { dimsMm } = instance;
  
  switch (instance.kind) {
    case 'profileExtrusion':
      // Assume profile cross-section is 20% of bounding box (conservative estimate)
      // Real calculation would parse SVG and get actual area
      const profileArea = dimsMm.x * dimsMm.z * 0.2;
      return profileArea * dimsMm.y; // y is length for extrusions
      
    case 'panel':
    case 'glass':
      return dimsMm.x * dimsMm.y * dimsMm.z;
      
    case 'seal':
      // Seal cross-section area * length
      const sealArea = 100; // Typical seal cross-section ~10mm x 10mm
      return sealArea * Math.max(dimsMm.x, dimsMm.y, dimsMm.z);
      
    case 'gltf':
    case 'misc':
    default:
      return 0; // Hardware doesn't count as material volume
  }
}

/**
 * Calculate surface area of a component in mm²
 */
function calculateSurfaceArea(instance: ResolvedComponentInstance): number {
  const { dimsMm } = instance;
  
  switch (instance.kind) {
    case 'panel':
    case 'glass':
      // Both faces
      return dimsMm.x * dimsMm.y * 2;
      
    case 'profileExtrusion':
      // Approximate perimeter * length (rough estimate)
      const perimeter = (dimsMm.x + dimsMm.z) * 2;
      return perimeter * dimsMm.y;
      
    default:
      return 0;
  }
}

/**
 * Calculate total finishable area for a product
 */
function calculateFinishableArea(product: ResolvedProduct): number {
  let totalAreaMm2 = 0;
  
  // Only count timber and panel components
  for (const instance of product.instances) {
    if (instance.materialRole === 'timber' || instance.materialRole === 'panelCore') {
      totalAreaMm2 += calculateSurfaceArea(instance);
    }
  }
  
  // Convert to m²
  return totalAreaMm2 / 1e6;
}
