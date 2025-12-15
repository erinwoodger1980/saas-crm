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
      {/* Main key light - professional studio setup */}
      <directionalLight
        position={[6, 10, 8]}
        intensity={2.4}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-15}
        shadow-bias={-0.00008}
        shadow-radius={2.0}
        color="#fffef5"
      />
      
      {/* Fill light from left - reduces harsh shadows */}
      <directionalLight
        position={[-8, 6, 4]}
        intensity={1.0}
        color="#fff8f0"
      />
      
      {/* Softer ambient light - overall illumination */}
      <ambientLight intensity={0.42} color="#faf8f3" />
      
      {/* Rim light - highlights edges and depth */}
      <directionalLight
        position={[-3, 7, -10]}
        intensity={0.7}
        color="#fffcf5"
      />
      
      {/* Soft back light - separates door from background */}
      <directionalLight
        position={[0, 4, -8]}
        intensity={0.35}
        color="#f5f0e8"
      />
      
      {/* Environment map - warm natural lighting */}
      <Environment preset="city" background={false} intensity={0.8} />
    </>
  );
}

/**
 * Optional context scene (wall background)
 */
function ContextScene({ showInContext }: { showInContext: boolean }) {
  return (
    <>
      {/* Ground plane for shadow catching */}
      <mesh position={[0, -8, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial
          color="#9d9d9d"
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
      
      {showInContext && (
        <>
          {/* Wall background */}
          <mesh position={[0, 0, -12]} receiveShadow>
            <planeGeometry args={[25, 20]} />
            <meshStandardMaterial
              color="#d4cac0"
              roughness={0.85}
              metalness={0.0}
            />
          </mesh>
        </>
      )}
      
      {/* Contact shadows for depth */}
      <ContactShadows
        position={[0, -7.9, 0]}
        opacity={0.35}
        scale={30}
        blur={2.5}
        far={20}
      />
    </>
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
    <div style={{ width, height, background: 'linear-gradient(135deg, #f0ede8 0%, #e8e3dd 100%)', borderRadius: '8px', overflow: 'hidden' }}>
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
