/**
 * Product Components Renderer
 * Generic renderer for all product types (doors, windows, etc.)
 * Handles raycasting for selection
 * Supports standard geometries plus curve-based (shapeExtrude, tube, lathe) and GLTF models
 * UPGRADED: Uses PBR materials and beveled geometry for professional rendering
 */

'use client';

import { forwardRef, useMemo, useRef, MutableRefObject } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ComponentNode, MaterialDefinition, ComponentVisibility } from '@/types/scene-config';
import { createPBRMaterial } from '@/lib/scene/materials';
import { createRoundedBox, createProfileExtrude } from '@/lib/scene/geometry';
import { TransformControls } from '@react-three/drei';
import { GltfModel } from './GltfModel';

interface ProductComponentsProps {
  components: ComponentNode[];
  materials: MaterialDefinition[];
  visibility: ComponentVisibility;
  onSelect?: (componentId: string | null) => void;
  selectedId?: string | null;
  orbitControlsRef?: MutableRefObject<any>;
  onTransformEnd?: (componentId: string, newY: number) => void;
  wireframe?: boolean;
}

/**
 * Convert material definition to Three.js material
 * UPGRADED: Uses new PBR material factory
 */
function createMaterial(def: MaterialDefinition, wireframe?: boolean): THREE.Material {
  const material = createPBRMaterial(def);
  if (wireframe) {
    material.wireframe = true;
    material.wireframeLinewidth = 2;
  }
  return material;
}

/**
 * Render a single component node
 * Supports: box, cylinder, extrude, shapeExtrude, tube, lathe
 */
const ComponentMesh = forwardRef<THREE.Mesh, {
  node: ComponentNode;
  material?: THREE.Material;
  isSelected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}>(function ComponentMesh({ node, material, isSelected, onClick }, ref) {
  const meshRef = useRef<THREE.Mesh>(null);
  const setRef = (value: THREE.Mesh | null) => {
    if (meshRef.current !== value) {
      Object.assign(meshRef, { current: value });
    }
    if (typeof ref === 'function') {
      ref(value);
    } else if (ref) {
      (ref as React.MutableRefObject<THREE.Mesh | null>).current = value;
    }
  };

  // Guard outside early returns to keep hook order stable even if geometry/visibility toggles
  const hasRenderableGeometry = !!node.geometry && node.visible;

  const geometry = useMemo(() => {
    if (!hasRenderableGeometry || !node.geometry) return null;

    const { type, dimensions, customData } = node.geometry;

    // GLTF models handled separately (not returned as geometry)
    if (type === 'gltf') return null;

    try {
      switch (type) {
        case 'box': {
          if (!dimensions) return null;
          // Use beveled box for crisp highlight-catching edges
          const edgeRadius = (customData as any)?.edgeRadius || 2; // Default 2mm bevel
          return createRoundedBox({
            width: dimensions[0],
            height: dimensions[1],
            depth: dimensions[2],
            radius: edgeRadius,
            smoothness: 6,
          });
        }
        
        case 'cylinder':
          if (!dimensions) return null;
          return new THREE.CylinderGeometry(
            dimensions[0],
            dimensions[0],
            dimensions[1],
            dimensions[2] || 32
          );
        
        case 'extrude': {
          if (!customData?.shape || !Array.isArray(customData.shape.points)) return null;
          const shape = new THREE.Shape();
          customData.shape.points.forEach((p: [number, number], i: number) => {
            if (i === 0) shape.moveTo(p[0], p[1]);
            else shape.lineTo(p[0], p[1]);
          });
          return new THREE.ExtrudeGeometry(shape, customData.extrudeSettings);
        }
        
        case 'shapeExtrude': {
          if (!customData?.shape || !Array.isArray(customData.shape.points)) return null;
          
          // Build outer shape
          const outerShape = new THREE.Shape();
          const outerPoints = customData.shape.points;
          if (!Array.isArray(outerPoints) || outerPoints.length === 0) return null;
          
          outerShape.moveTo(outerPoints[0][0], outerPoints[0][1]);
          for (let i = 1; i < outerPoints.length; i++) {
            outerShape.lineTo(outerPoints[i][0], outerPoints[i][1]);
          }
          
          // Add holes if present
          if (customData.holes && customData.holes.length > 0) {
            customData.holes.forEach((hole: any) => {
              if (!hole?.points || !Array.isArray(hole.points)) return;
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
              if (!pathData.p0 || !pathData.p1 || !pathData.p2 || !pathData.p3) return null;
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
              if (!Array.isArray(pathData.points)) return null;
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
          if (!customData?.profile || !Array.isArray(customData.profile.points)) return null;
          
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

        // @ts-ignore - profileExtrude not in base geometry types
        case 'profileExtrude': {
          if (!customData?.profile || !customData?.path) return null;
          return createProfileExtrude({
            profile: customData.profile as any,
            path: customData.path as any,
            closed: customData.closed ?? false,
            fallbackBox: customData.fallbackBox,
          });
        }
        
        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to create geometry for ${type}:`, error);
      return null;
    }
  }, [hasRenderableGeometry, node.geometry]);

  // Selection highlight material - must be called before any returns
  const highlightMaterial = useMemo(() => {
    if (!isSelected || !material) return material;
    return new THREE.MeshStandardMaterial({
      color: '#4a90e2',
      emissive: '#4a90e2',
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.5,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }, [isSelected, material]);

  // No render when geometry missing; hook order stays stable via guards above
  if (!hasRenderableGeometry) return null;

  // Handle GLTF models separately
  if (node.geometry?.type === 'gltf') {
    const assetId = node.geometry.customData?.assetId;
    if (!assetId) {
      console.warn('[ComponentMesh] GLTF node missing assetId:', node.id);
      return null;
    }

    return (
      <GltfModel
        assetId={assetId}
        position={node.geometry.position}
        rotation={node.geometry.rotation}
        transform={node.geometry.customData?.assetTransform}
        componentId={node.id}
        componentName={node.name}
        isSelected={isSelected}
        onClick={onClick}
      />
    );
  }

  // Standard geometry rendering
  if (!geometry || !node.geometry) return null;

  const position = new THREE.Vector3(...node.geometry.position);
  const rotation = node.geometry.rotation
    ? new THREE.Euler(...node.geometry.rotation)
    : undefined;

  return (
    <mesh
      ref={setRef}
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
});

function NodeRenderer({
  node,
  materials,
  visibility,
  materialMap,
  onSelect,
  selectedId,
  orbitControlsRef,
  onTransformEnd,
}: {
  node: ComponentNode;
  materials: MaterialDefinition[];
  visibility: ComponentVisibility;
  materialMap: Map<string, THREE.Material>;
  onSelect?: (componentId: string | null) => void;
  selectedId?: string | null;
  orbitControlsRef?: MutableRefObject<any>;
  onTransformEnd?: (componentId: string, newY: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const isVisible = visibility[node.id] ?? node.visible;
  if (!isVisible) return null;

  const material = node.materialId ? materialMap.get(node.materialId) : undefined;
  const isSelected = node.id === selectedId;
  const isRail = node.type === 'frame' && node.id.includes('Rail');
  const transformEnabled = isSelected && isRail;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(node.id);
    }
  };

  const mesh = node.geometry ? (
    <ComponentMesh
      ref={meshRef}
      node={node}
      material={material}
      isSelected={isSelected}
      onClick={handleClick}
    />
  ) : null;

  const wrappedMesh = transformEnabled ? (
    <TransformControls
      mode="translate"
      showX={false}
      showZ={false}
      onMouseDown={() => {
        if (orbitControlsRef?.current) orbitControlsRef.current.enabled = false;
      }}
      onMouseUp={() => {
        if (orbitControlsRef?.current) orbitControlsRef.current.enabled = true;
        if (meshRef.current && onTransformEnd) {
          onTransformEnd(node.id, meshRef.current.position.y);
        }
      }}
    >
      {mesh ? mesh : <mesh />}
    </TransformControls>
  ) : (
    mesh || <></>
  );

  return (
    <group>
      {wrappedMesh}
      {Array.isArray(node.children) &&
        node.children.map((child) => (
          <NodeRenderer
            key={child.id}
            node={child}
            materials={materials}
            visibility={visibility}
            materialMap={materialMap}
            onSelect={onSelect}
            selectedId={selectedId}
            orbitControlsRef={orbitControlsRef}
            onTransformEnd={onTransformEnd}
          />
        ))}
    </group>
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
  orbitControlsRef,
  onTransformEnd,
  wireframe,
}: ProductComponentsProps) {
  // Create material map with array guard
  const materialMap = useMemo(() => {
    const map = new Map<string, THREE.Material>();
    const safeMaterials = Array.isArray(materials) ? materials : [];
    safeMaterials.forEach((def) => {
      map.set(def.id, createMaterial(def, wireframe));
    });
    return map;
  }, [materials, wireframe]);

  // Handle background click to deselect
  const handleBackgroundClick = () => {
    if (onSelect) {
      onSelect(null);
    }
  };

  // Guard against non-array props
  const safeComponents = Array.isArray(components) ? components : [];
  const safeVisibility = visibility || {};
  
  return (
    <group onClick={handleBackgroundClick}>
      {safeComponents.map((node) => (
        <NodeRenderer
          key={node.id}
          node={node}
          materials={materials}
          visibility={safeVisibility}
          materialMap={materialMap}
          onSelect={onSelect}
          selectedId={selectedId}
          orbitControlsRef={orbitControlsRef}
          onTransformEnd={onTransformEnd}
        />
      ))}
    </group>
  );
}
