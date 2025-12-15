/**
 * Scene Configuration Utilities
 * Helper functions for building and manipulating scene configurations
 */

import {
  SceneConfig,
  ComponentNode,
  MaterialDefinition,
  ProductDimensions,
} from '@/types/scene-config';

/**
 * Create a standard timber door component tree
 * Matches typical joinery construction hierarchy
 */
export function createStandardDoorComponents(
  width: number,
  height: number,
  depth: number
): ComponentNode[] {
  const stileWidth = 95; // mm
  const railHeight = 190; // mm
  const panelInset = 15; // mm

  return [
    {
      id: 'frame',
      name: 'Door Frame',
      type: 'group',
      visible: true,
      children: [
        // Left stile
        {
          id: 'stile-left',
          name: 'Left Stile',
          type: 'frame',
          materialId: 'timber-oak',
          visible: true,
          geometry: {
            type: 'box',
            dimensions: [stileWidth, height, depth],
            position: [-width / 2 + stileWidth / 2, 0, 0],
          },
        },
        // Right stile
        {
          id: 'stile-right',
          name: 'Right Stile',
          type: 'frame',
          materialId: 'timber-oak',
          visible: true,
          geometry: {
            type: 'box',
            dimensions: [stileWidth, height, depth],
            position: [width / 2 - stileWidth / 2, 0, 0],
          },
        },
        // Top rail
        {
          id: 'rail-top',
          name: 'Top Rail',
          type: 'frame',
          materialId: 'timber-oak',
          visible: true,
          geometry: {
            type: 'box',
            dimensions: [width - stileWidth * 2, railHeight, depth],
            position: [0, height / 2 - railHeight / 2, 0],
          },
        },
        // Bottom rail
        {
          id: 'rail-bottom',
          name: 'Bottom Rail',
          type: 'frame',
          materialId: 'timber-oak',
          visible: true,
          geometry: {
            type: 'box',
            dimensions: [width - stileWidth * 2, railHeight, depth],
            position: [0, -height / 2 + railHeight / 2, 0],
          },
        },
      ],
    },
    {
      id: 'panels',
      name: 'Panels',
      type: 'group',
      visible: true,
      children: [
        // Center panel
        {
          id: 'panel-center',
          name: 'Center Panel',
          type: 'panel',
          materialId: 'timber-oak',
          visible: true,
          geometry: {
            type: 'box',
            dimensions: [
              width - stileWidth * 2 - panelInset * 2,
              height - railHeight * 2 - panelInset * 2,
              depth * 0.6,
            ],
            position: [0, 0, 0],
          },
        },
      ],
    },
    {
      id: 'ironmongery',
      name: 'Ironmongery',
      type: 'group',
      visible: true,
      children: [
        // Door handle
        {
          id: 'handle',
          name: 'Handle',
          type: 'ironmongery',
          materialId: 'metal-brass',
          visible: true,
          geometry: {
            type: 'cylinder',
            dimensions: [15, 150, 16], // radius, height, segments
            position: [width / 2 - stileWidth - 30, 0, depth / 2 + 20],
            rotation: [0, 0, Math.PI / 2],
          },
        },
      ],
    },
  ];
}

/**
 * Create standard material library
 */
export function createStandardMaterials(): MaterialDefinition[] {
  return [
    {
      id: 'timber-oak',
      name: 'Oak Timber',
      type: 'wood',
      baseColor: '#d4a574',
      roughness: 0.65,
      metalness: 0,
    },
    {
      id: 'timber-painted-white',
      name: 'Painted White',
      type: 'painted',
      baseColor: '#f8f8f8',
      roughness: 0.4,
      metalness: 0,
    },
    {
      id: 'glass-clear',
      name: 'Clear Glass',
      type: 'glass',
      baseColor: '#ffffff',
      roughness: 0.1,
      metalness: 0,
    },
    {
      id: 'metal-brass',
      name: 'Brass',
      type: 'metal',
      baseColor: '#b5a642',
      roughness: 0.3,
      metalness: 0.9,
    },
  ];
}

/**
 * Calculate product bounds from component tree
 */
export function calculateProductBounds(
  components: ComponentNode[]
): ProductDimensions['bounds'] {
  const bounds = {
    min: [Infinity, Infinity, Infinity] as [number, number, number],
    max: [-Infinity, -Infinity, -Infinity] as [number, number, number],
  };

  function traverse(node: ComponentNode) {
    if (node.geometry) {
      const { position, dimensions } = node.geometry;
      
      if (dimensions) {
        const [w, h, d] = dimensions;
        const [x, y, z] = position;
        
        bounds.min[0] = Math.min(bounds.min[0], x - w / 2);
        bounds.min[1] = Math.min(bounds.min[1], y - h / 2);
        bounds.min[2] = Math.min(bounds.min[2], z - d / 2);
        
        bounds.max[0] = Math.max(bounds.max[0], x + w / 2);
        bounds.max[1] = Math.max(bounds.max[1], y + h / 2);
        bounds.max[2] = Math.max(bounds.max[2], z + d / 2);
      }
    }
    
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  components.forEach(traverse);
  return bounds;
}

/**
 * Create complete scene config with standard door
 */
export function createStandardDoorScene(
  width: number = 914,
  height: number = 2032,
  depth: number = 45
): SceneConfig {
  const components = createStandardDoorComponents(width, height, depth);
  const materials = createStandardMaterials();
  const bounds = calculateProductBounds(components);

  // Calculate lighting bounds
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
    components,
    materials,
    camera: {
      mode: 'Perspective',
      position: [0, 0, 3000], // 3m back from door
      rotation: [0, 0, 0],
      target: [0, 0, 0],
      zoom: 1,
      fov: 35,
    },
    visibility: components.reduce((acc, node) => {
      acc[node.id] = node.visible;
      if (node.children) {
        node.children.forEach((child) => {
          acc[child.id] = child.visible;
          if (child.children) {
            child.children.forEach((grandchild) => {
              acc[grandchild.id] = grandchild.visible;
            });
          }
        });
      }
      return acc;
    }, {} as Record<string, boolean>),
    lighting: {
      boundsX,
      boundsZ,
      intensity: 1.6,
      shadowCatcherDiameter,
      ambientIntensity: 0.45,
      castShadows: true,
    },
    ui: {
      guides: false,
      axis: false,
      componentList: true,
      dimensions: false,
    },
    metadata: {
      productName: 'Standard Timber Door',
    },
  };
}
