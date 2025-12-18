/**
 * Product Components Renderer
 * Generic renderer for all product types (doors, windows, etc.)
 * Handles raycasting for selection
 * Supports standard geometries plus curve-based (shapeExtrude, tube, lathe)
 */

'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ComponentNode, MaterialDefinition, ComponentVisibility } from '@/types/scene-config';
import { convertCurveToShape, convertCurveTo3DPath } from '@/lib/scene/curve-utils';

interface ProductComponentsProps {
  components: ComponentNode[];
  materials: MaterialDefinition[];
  visibility: ComponentVisibility;
  onSelect?: (componentId: string | null) => void;
  selectedId?: string | null;
}

/**
 * Convert material definition to Three.js material
 */
function createMaterial(def: MaterialDefinition): THREE.Material {
  const color = new THREE.Color(def.baseColor);
  
  switch (def.type) {
    case 'glass':
      return new THREE.MeshPhysicalMaterial({
        color,
        metalness: def.metalness,
        roughness: def.roughness,
        transmission: 0.9,
        transparent: true,
        opacity: 0.3,
        ior: 1.5,
        thickness: 0.5,
        envMapIntensity: 1.5,
      });
      
    case 'metal':
      return new THREE.MeshStandardMaterial({
        color,
        metalness: def.metalness,
        roughness: def.roughness,
        envMapIntensity: 1.0,
      });
      
    case 'wood':
      return new THREE.MeshStandardMaterial({
        color,
        metalness: def.metalness,
        roughness: def.roughness,
        envMapIntensity: 0.8,
      });
      
    case 'painted':
      return new THREE.MeshStandardMaterial({
        color,
        metalness: def.metalness,
        roughness: def.roughness,
        envMapIntensity: 0.6,
      });
      
    default:
      return new THREE.MeshStandardMaterial({
        color,
        metalness: def.metalness,
        roughness: def.roughness,
      });
  }
}

/**
 * Render a single component node
 * Supports: box, cylinder, extrude, shapeExtrude, tube, lathe
 */
function ComponentMesh({
  node,
  material,
  isSelected,
  onClick,
}: {
  node: ComponentNode;
  material?: THREE.Material;
  isSelected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  if (!node.geometry || !node.visible) return null;

  const geometry = useMemo(() => {
    const { type, dimensions, customData } = node.geometry!;

    try {
      switch (type) {
        case 'box':
          if (!dimensions) return null;
          return new THREE.BoxGeometry(...dimensions);
        
        case 'cylinder':
          if (!dimensions) return null;
          return new THREE.CylinderGeometry(
            dimensions[0],
            dimensions[0],
            dimensions[1],
            dimensions[2] || 32
          );
        
        case 'extrude':
          if (!customData?.shape) return null;
          const shape = new THREE.Shape();
          customData.shape.points.forEach((p: [number, number], i: number) => {
            if (i === 0) shape.moveTo(p[0], p[1]);
            else shape.lineTo(p[0], p[1]);
          });
          return new THREE.ExtrudeGeometry(shape, customData.extrudeSettings);
        
        case 'shapeExtrude': {
          if (!customData?.shape) return null;
          
          // Build outer shape
          const outerShape = new THREE.Shape();
          const outerPoints = customData.shape.points;
          if (outerPoints.length === 0) return null;
          
          outerShape.moveTo(outerPoints[0][0], outerPoints[0][1]);
          for (let i = 1; i < outerPoints.length; i++) {
            outerShape.lineTo(outerPoints[i][0], outerPoints[i][1]);
          }
          
          // Add holes if present
          if (customData.holes && customData.holes.length > 0) {
            customData.holes.forEach((hole: any) => {
              const holePath = new THREE.Path();
              hole.points.forEach((p: [number, number], i: number) => {
                if (i === 0) holePath.moveTo(p[0], p[1]);
                else holePath.lineTo(p[0], p[1]);
              });
              outerShape.holes.push(holePath);
            });
          }
          
          const extrSettings = customData.extrudeSettings || { depth: 10 };
          return new THREE.ExtrudeGeometry(outerShape, extrSettings);
        }
        
        case 'tube': {
          if (!customData?.path) return null;
          
          // Convert curve definition to 3D path
          const pathData = customData.path;
          let curve: THREE.Curve<THREE.Vector3>;
          
          switch (pathData.type) {
            case 'arc': {
              const arcCurve = new THREE.ArcCurve(
                pathData.cx || 0,
                pathData.cy || 0,
                pathData.r || 10,
                pathData.startAngle || 0,
                pathData.endAngle || Math.PI,
                pathData.clockwise ?? false
              );
              // Convert 2D ArcCurve to 3D by wrapping
              curve = new THREE.CatmullRomCurve3(
                arcCurve.getPoints(customData.tubularSegments || 20).map(p =>
                  new THREE.Vector3(p.x, p.y, 0)
                )
              );
              break;
            }
            
            case 'ellipse': {
              const ellipseCurve = new THREE.EllipseCurve(
                pathData.cx || 0,
                pathData.cy || 0,
                pathData.rx || 10,
                pathData.ry || 5,
                pathData.startAngle || 0,
                pathData.endAngle || Math.PI * 2,
                pathData.clockwise ?? false,
                pathData.rotation || 0
              );
              curve = new THREE.CatmullRomCurve3(
                ellipseCurve.getPoints(customData.tubularSegments || 20).map(p =>
                  new THREE.Vector3(p.x, p.y, 0)
                )
              );
              break;
            }
            
            case 'bezier': {
              curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3(pathData.p0[0], pathData.p0[1], 0),
                new THREE.Vector3(pathData.p1[0], pathData.p1[1], 0),
                new THREE.Vector3(pathData.p2[0], pathData.p2[1], 0),
                new THREE.Vector3(pathData.p3[0], pathData.p3[1], 0)
              );
              break;
            }
            
            case 'polyline':
            case 'spline': {
              const points = pathData.points.map((p: [number, number]) =>
                new THREE.Vector3(p[0], p[1], 0)
              );
              curve = new THREE.CatmullRomCurve3(
                points,
                pathData.closed ?? false,
                'centripetal',
                pathData.tension ?? 0.5
              );
              break;
            }
            
            default:
              return null;
          }
          
          return new THREE.TubeGeometry(
            curve,
            customData.tubularSegments || 20,
            customData.radius || 2,
            customData.radialSegments || 8,
            customData.closed ?? false
          );
        }
        
        case 'lathe': {
          if (!customData?.profile) return null;
          
          const points = customData.profile.points.map((p: [number, number]) =>
            new THREE.Vector2(p[0], p[1])
          );
          
          return new THREE.LatheGeometry(
            points,
            customData.latheSegments || 32,
            0,
            Math.PI * 2
          );
        }
        
        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to create geometry for ${type}:`, error);
      return null;
    }
  }, [node.geometry]);

  if (!geometry) return null;

  const position = new THREE.Vector3(...node.geometry.position);
  const rotation = node.geometry.rotation
    ? new THREE.Euler(...node.geometry.rotation)
    : undefined;

  // Selection highlight material
  const highlightMaterial = useMemo(() => {
    if (!isSelected) return material;
    return new THREE.MeshStandardMaterial({
      color: '#4a90e2',
      emissive: '#4a90e2',
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.5,
    });
  }, [isSelected, material]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      geometry={geometry}
      material={highlightMaterial || material}
      castShadow
      receiveShadow
      onClick={onClick}
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
  onSelect,
  selectedId,
}: {
  nodes: ComponentNode[];
  materials: MaterialDefinition[];
  visibility: ComponentVisibility;
  materialMap: Map<string, THREE.Material>;
  onSelect?: (componentId: string | null) => void;
  selectedId?: string | null;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isVisible = visibility[node.id] ?? node.visible;
        if (!isVisible) return null;

        const material = node.materialId ? materialMap.get(node.materialId) : undefined;
        const isSelected = node.id === selectedId;

        return (
          <group key={node.id}>
            {/* Render this node's mesh if it has geometry */}
            {node.geometry && (
              <ComponentMesh
                node={node}
                material={material}
                isSelected={isSelected}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelect) {
                    onSelect(node.id);
                  }
                }}
              />
            )}
            
            {/* Render children */}
            {node.children && node.children.length > 0 && (
              <ComponentTree
                nodes={node.children}
                materials={materials}
                visibility={visibility}
                materialMap={materialMap}
                onSelect={onSelect}
                selectedId={selectedId}
              />
            )}
          </group>
        );
      })}
    </>
  );
}

/**
 * Main ProductComponents renderer
 */
export function ProductComponents({
  components,
  materials,
  visibility,
  onSelect,
  selectedId,
}: ProductComponentsProps) {
  // Create material map
  const materialMap = useMemo(() => {
    const map = new Map<string, THREE.Material>();
    materials.forEach((def) => {
      map.set(def.id, createMaterial(def));
    });
    return map;
  }, [materials]);

  // Handle background click to deselect
  const handleBackgroundClick = () => {
    if (onSelect) {
      onSelect(null);
    }
  };

  return (
    <group onClick={handleBackgroundClick}>
      <ComponentTree
        nodes={components}
        materials={materials}
        visibility={visibility}
        materialMap={materialMap}
        onSelect={onSelect}
        selectedId={selectedId}
      />
    </group>
  );
}
