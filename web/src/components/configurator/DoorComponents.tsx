/**
 * Door Components Renderer
 * Renders hierarchical component tree with visibility control
 * Maps 1:1 with geometry nodes for precise control
 */

'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { ComponentNode, MaterialDefinition, ComponentVisibility } from '@/types/scene-config';

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
        if (!customData?.shape) return null;
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
  return (
    <>
      {nodes.map((node) => {
        // Check visibility from flat map
        const isVisible = visibility[node.id] ?? node.visible;
        if (!isVisible) return null;

        const material = node.materialId ? materialMap.get(node.materialId) : undefined;

        return (
          <group key={node.id} userData={{ componentId: node.id }}>
            {/* Render this node's geometry */}
            <ComponentMesh node={node} material={material} />

            {/* Recursively render children */}
            {node.children && node.children.length > 0 && (
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
 */
function createMaterials(definitions: MaterialDefinition[]): Map<string, THREE.Material> {
  const map = new Map<string, THREE.Material>();

  definitions.forEach((def) => {
    let material: THREE.Material;

    switch (def.type) {
      case 'wood':
      case 'painted':
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(def.baseColor),
          roughness: def.roughness,
          metalness: def.metalness,
        });
        break;

      case 'glass':
        material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(def.baseColor),
          roughness: def.roughness,
          metalness: def.metalness,
          transmission: 0.9,
          thickness: 4,
          ior: 1.5,
          transparent: true,
          opacity: 0.7,
        });
        break;

      case 'metal':
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(def.baseColor),
          roughness: def.roughness,
          metalness: def.metalness,
        });
        break;

      default:
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(def.baseColor),
        });
    }

    map.set(def.id, material);
  });

  return map;
}

export function DoorComponents({ components, materials, visibility }: DoorComponentsProps) {
  const materialMap = useMemo(() => createMaterials(materials), [materials]);

  return (
    <group>
      <ComponentTree
        nodes={components}
        materials={materials}
        visibility={visibility}
        materialMap={materialMap}
      />
    </group>
  );
}
