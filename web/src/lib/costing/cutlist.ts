/**
 * Cutlist Generator
 * 
 * Generates a comprehensive cutting list from a ResolvedProduct
 * - Profiles (extrusions) with lengths and cutting angles
 * - Panels with dimensions
 * - Glass with dimensions
 */

import type {
  ResolvedProduct,
  ResolvedComponentInstance,
  CutLine,
} from '@/types/resolved-product';

export interface CutlistOptions {
  includeProfiles?: boolean;
  includePanels?: boolean;
  includeGlass?: boolean;
  groupByProfile?: boolean;
  groupByMaterial?: boolean;
}

/**
 * Generate cutlist from resolved product
 */
export function generateCutlist(
  product: ResolvedProduct,
  options: CutlistOptions = {}
): CutLine[] {
  const {
    includeProfiles = true,
    includePanels = true,
    includeGlass = true,
    groupByProfile = false,
    groupByMaterial = true,
  } = options;
  
  const cutlist: CutLine[] = [];
  let lineId = 1;
  
  // Process profile extrusions
  if (includeProfiles) {
    const profiles = product.instances.filter(inst => inst.kind === 'profileExtrusion');
    
    if (groupByProfile || groupByMaterial) {
      // Group identical cuts together
      const groups = groupIdenticalCuts(profiles);
      
      for (const [key, instances] of groups) {
        const first = instances[0];
        const lengthMm = Math.max(first.dimsMm.x, first.dimsMm.y, first.dimsMm.z);
        
        cutlist.push({
          id: `cut-${lineId++}`,
          componentId: instances.map(i => i.id).join(','),
          componentName: first.name,
          profileId: first.profileRef?.fileId || first.profileRef?.type || 'estimated',
          profileName: first.componentModelId,
          material: first.materialKey || `${first.materialRole}-default`,
          lengthMm,
          quantity: instances.length,
          notes: instances.length > 1 ? `${instances.length} identical pieces` : undefined,
          meta: {
            kind: 'profileExtrusion',
            crossSection: {
              width: Math.min(first.dimsMm.x, first.dimsMm.z),
              depth: Math.max(first.dimsMm.x, first.dimsMm.z),
            },
          },
        });
      }
    } else {
      // List each cut individually
      for (const instance of profiles) {
        const lengthMm = Math.max(instance.dimsMm.x, instance.dimsMm.y, instance.dimsMm.z);
        
        cutlist.push({
          id: `cut-${lineId++}`,
          componentId: instance.id,
          componentName: instance.name,
          profileId: instance.profileRef?.fileId || instance.profileRef?.type || 'estimated',
          profileName: instance.componentModelId,
          material: instance.materialKey || `${instance.materialRole}-default`,
          lengthMm,
          quantity: 1,
          meta: {
            kind: 'profileExtrusion',
          },
        });
      }
    }
  }
  
  // Process panels
  if (includePanels) {
    const panels = product.instances.filter(inst => inst.kind === 'panel');
    
    for (const panel of panels) {
      cutlist.push({
        id: `cut-${lineId++}`,
        componentId: panel.id,
        componentName: panel.name,
        material: panel.materialKey || `${panel.materialRole}-default`,
        lengthMm: panel.dimsMm.y,
        widthMm: panel.dimsMm.x,
        thicknessMm: panel.dimsMm.z,
        quantity: 1,
        notes: panel.meta?.rounded ? `Rounded corners, radius: ${panel.meta.radius}mm` : undefined,
        meta: {
          kind: 'panel',
          area: (panel.dimsMm.x * panel.dimsMm.y) / 1e6, // m²
        },
      });
    }
  }
  
  // Process glass
  if (includeGlass) {
    const glassItems = product.instances.filter(inst => inst.kind === 'glass');
    
    for (const glass of glassItems) {
      cutlist.push({
        id: `cut-${lineId++}`,
        componentId: glass.id,
        componentName: glass.name,
        material: glass.materialKey || 'clear-glass',
        lengthMm: glass.dimsMm.y,
        widthMm: glass.dimsMm.x,
        thicknessMm: glass.dimsMm.z,
        quantity: 1,
        notes: 'Toughened safety glass required',
        meta: {
          kind: 'glass',
          area: (glass.dimsMm.x * glass.dimsMm.y) / 1e6, // m²
        },
      });
    }
  }
  
  return cutlist;
}

/**
 * Group identical cuts together
 */
function groupIdenticalCuts(
  instances: ResolvedComponentInstance[]
): Map<string, ResolvedComponentInstance[]> {
  const groups = new Map<string, ResolvedComponentInstance[]>();
  
  for (const instance of instances) {
    // Create a key based on profile, material, and dimensions
    const lengthMm = Math.max(instance.dimsMm.x, instance.dimsMm.y, instance.dimsMm.z);
    const crossW = Math.min(instance.dimsMm.x, instance.dimsMm.z);
    const crossD = Math.max(instance.dimsMm.x, instance.dimsMm.z);
    
    const key = [
      instance.componentModelId,
      instance.materialKey || instance.materialRole,
      Math.round(lengthMm),
      Math.round(crossW),
      Math.round(crossD),
    ].join('|');
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(instance);
  }
  
  return groups;
}

/**
 * Calculate total linear meters of profiles in cutlist
 */
export function calculateTotalLinearMeters(cutlist: CutLine[]): number {
  return cutlist
    .filter(cut => cut.meta?.kind === 'profileExtrusion')
    .reduce((total, cut) => {
      return total + (cut.lengthMm / 1000) * cut.quantity;
    }, 0);
}

/**
 * Calculate total area of panels/glass in cutlist
 */
export function calculateTotalArea(cutlist: CutLine[], kind?: 'panel' | 'glass'): number {
  return cutlist
    .filter(cut => !kind || cut.meta?.kind === kind)
    .filter(cut => cut.meta?.kind === 'panel' || cut.meta?.kind === 'glass')
    .reduce((total, cut) => {
      const area = cut.meta?.area || 0;
      return total + area * cut.quantity;
    }, 0);
}

/**
 * Get cutlist grouped by material
 */
export function groupCutlistByMaterial(cutlist: CutLine[]): Map<string, CutLine[]> {
  const groups = new Map<string, CutLine[]>();
  
  for (const cut of cutlist) {
    if (!groups.has(cut.material)) {
      groups.set(cut.material, []);
    }
    groups.get(cut.material)!.push(cut);
  }
  
  return groups;
}

/**
 * Get cutlist grouped by profile
 */
export function groupCutlistByProfile(cutlist: CutLine[]): Map<string, CutLine[]> {
  const groups = new Map<string, CutLine[]>();
  
  for (const cut of cutlist) {
    if (!cut.profileName) continue;
    
    if (!groups.has(cut.profileName)) {
      groups.set(cut.profileName, []);
    }
    groups.get(cut.profileName)!.push(cut);
  }
  
  return groups;
}
