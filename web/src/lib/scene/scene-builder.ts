/**
 * Scene Config Builder from Resolved Product
 * 
 * Converts ResolvedProduct → SceneConfig for 3D rendering
 * - Creates component tree from instances
 * - Generates geometry for each component kind
 * - Assigns materials
 * - Sets up camera and lighting
 */

import type { ResolvedProduct, ResolvedComponentInstance } from '@/types/resolved-product';
import type { SceneConfig, ComponentNode, MaterialDefinition } from '@/types/scene-config';

/**
 * Build a SceneConfig from a ResolvedProduct
 */
export function buildSceneFromResolvedProduct(product: ResolvedProduct): SceneConfig {
  // Create component nodes
  const components = product.instances.map(instance => instanceToComponentNode(instance));
  
  // Create materials (map from product materials to SceneConfig materials)
  const materials = buildMaterialDefinitions(product);
  
  // Calculate product dimensions from instances
  const dimensions = calculateProductDimensions(product);
  
  // Set up camera to view the product
  const camera = setupDefaultCamera(dimensions);
  
  // Set up lighting
  const lighting = setupLighting(dimensions);
  
  // Build visibility map
  const visibility: Record<string, boolean> = {};
  for (const instance of product.instances) {
    visibility[instance.id] = instance.meta?.visible !== false;
  }
  
  return {
    version: '2.0',
    updatedAt: new Date().toISOString(),
    dimensions,
    components,
    materials,
    camera,
    visibility,
    lighting,
    ui: {
      guides: false,
      axis: false,
      componentList: true,
      dimensions: false,
    },
    customData: {
      resolvedProduct: product,
      templateId: product.templateId,
    },
    metadata: {
      productName: product.name || 'Untitled Product',
      configuredBy: 'AI Template',
    },
  };
}

/**
 * Convert a ResolvedComponentInstance to a ComponentNode
 */
function instanceToComponentNode(instance: ResolvedComponentInstance): ComponentNode {
  const { id, name, dimsMm, posMm, rotDeg, kind, materialKey, profileRef } = instance;
  
  // Determine component type
  const type = mapKindToType(kind);
  
  // Determine role
  const role = mapKindToRole(kind, name);
  
  // Build geometry
  const geometry = buildGeometry(instance);
  
  // Build profile if it's an extrusion
  const profile = profileRef ? {
    sourceType: profileRef.type === 'svgText' ? 'svg' as const : 
                profileRef.type === 'dxf' ? 'dxf' as const :
                profileRef.type === 'svgFile' ? 'svg' as const :
                'estimated' as const,
    svgText: profileRef.svgText,
    dxfText: undefined,
    gltfAssetId: profileRef.fileId,
    depthMm: dimsMm.z,
    scale: 1.0,
  } : undefined;
  
  // Convert rotation from degrees to radians
  const rotation: [number, number, number] = [
    (rotDeg.x * Math.PI) / 180,
    (rotDeg.y * Math.PI) / 180,
    (rotDeg.z * Math.PI) / 180,
  ];
  
  return {
    id,
    name,
    type,
    role,
    visible: true,
    materialId: materialKey,
    dimsMm: {
      width: dimsMm.x,
      height: dimsMm.y,
      depth: dimsMm.z,
    },
    position: [posMm.x, posMm.y, posMm.z],
    rotation,
    scale: [1, 1, 1],
    profile,
    constraints: {
      editable: true,
      axes: 'XYZ',
    },
    geometry,
  };
}

/**
 * Map component kind to ComponentNode type
 */
function mapKindToType(kind: ResolvedComponentInstance['kind']): ComponentNode['type'] {
  switch (kind) {
    case 'profileExtrusion':
      return 'frame';
    case 'panel':
      return 'panel';
    case 'glass':
      return 'glazing';
    case 'gltf':
      return 'ironmongery';
    case 'seal':
      return 'frame';
    case 'misc':
    default:
      return 'group';
  }
}

/**
 * Map kind and name to component role
 */
function mapKindToRole(
  kind: ResolvedComponentInstance['kind'],
  name: string
): ComponentNode['role'] {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('stile')) return 'stile';
  if (nameLower.includes('rail')) return 'rail';
  if (nameLower.includes('panel')) return 'panel';
  if (nameLower.includes('glass') || nameLower.includes('glazing')) return 'glass';
  if (nameLower.includes('seal')) return 'seal';
  if (kind === 'gltf') return 'hardware';
  
  return 'other';
}

/**
 * Build geometry definition for a component instance
 */
function buildGeometry(instance: ResolvedComponentInstance): ComponentNode['geometry'] {
  const { kind, dimsMm, posMm, rotDeg, profileRef } = instance;
  
  const position: [number, number, number] = [posMm.x, posMm.y, posMm.z];
  const rotation: [number, number, number] = [
    (rotDeg.x * Math.PI) / 180,
    (rotDeg.y * Math.PI) / 180,
    (rotDeg.z * Math.PI) / 180,
  ];
  
  switch (kind) {
    case 'profileExtrusion':
      // Use shapeExtrude geometry with profile
      if (profileRef?.svgText) {
        return {
          type: 'shapeExtrude',
          dimensions: [dimsMm.x, dimsMm.y, dimsMm.z],
          position,
          rotation,
          customData: {
            shape: {
              points: [], // Will be parsed from SVG at render time
            },
            extrudeSettings: {
              depth: dimsMm.y, // Extrude along Y axis (length)
              bevelEnabled: false,
            },
          },
        };
      }
      // Fallback to simple box for estimated profiles
      return {
        type: 'box',
        dimensions: [dimsMm.x, dimsMm.y, dimsMm.z],
        position,
        rotation,
      };
      
    case 'panel':
      return {
        type: 'box',
        dimensions: [dimsMm.x, dimsMm.y, dimsMm.z],
        position,
        rotation,
      };
      
    case 'glass':
      return {
        type: 'box',
        dimensions: [dimsMm.x, dimsMm.y, dimsMm.z],
        position,
        rotation,
      };
      
    case 'gltf':
      return {
        type: 'gltf',
        dimensions: [dimsMm.x, dimsMm.y, dimsMm.z],
        position,
        rotation,
        customData: {
          assetId: profileRef?.fileId || 'default-hardware',
          assetTransform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
        },
      };
      
    case 'seal':
      // Thin box or tube
      return {
        type: 'box',
        dimensions: [dimsMm.x, dimsMm.y, dimsMm.z],
        position,
        rotation,
      };
      
    case 'misc':
    default:
      return {
        type: 'box',
        dimensions: [dimsMm.x, dimsMm.y, dimsMm.z],
        position,
        rotation,
      };
  }
}

/**
 * Build material definitions from product material assignments
 */
function buildMaterialDefinitions(product: ResolvedProduct): MaterialDefinition[] {
  const materials: MaterialDefinition[] = [];
  
  // Default material presets
  const materialPresets: Record<string, Partial<MaterialDefinition>> = {
    'oak-natural': {
      type: 'wood',
      baseColor: '#b8956a',
      roughness: 0.8,
      metalness: 0.0,
    },
    'oak-veneered-ply': {
      type: 'wood',
      baseColor: '#b8956a',
      roughness: 0.7,
      metalness: 0.0,
    },
    'accoya-natural': {
      type: 'wood',
      baseColor: '#d4c4a8',
      roughness: 0.75,
      metalness: 0.0,
    },
    'sapele-natural': {
      type: 'wood',
      baseColor: '#8b4513',
      roughness: 0.7,
      metalness: 0.0,
    },
    'pine-natural': {
      type: 'wood',
      baseColor: '#eedd82',
      roughness: 0.85,
      metalness: 0.0,
    },
    'clear-glass': {
      type: 'glass',
      baseColor: '#ffffff',
      roughness: 0.0,
      metalness: 0.0,
      transmission: 0.95,
      ior: 1.5,
      thickness: 6,
    },
    'frosted-glass': {
      type: 'glass',
      baseColor: '#f0f0f0',
      roughness: 0.6,
      metalness: 0.0,
      transmission: 0.7,
      ior: 1.5,
      thickness: 6,
    },
    'stained-glass': {
      type: 'glass',
      baseColor: '#4169e1',
      roughness: 0.2,
      metalness: 0.0,
      transmission: 0.8,
      ior: 1.5,
      thickness: 6,
    },
    'rubber-black': {
      type: 'painted',
      baseColor: '#1a1a1a',
      roughness: 0.95,
      metalness: 0.0,
    },
    'polished-chrome': {
      type: 'metal',
      baseColor: '#d4d4d4',
      roughness: 0.1,
      metalness: 1.0,
    },
    'polished-brass': {
      type: 'metal',
      baseColor: '#b8860b',
      roughness: 0.15,
      metalness: 1.0,
    },
    'matte-black': {
      type: 'metal',
      baseColor: '#2a2a2a',
      roughness: 0.6,
      metalness: 0.8,
    },
    'painted-ral-9016': {
      type: 'painted',
      baseColor: '#f1f0ea',
      roughness: 0.4,
      metalness: 0.0,
    },
    'painted-ral-9005': {
      type: 'painted',
      baseColor: '#0e0e10',
      roughness: 0.35,
      metalness: 0.0,
    },
    'painted-ral-7016': {
      type: 'painted',
      baseColor: '#383e42',
      roughness: 0.4,
      metalness: 0.0,
    },
  };
  
  // Build materials from product material assignments
  for (const materialAssignment of product.materials) {
    const preset = materialPresets[materialAssignment.materialKey];
    
    if (preset) {
      materials.push({
        id: materialAssignment.materialKey,
        name: materialAssignment.name || materialAssignment.materialKey,
        ...preset,
      } as MaterialDefinition);
    }
  }
  
  // Add materials from instances that might not be in global assignments
  for (const instance of product.instances) {
    if (instance.materialKey && !materials.find(m => m.id === instance.materialKey)) {
      const preset = materialPresets[instance.materialKey];
      if (preset) {
        materials.push({
          id: instance.materialKey,
          name: instance.materialKey,
          ...preset,
        } as MaterialDefinition);
      }
    }
  }
  
  return materials;
}

/**
 * Calculate product dimensions from all instances
 */
function calculateProductDimensions(product: ResolvedProduct): SceneConfig['dimensions'] {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  for (const instance of product.instances) {
    const { posMm, dimsMm } = instance;
    
    // Calculate bounding box
    const x1 = posMm.x - dimsMm.x / 2;
    const x2 = posMm.x + dimsMm.x / 2;
    const y1 = posMm.y - dimsMm.y / 2;
    const y2 = posMm.y + dimsMm.y / 2;
    const z1 = posMm.z - dimsMm.z / 2;
    const z2 = posMm.z + dimsMm.z / 2;
    
    minX = Math.min(minX, x1);
    maxX = Math.max(maxX, x2);
    minY = Math.min(minY, y1);
    maxY = Math.max(maxY, y2);
    minZ = Math.min(minZ, z1);
    maxZ = Math.max(maxZ, z2);
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  const depth = maxZ - minZ;
  
  return {
    width,
    height,
    depth,
    bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
  };
}

/**
 * Setup default camera to view the product
 */
function setupDefaultCamera(dimensions: SceneConfig['dimensions']): SceneConfig['camera'] {
  const { width, height, depth } = dimensions;
  
  // Calculate camera distance to fit product in view
  const maxDim = Math.max(width, height, depth);
  const distance = maxDim * 2;
  
  // 3/4 view position
  const angle = Math.PI / 4; // 45 degrees
  const elevation = Math.PI / 6; // 30 degrees
  
  const x = distance * Math.cos(elevation) * Math.sin(angle);
  const y = distance * Math.sin(elevation);
  const z = distance * Math.cos(elevation) * Math.cos(angle);
  
  return {
    mode: 'Perspective',
    position: [x, y, z],
    rotation: [0, 0, 0],
    target: [width / 2, height / 2, 0],
    zoom: 1,
    fov: 50,
  };
}

/**
 * Setup lighting based on product dimensions
 */
function setupLighting(dimensions: SceneConfig['dimensions']): SceneConfig['lighting'] {
  const { width, depth } = dimensions;
  
  const padding = 500; // 500mm padding around product
  
  return {
    boundsX: [-padding, width + padding],
    boundsZ: [-padding, depth + padding],
    intensity: 1.0,
    shadowCatcherDiameter: Math.max(width, depth) + padding * 2,
    ambientIntensity: 0.4,
    castShadows: true,
  };
}
