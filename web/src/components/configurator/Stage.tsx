/**
 * Stage - cyclorama backdrop + subtle floor plane
 * Uses existing createCycloramaBackdrop helper for infinite wall/floor curve
 */

'use client';

import * as THREE from 'three';
import { createCycloramaBackdrop } from '@/lib/scene/geometry';

interface StageProps {
  productWidth: number;
  productHeight: number;
  hideFloor?: boolean;
}

export function Stage({ productWidth, productHeight, hideFloor }: StageProps) {
  const width = Math.max(2000, productWidth * 4);
  const height = Math.max(2000, productHeight * 2.5);
  const curveRadius = Math.max(800, productHeight * 0.6);

  const backdropGeometry = createCycloramaBackdrop(width, height, curveRadius);

  return (
    <group>
      {/* Cyclorama backdrop */}
      <mesh
        geometry={backdropGeometry}
        position={[0, height / 2, -curveRadius]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#f5f5f5"
          roughness={0.95}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floor plane for subtle gradient and catch lighting - offset below to prevent z-fighting */}
      {!hideFloor && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.5, 0]}
          receiveShadow
        >
          <planeGeometry args={[width * 1.5, width * 1.5, 1, 1]} />
          <meshStandardMaterial
            color="#f4f4f4"
            roughness={0.92}
            metalness={0}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      )}
    </group>
  );
}
