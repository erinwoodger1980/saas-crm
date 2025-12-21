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
  roughness?: number;
  metalness?: number;
  /** Optional texture map URL */
  textureUrl?: string;
  /** Optional normal map URL */
  normalMapUrl?: string;
  /** Optional alpha map URL for stained glass or patterns */
  alphaMapUrl?: string;
  /** Optional clearcoat amount (0-1) */
  clearcoat?: number;
  /** Optional clearcoat roughness (0-1) */
  clearcoatRoughness?: number;
  /** Optional transmission for glass (0-1) */
  transmission?: number;
  /** Optional IOR for glass */
  ior?: number;
  /** Optional thickness for glass materials (mm) */
  thickness?: number;
  /** Optional attenuation color for glass */
  attenuationColor?: string;
  /** Optional attenuation distance for glass */
  attenuationDistance?: number;
  /** Optional environment map intensity */
  envMapIntensity?: number;
  /** Dimensions for texture repeat calculation (mm) */
  dimensions?: [number, number, number];
}

/**
 * Component role for material and profile assignment
 */
export type ComponentRole = 'stile' | 'rail' | 'panel' | 'glass' | 'hardware' | 'seal' | 'other';

/**
 * Edit constraint for component transformation
 */
export interface EditConstraint {
  /** Axis allowed for movement: 'X' | 'Y' | 'Z' | 'XY' | 'XZ' | 'YZ' */
  axes?: string;
  /** Minimum value in mm (per axis) */
  min?: number;
  /** Maximum value in mm (per axis) */
  max?: number;
  /** Snap increment in mm */
  snapSize?: number;
  /** Whether this component can be edited at all */
  editable?: boolean;
}

/**
 * Profile definition with source tracking
 */
export interface ComponentProfile {
  /** Type of profile source */
  sourceType: 'estimated' | 'svg' | 'dxf' | 'gltf';
  /** SVG text if sourceType='svg' */
  svgText?: string;
  /** DXF text if sourceType='dxf' */
  dxfText?: string;
  /** GLTF asset ID if sourceType='gltf' */
  gltfAssetId?: string;
  /** Extrusion depth in mm */
  depthMm: number;
  /** Scale factor: mm per SVG unit */
  scale: number;
}

export interface ComponentNode {
  id: string;
  name: string;
  type: 'frame' | 'leaf' | 'glazing' | 'ironmongery' | 'panel' | 'group';
  /** Parent component ID for hierarchy */
  parentId?: string;
  /** Material assignment */
  materialId?: string;
  
  /** Component role for deterministic material/profile assignment */
  role?: ComponentRole;
  
  /** Physical dimensions in mm */
  dimsMm?: {
    width: number;
    height: number;
    depth: number;
  };
  
  /** Position in 3D space (mm) */
  position?: [number, number, number];
  
  /** Rotation in radians */
  rotation?: [number, number, number];
  
  /** Scale factors (1.0 = 100%) */
  scale?: [number, number, number];
  
  /** Profile definition with source tracking */
  profile?: ComponentProfile;
  
  /** Edit constraints (movement axes, limits, snapping) */
  constraints?: EditConstraint;
  
  /** Geometry data */
  geometry?: {
    type: 'box' | 'extrude' | 'cylinder' | 'custom' | 'shapeExtrude' | 'tube' | 'lathe' | 'gltf';
    dimensions?: [number, number, number];
    position: [number, number, number];
    rotation?: [number, number, number];
    /** Custom geometry data for complex shapes */
    customData?: {
      // For 'gltf': Reference to uploaded asset
      assetId?: string;
      assetTransform?: {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
      };
      
      // For 'shapeExtrude': Shape profile with optional holes
      shape?: {
        points: [number, number][]; // 2D vertices
      };
      holes?: Array<{
        points: [number, number][]; // 2D hole vertices
      }>;
      extrudeSettings?: {
        depth: number;
        bevelEnabled?: boolean;
        bevelSize?: number;
        bevelThickness?: number;
        steps?: number;
      };
      
      // For 'tube': Path-based tube geometry
      path?: {
        type: 'arc' | 'ellipse' | 'bezier' | 'polyline' | 'spline';
        // Arc params
        cx?: number;
        cy?: number;
        r?: number;
        startAngle?: number;
        endAngle?: number;
        clockwise?: boolean;
        // Ellipse params
        rx?: number;
        ry?: number;
        rotation?: number;
        // Bezier params
        p0?: [number, number];
        p1?: [number, number];
        p2?: [number, number];
        p3?: [number, number];
        // Polyline/Spline params
        points?: [number, number][];
        closed?: boolean;
        tension?: number;
      };
      tubularSegments?: number;
      radius?: number;
      radialSegments?: number;
      
      // For 'lathe': turned geometry
      profile?: {
        points: [number, number][]; // profile curve
      };
      latheSegments?: number;
      
      // Additional
      [key: string]: any;
    };
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
  
  /** Hierarchical component tree (DERIVED from customData) */
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
  
  /** 
   * Parametric source of truth
   * Components are regenerated from this data
   */
  customData?: Record<string, any>;
  
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
