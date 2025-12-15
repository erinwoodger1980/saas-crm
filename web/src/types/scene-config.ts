/**
 * Scene Configuration Types
 * Single source of truth for 3D door configurator state
 * Replaces FileMaker Substitute() with strongly-typed TypeScript
 */

export type CameraMode = 'Perspective' | 'Ortho';

export interface CameraState {
  mode: CameraMode;
  position: [number, number, number];
  rotation: [number, number, number];
  target: [number, number, number];
  zoom: number; // Ortho only
  fov?: number; // Perspective only
}

export interface ComponentVisibility {
  [componentId: string]: boolean;
}

export interface LightingConfig {
  /** Dynamic bounds calculated from product extents */
  boundsX: [number, number];
  boundsZ: [number, number];
  intensity: number;
  shadowCatcherDiameter: number;
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Enable/disable shadows */
  castShadows: boolean;
}

export interface UIToggles {
  /** Show measurement guides */
  guides: boolean;
  /** Show XYZ axis helper */
  axis: boolean;
  /** Show component tree panel */
  componentList: boolean;
  /** Show dimension annotations */
  dimensions: boolean;
}

export interface MaterialDefinition {
  id: string;
  name: string;
  type: 'wood' | 'glass' | 'metal' | 'painted';
  baseColor: string;
  roughness: number;
  metalness: number;
  /** Optional texture map URL */
  textureUrl?: string;
  /** Optional normal map URL */
  normalMapUrl?: string;
}

export interface ComponentNode {
  id: string;
  name: string;
  type: 'frame' | 'leaf' | 'glazing' | 'ironmongery' | 'panel' | 'group';
  /** Parent component ID for hierarchy */
  parentId?: string;
  /** Material assignment */
  materialId?: string;
  /** Geometry data */
  geometry?: {
    type: 'box' | 'extrude' | 'cylinder' | 'custom';
    dimensions?: [number, number, number];
    position: [number, number, number];
    rotation?: [number, number, number];
    /** Custom geometry data for complex shapes */
    customData?: any;
  };
  /** Child components */
  children?: ComponentNode[];
  /** Visibility state */
  visible: boolean;
}

export interface ProductDimensions {
  /** Width in mm */
  width: number;
  /** Height in mm */
  height: number;
  /** Depth/thickness in mm */
  depth: number;
  /** Computed bounds for lighting */
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

/**
 * Complete scene configuration
 * This is the single source of truth persisted to database
 */
export interface SceneConfig {
  /** Version for migration compatibility */
  version: string;
  /** Timestamp of last update */
  updatedAt: string;
  
  /** Product physical dimensions */
  dimensions: ProductDimensions;
  
  /** Hierarchical component tree */
  components: ComponentNode[];
  
  /** Material library */
  materials: MaterialDefinition[];
  
  /** Camera state - persists exactly */
  camera: CameraState;
  
  /** Component visibility map for quick lookup */
  visibility: ComponentVisibility;
  
  /** Lighting configuration scaled to product */
  lighting: LightingConfig;
  
  /** UI state toggles */
  ui: UIToggles;
  
  /** Additional metadata */
  metadata?: {
    productName?: string;
    configuredBy?: string;
    notes?: string;
  };
}

/**
 * Default camera state matching FileMaker initial view
 */
export const DEFAULT_CAMERA_STATE: CameraState = {
  mode: 'Perspective',
  position: [0, 0, 15], // Units match door scale (1 unit = 1mm in scene)
  rotation: [0, 0, 0],
  target: [0, 0, 0],
  zoom: 1,
  fov: 35,
};

/**
 * Default UI toggles
 */
export const DEFAULT_UI_TOGGLES: UIToggles = {
  guides: false,
  axis: false,
  componentList: true,
  dimensions: false,
};

/**
 * Create default scene config for a new door
 */
export function createDefaultSceneConfig(
  width: number,
  height: number,
  depth: number
): SceneConfig {
  const bounds = {
    min: [-width / 2, -height / 2, -depth / 2] as [number, number, number],
    max: [width / 2, height / 2, depth / 2] as [number, number, number],
  };
  
  // Calculate lighting bounds (extend 50% beyond product)
  const boundsX: [number, number] = [bounds.min[0] * 1.5, bounds.max[0] * 1.5];
  const boundsZ: [number, number] = [bounds.min[2] * 1.5, bounds.max[2] * 1.5];
  const shadowCatcherDiameter = Math.max(width, height) * 2;
  
  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    dimensions: {
      width,
      height,
      depth,
      bounds,
    },
    components: [],
    materials: [],
    camera: { ...DEFAULT_CAMERA_STATE },
    visibility: {},
    lighting: {
      boundsX,
      boundsZ,
      intensity: 1.6,
      shadowCatcherDiameter,
      ambientIntensity: 0.45,
      castShadows: true,
    },
    ui: { ...DEFAULT_UI_TOGGLES },
  };
}

/**
 * Calculate orthographic zoom to fit product in viewport
 * Matches FileMaker auto-fit logic exactly
 */
export function calculateOrthoZoom(
  productWidth: number,
  productHeight: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  const zoomFromHeight = (viewportHeight / productHeight) * 0.66;
  const zoomFromWidth = (viewportWidth / productWidth) * 0.4;
  return Math.min(zoomFromHeight, zoomFromWidth);
}

/**
 * Build flat visibility map from component tree
 */
export function buildVisibilityMap(components: ComponentNode[]): ComponentVisibility {
  const map: ComponentVisibility = {};
  
  function traverse(node: ComponentNode) {
    map[node.id] = node.visible;
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  components.forEach(traverse);
  return map;
}

/**
 * Update visibility in component tree from flat map
 */
export function applyVisibilityMap(
  components: ComponentNode[],
  visibility: ComponentVisibility
): ComponentNode[] {
  function updateNode(node: ComponentNode): ComponentNode {
    const updated = {
      ...node,
      visible: visibility[node.id] ?? node.visible,
    };
    
    if (updated.children) {
      updated.children = updated.children.map(updateNode);
    }
    
    return updated;
  }
  
  return components.map(updateNode);
}
