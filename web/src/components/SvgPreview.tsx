/**
 * SVG Preview Component
 * Renders a 3D extruded preview of pasted SVG using Three.js
 * Integrates with existing SVG profile extrusion pipeline
 */

'use client';

import { useMemo, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { AlertCircle, Loader2 } from 'lucide-react';

interface SvgPreviewProps {
  svgText: string;
  extrudeDepth?: number; // mm, default 45
  width?: string | number;
  height?: string | number;
  isLoading?: boolean;
}

/**
 * Extruded mesh from SVG
 * Mirrors createExtrudedProfileMesh from svg-profile.ts
 */
function SvgPreviewMesh({ svgText, extrudeDepth }: { svgText: string; extrudeDepth: number }) {
  const meshRef = useRef<THREE.Group>(null);
  const error = useRef<string | null>(null);

  // Parse SVG and create mesh
  useEffect(() => {
    if (!meshRef.current) return;

    try {
      // Clear previous mesh
      while (meshRef.current.children.length > 0) {
        meshRef.current.remove(meshRef.current.children[0]);
      }

      // Try to parse SVG using SVGLoader
      const { SVGLoader } = require('three/examples/jsm/loaders/SVGLoader.js');
      const loader = new SVGLoader();

      // Parse SVG string
      const data = loader.parse(svgText);

      // Create shapes from paths
      const shapes: THREE.Shape[] = [];

      data.paths.forEach((path: any) => {
        const fillColor = path.userData.style.fill;
        if (fillColor !== 'none') {
          const shape = SVGLoader.pointsToShape(path.points);
          if (shape) {
            shapes.push(shape);
          }
        }
      });

      if (shapes.length === 0) {
        error.current = 'No valid shapes found in SVG';
        return;
      }

      // Extrude shapes
      const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: extrudeDepth / 1000, // Convert mm to scene units
        bevelEnabled: false,
        steps: 1,
      });

      // Material
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xC19A6B,
        metalness: 0,
        roughness: 0.75,
        envMapIntensity: 0.4,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Rotate to 3D plane (SVG XY → 3D XZ)
      mesh.rotation.x = -Math.PI / 2;

      // Center geometry
      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox;
      if (bbox) {
        const offsetX = -(bbox.max.x + bbox.min.x) / 2;
        const offsetY = -(bbox.max.y + bbox.min.y) / 2;
        geometry.translate(offsetX, offsetY, 0);
      }

      meshRef.current.add(mesh);
      error.current = null;
    } catch (err: any) {
      error.current = err.message || 'Failed to parse SVG';
      console.error('[SvgPreviewMesh]', error.current);
    }
  }, [svgText, extrudeDepth]);

  if (error.current) {
    return (
      <group ref={meshRef}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={0xcccccc} />
        </mesh>
      </group>
    );
  }

  return <group ref={meshRef} />;
}

/**
 * Preview Scene
 */
function PreviewScene({ svgText, extrudeDepth }: { svgText: string; extrudeDepth: number }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
      <SvgPreviewMesh svgText={svgText} extrudeDepth={extrudeDepth} />

      {/* Simple orbit controls using mouse */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

/**
 * Main Preview Component
 */
export function SvgPreview({
  svgText,
  extrudeDepth = 45,
  width = '100%',
  height = '300px',
  isLoading = false,
}: SvgPreviewProps) {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 rounded-lg border border-slate-200"
        style={{ width, height }}
      >
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-600">Generating preview...</p>
        </div>
      </div>
    );
  }

  if (!svgText.trim()) {
    return (
      <div
        className="flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 rounded-lg border border-slate-200"
        style={{ width, height }}
      >
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <AlertCircle className="h-6 w-6" />
          <p className="text-sm">No SVG to preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-slate-200 overflow-hidden" style={{ width, height }}>
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        camera={{
          position: [2, 2, 2],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <PreviewScene svgText={svgText} extrudeDepth={extrudeDepth} />
      </Canvas>
    </div>
  );
}
