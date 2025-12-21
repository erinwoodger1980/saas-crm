/**
 * Component Material Assignment System
 * Deterministic material resolver for component roles with product finish defaults
 * 
 * Pattern:
 * - Product finish sets default material sets (oak vs painted accoya)
 * - Per-role overrides (panel=veneer ply, seal=rubber, ironmongery=polished chrome, glass=physical)
 * - Falls back gracefully if material not found
 */

import { MaterialDefinition, ComponentNode, ComponentRole } from '@/types/scene-config';

export interface MaterialAssignmentConfig {
  /** Product finish type */
  productFinish: 'oak' | 'painted' | 'accoya' | 'hardwood';
  /** Override specific roles with material IDs */
  roleOverrides?: Partial<Record<ComponentRole, string>>;
}

/**
 * Get material ID for a component based on its role and product finish
 */
export function resolveMaterialForComponent(
  component: ComponentNode,
  config: MaterialAssignmentConfig,
  availableMaterials: MaterialDefinition[]
): string | undefined {
  // If already explicitly assigned, use it
  if (component.materialId) {
    return component.materialId;
  }

  const role = component.role || 'other';

  // Check role overrides first
  if (config.roleOverrides?.[role]) {
    return config.roleOverrides[role];
  }

  // Deterministic mapping by role + finish
  const materialName = getDefaultMaterialForRole(role, config.productFinish);
  if (!materialName) {
    return undefined;
  }

  // Find material by name
  const material = availableMaterials.find((m) => m.name === materialName);
  return material?.id;
}

/**
 * Get default material name for a role + finish combination
 */
function getDefaultMaterialForRole(role: ComponentRole, finish: string): string | null {
  switch (role) {
    case 'stile':
    case 'rail':
      // Structural frame - use finish
      return getFinishMaterial(finish);

    case 'panel':
      // Panel - use veneer ply
      return 'Veneer Ply';

    case 'glass':
      // Glass - always use physical glass
      return 'Architectural Glass';

    case 'hardware':
    case 'seal':
      // Hardware - polished chrome
      // Seal - natural rubber
      return role === 'hardware' ? 'Polished Chrome' : 'Rubber Seal';

    default:
      return getFinishMaterial(finish);
  }
}

/**
 * Get finish material name
 */
function getFinishMaterial(finish: string): string {
  switch (finish.toLowerCase()) {
    case 'oak':
      return 'European Oak';
    case 'painted':
      return 'Painted White';
    case 'accoya':
      return 'Accoya';
    case 'hardwood':
      return 'Brazilian Hardwood';
    default:
      return 'European Oak';
  }
}

/**
 * Assign materials to entire component tree
 */
export function assignMaterialsToComponentTree(
  components: ComponentNode[],
  config: MaterialAssignmentConfig,
  availableMaterials: MaterialDefinition[]
): ComponentNode[] {
  return components.map((node) => assignMaterialsRecursive(node, config, availableMaterials));
}

function assignMaterialsRecursive(
  node: ComponentNode,
  config: MaterialAssignmentConfig,
  availableMaterials: MaterialDefinition[]
): ComponentNode {
  const materialId = resolveMaterialForComponent(node, config, availableMaterials);

  const updated: ComponentNode = {
    ...node,
    materialId: materialId || node.materialId,
  };

  if (node.children && node.children.length > 0) {
    updated.children = node.children.map((child) =>
      assignMaterialsRecursive(child, config, availableMaterials)
    );
  }

  return updated;
}

/**
 * Create standard material library for product finishes
 */
export function createStandardMaterials(finish: string = 'oak'): MaterialDefinition[] {
  const base: MaterialDefinition[] = [
    {
      id: 'mat-oak',
      name: 'European Oak',
      type: 'wood',
      baseColor: '#C19A6B',
      roughness: 0.75,
      metalness: 0,
      clearcoat: 0,
      envMapIntensity: 0.4,
    },
    {
      id: 'mat-accoya',
      name: 'Accoya',
      type: 'wood',
      baseColor: '#B8956F',
      roughness: 0.75,
      metalness: 0,
      clearcoat: 0,
      envMapIntensity: 0.4,
    },
    {
      id: 'mat-hardwood',
      name: 'Brazilian Hardwood',
      type: 'wood',
      baseColor: '#8B4513',
      roughness: 0.75,
      metalness: 0,
      clearcoat: 0,
      envMapIntensity: 0.4,
    },
    {
      id: 'mat-painted-white',
      name: 'Painted White',
      type: 'painted',
      baseColor: '#F5F5F5',
      roughness: 0.55,
      metalness: 0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.3,
    },
    {
      id: 'mat-veneer-ply',
      name: 'Veneer Ply',
      type: 'wood',
      baseColor: '#D4A574',
      roughness: 0.65,
      metalness: 0,
      clearcoat: 0.1,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.35,
    },
    {
      id: 'mat-glass',
      name: 'Architectural Glass',
      type: 'glass',
      baseColor: '#E8F4F8',
      transmission: 0.95,
      ior: 1.52,
      thickness: 24,
      roughness: 0.05,
      envMapIntensity: 1.5,
    },
    {
      id: 'mat-chrome',
      name: 'Polished Chrome',
      type: 'metal',
      baseColor: '#C0C0C0',
      metalness: 1.0,
      roughness: 0.3,
      envMapIntensity: 1.2,
    },
    {
      id: 'mat-rubber-seal',
      name: 'Rubber Seal',
      type: 'painted',
      baseColor: '#1A1A1A',
      roughness: 0.8,
      metalness: 0,
      clearcoat: 0,
      envMapIntensity: 0.2,
    },
  ];

  return base;
}

/**
 * Get role from component type (heuristic fallback)
 */
export function inferRoleFromComponentType(
  componentType: string,
  componentName: string
): ComponentRole {
  const lowerName = componentName.toLowerCase();
  const lowerType = componentType.toLowerCase();

  if (
    lowerName.includes('stile') ||
    lowerType.includes('stile') ||
    lowerName.includes('vertical')
  ) {
    return 'stile';
  }

  if (
    lowerName.includes('rail') ||
    lowerType.includes('rail') ||
    lowerName.includes('horizontal')
  ) {
    return 'rail';
  }

  if (
    lowerName.includes('glass') ||
    lowerType.includes('glazing') ||
    lowerName.includes('pane')
  ) {
    return 'glass';
  }

  if (
    lowerName.includes('panel') ||
    lowerType.includes('panel') ||
    lowerName.includes('filling')
  ) {
    return 'panel';
  }

  if (
    lowerName.includes('hinge') ||
    lowerName.includes('lock') ||
    lowerName.includes('closer') ||
    lowerType.includes('hardware')
  ) {
    return 'hardware';
  }

  if (lowerName.includes('seal') || lowerName.includes('weather')) {
    return 'seal';
  }

  return 'other';
}
