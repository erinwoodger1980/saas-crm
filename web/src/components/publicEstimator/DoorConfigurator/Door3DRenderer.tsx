/**
 * Photorealistic 3D Door Renderer
 * React Three Fiber component for architectural-quality door visualization
 */

'use client';

import React, { useMemo, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { DoorConfiguration } from './types';
import { buildDoorModel } from './geometry3d-v2';
import {
  createWoodMaterial,
  createPaintedMaterial,
  createGlassMaterial,
  createBrassMaterial,
  getMaterialParamsFromColor,
} from './materials';

interface Door3DRendererProps {
  config: DoorConfiguration;
  width?: number;
  height?: number;
  enableOrbitControls?: boolean;
  showInContext?: boolean;
}

/**
 * Main Door 3D component - Component-based rendering
 */
function Door3D({ config }: { config: DoorConfiguration }) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Build door model from components
  const doorModel = useMemo(() => buildDoorModel(config), [config]);
  
  // Create materials based on configuration
  const woodMaterial = useMemo(() => {
    const params = getMaterialParamsFromColor(config.color);
    if (config.color.finish === 'natural' || config.color.finish === 'stained') {
      return createWoodMaterial(params as any);
    } else {
      return createPaintedMaterial(params as any);
    }
  }, [config.color]);
  
  const glassMaterial = useMemo(() => createGlassMaterial(0.3), []);
  
  // Scale factor: convert mm to Three.js units (1 unit = 100mm)
  const scale = 0.01;
  
  // Helper to get material for component
  const getMaterialForComponent = (comp: any) => {
    if (comp.material === 'glass') return glassMaterial;
    return woodMaterial;
  };
  
  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      {doorModel.components.map((component, i) => (
        <mesh
          key={`${component.name}-${i}`}
          geometry={component.geometry}
          material={getMaterialForComponent(component)}
          position={component.position}
          rotation={component.rotation}
          scale={component.scale}
          castShadow={component.castShadow}
          receiveShadow={component.receiveShadow}
        />
      ))}
    </group>
  );
}

/**
 * Lighting setup for architectural photography look
 */
function Lighting() {
  return (
    <>
      {/* Main key light - stronger directional light to show depth */}
      <directionalLight
        position={[5, 8, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.00005}
        shadow-radius={1.5}
        color="#fffcf0"
      />
      
      {/* Secondary light from left for better detail visibility */}
      <directionalLight
        position={[-6, 5, 5]}
        intensity={0.8}
        color="#fff8e8"
      />
      
      {/* Softer ambient light */}
      <ambientLight intensity={0.35} color="#faf7ec" />
      
      {/* Subtle rim light for edge definition */}
      <directionalLight
        position={[-2, 6, -8]}
        intensity={0.5}
        color="#fffef5"
      />
      
      {/* Environment map - warmer natural lighting */}
      <Environment preset="city" background={false} />
    </>
  );
}

/**
 * Optional context scene (wall background)
 */
function ContextScene({ showInContext }: { showInContext: boolean }) {
  if (!showInContext) return null;
  
  return (
    <group>
      {/* Brick wall */}
      <mesh position={[0, 0, -0.5]} receiveShadow>
        <planeGeometry args={[20, 15]} />
        <meshStandardMaterial
          color="#c9a98f"
          roughness={0.8}
          metalness={0.0}
        />
      </mesh>
      
      {/* Floor/ground plane */}
      <mesh position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#8b8b8b"
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>
    </group>
  );
}

/**
 * Main exported component
 */
export function Door3DRenderer({
  config,
  width = 600,
  height = 800,
  enableOrbitControls = true,
  showInContext = false,
}: Door3DRendererProps) {
  return (
    <div style={{ width, height, background: '#e6e6e6', borderRadius: '8px', overflow: 'hidden' }}>
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
        }}
      >
        {/* Camera */}
        <PerspectiveCamera
          makeDefault
          position={[0, 0, 15]}
          fov={35}
        />
        
        {/* Lighting */}
        <Lighting />
        
        {/* Door */}
        <Suspense fallback={null}>
          <Door3D config={config} />
        </Suspense>
        
        {/* Context scene */}
        <ContextScene showInContext={showInContext} />
        
        {/* Contact shadows on ground */}
        <ContactShadows
          position={[0, -5, 0]}
          opacity={0.4}
          scale={10}
          blur={2}
          far={4}
        />
        
        {/* Controls */}
        {enableOrbitControls && (
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={10}
            maxDistance={25}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.5}
          />
        )}
      </Canvas>
    </div>
  );
}

/**
 * Loading fallback component
 */
export function Door3DRendererFallback({ width = 600, height = 800 }: { width?: number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        background: '#f5f5f5',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
      }}
    >
      <div>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 12 12"
                to="360 12 12"
                dur="1s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        </div>
        <div>Loading 3D preview...</div>
      </div>
    </div>
  );
}
