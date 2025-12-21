/**
 * Door Components Renderer
 * Renders hierarchical component tree with visibility control
 * Maps 1:1 with geometry nodes for precise control
 * Applies render hints to prevent z-fighting and improve transparency sorting
 */

'use client';

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { ComponentNode, MaterialDefinition, ComponentVisibility } from '@/types/scene-config';
import {
  applyRenderHints,
  applyGlassHints,
  applyDecalHints,
  applyStainedGlassHints,
  applyPanelFaceHints,
} from '@/lib/render/renderHints';

interface DoorComponentsProps {
  components: ComponentNode[];
  materials: MaterialDefinition[];
  visibility: ComponentVisibility;
}

/**
 * Render a single component node
 */
function ComponentMesh({ node, material }: { node: ComponentNode; material?: THREE.Material }) {
  if (!node.geometry || !node.visible) return null;

  const geometry = useMemo(() => {
    const { type, dimensions, customData } = node.geometry!;

    switch (type) {
      case 'box':
        if (!dimensions) return null;
        return new THREE.BoxGeometry(...dimensions);
      
      case 'cylinder':
        if (!dimensions) return null;
        // dimensions: [radius, height, radialSegments]
        return new THREE.CylinderGeometry(
          dimensions[0],
          dimensions[0],
          dimensions[1],
          dimensions[2] || 32
        );
      
      case 'extrude':
        if (!customData?.shape || !Array.isArray(customData.shape.points)) return null;
        // Custom extrude geometry from shape data
        const shape = new THREE.Shape();
        customData.shape.points.forEach((p: [number, number], i: number) => {
          if (i === 0) shape.moveTo(p[0], p[1]);
          else shape.lineTo(p[0], p[1]);
        });
        return new THREE.ExtrudeGeometry(shape, customData.extrudeSettings);
      
      case 'custom':
        // Handle custom geometry data
        return null;
      
      default:
        return null;
    }
  }, [node.geometry]);

  if (!geometry) return null;

  const position = new THREE.Vector3(...node.geometry.position);
  const rotation = node.geometry.rotation
    ? new THREE.Euler(...node.geometry.rotation)
    : undefined;

  return (
    <mesh
      ref={(mesh) => {
        if (!mesh) return;

        // Apply render hints based on component type/tags
        const tags = node.tags || [];
        if (tags.includes('glass')) {
          applyGlassHints(mesh);
        } else if (tags.includes('stainedGlassImagePlane')) {
          applyStainedGlassHints(mesh);
        } else if (tags.includes('decal') || tags.includes('overlay')) {
          applyDecalHints(mesh);
        } else if (tags.includes('panelFace') || tags.includes('profileOverlay')) {
          applyPanelFaceHints(mesh);
        }
      }}
      position={position}
      rotation={rotation}
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      userData={{ componentId: node.id, componentName: node.name }}
    />
  );
}

/**
 * Recursively render component tree
 */
function ComponentTree({
  nodes,
  materials,
  visibility,
  materialMap,
}: {
  nodes: ComponentNode[];
  materials: MaterialDefinition[];
  visibility: ComponentVisibility;
  materialMap: Map<string, THREE.Material>;
}) {
  // Guard against non-array nodes
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  
  return (
    <>
      {safeNodes.map((node) => {
        // Check visibility from flat map
        const isVisible = visibility[node.id] ?? node.visible;
        if (!isVisible) return null;

        const material = node.materialId ? materialMap.get(node.materialId) : undefined;

        return (
          <group key={node.id} userData={{ componentId: node.id }}>
            {/* Render this node's geometry */}
            <ComponentMesh node={node} material={material} />

            {/* Recursively render children */}
            {Array.isArray(node.children) && node.children.length > 0 && (
              <ComponentTree
                nodes={node.children}
                materials={materials}
                visibility={visibility}
                materialMap={materialMap}
              />
            )}
          </group>
        );
      })}
    </>
  );
}

/**
 * Create Three.js materials from material definitions
 * Glass materials use MeshPhysicalMaterial with depthWrite=false for proper transparency
 */
function createMaterials(definitions: MaterialDefinition[]): Map<string, THREE.Material> {
  const map = new Map<string, THREE.Material>();

  // Guard against non-array definitions
  const safeDefinitions = Array.isArray(definitions) ? definitions : [];
  
  safeDefinitions.forEach((def) => {
    let material: THREE.Material;

    switch (def.type) {
      case 'wood':
      case 'painted':
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(def.baseColor),
          roughness: def.roughness ?? 0.7,
          metalness: def.metalness ?? 0,
        });
        break;

      case 'glass':
        material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(def.baseColor),
          roughness: def.roughness ?? 0.2,
          metalness: 0,
          transmission: 0.95,
          thickness: 4,
          ior: 1.5,
          transparent: true,
          opacity: 0.85,
          depthWrite: false, // Prevent z-fighting with underlying geometry
          side: THREE.DoubleSide,
        });
        // Apply renderOrder to ensure glass renders after opaque objects
        (material as any).renderOrder = 10;
        break;

      case 'metal':
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(def.baseColor),
          roughness: def.roughness ?? 0.3,
          metalness: def.metalness ?? 0.8,
        });
        break;

      default:
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(def.baseColor),
          roughness: 0.7,
          metalness: 0,
        });
    }

    map.set(def.id, material);
  });

  return map;
}

export function DoorComponents({ components, materials, visibility }: DoorComponentsProps) {
  // Guard against non-array props
  const safeComponents = Array.isArray(components) ? components : [];
  const safeMaterials = Array.isArray(materials) ? materials : [];
  const safeVisibility = visibility || {};
  
  const materialMap = useMemo(() => createMaterials(safeMaterials), [safeMaterials]);

  return (
    <group>
      <ComponentTree
        nodes={safeComponents}
        materials={safeMaterials}
        visibility={safeVisibility}
        materialMap={materialMap}
      />
    </group>
  );
}
