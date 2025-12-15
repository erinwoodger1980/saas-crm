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
import { generateDoorGeometry, createHardwareGeometry } from './geometry3d';
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
 * Main Door 3D component
 */
function Door3D({ config }: { config: DoorConfiguration }) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Generate geometry based on configuration
  const geometry = useMemo(() => generateDoorGeometry(config), [config]);
  
  // Create materials
  const material = useMemo(() => {
    const params = getMaterialParamsFromColor(config.color);
    
    if (config.color.finish === 'natural' || config.color.finish === 'stained') {
      return createWoodMaterial(params as any);
    } else {
      return createPaintedMaterial(params as any);
    }
  }, [config.color]);
  
  const glassMaterial = useMemo(() => createGlassMaterial(0.3), []);
  const brassMaterial = useMemo(() => createBrassMaterial(), []);
  
  // Scale factor: convert mm to Three.js units (1 unit = 100mm for better visibility)
  const scale = 0.01;
  
  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      {/* Stiles */}
      {geometry.stiles.map((geo, i) => (
        <mesh
          key={`stile-${i}`}
          geometry={geo}
          material={material}
          position={geometry.positions.stiles[i]}
          castShadow
          receiveShadow
        />
      ))}
      
      {/* Rails */}
      {geometry.rails.map((geo, i) => (
        <mesh
          key={`rail-${i}`}
          geometry={geo}
          material={material}
          position={geometry.positions.rails[i]}
          castShadow
          receiveShadow
        />
      ))}
      
      {/* Panels */}
      {geometry.panels.map((geo, i) => (
        <mesh
          key={`panel-${i}`}
          geometry={geo}
          material={material}
          position={geometry.positions.panels[i]}
          castShadow
          receiveShadow
        />
      ))}
      
      {/* Glass */}
      {geometry.glass.map((geo, i) => (
        <mesh
          key={`glass-${i}`}
          geometry={geo}
          material={glassMaterial}
          position={geometry.positions.glass[i]}
        />
      ))}
      
      {/* Glazing Beads */}
      {geometry.glazingBeads.map((geo, i) => (
        <mesh
          key={`bead-${i}`}
          geometry={geo}
          material={material}
          position={geometry.positions.glazingBeads[i]}
          castShadow
        />
      ))}
      
      {/* Hardware */}
      {config.hardware && (
        <DoorHardware
          config={config}
          material={brassMaterial}
          doorWidth={config.dimensions.width * scale}
          doorHeight={config.dimensions.height * scale}
        />
      )}
    </group>
  );
}

/**
 * Door hardware component (handle, knocker, letterplate)
 */
function DoorHardware({
  config,
  material,
  doorWidth,
  doorHeight,
}: {
  config: DoorConfiguration;
  material: THREE.Material;
  doorWidth: number;
  doorHeight: number;
}) {
  const hardware = useMemo(() => createHardwareGeometry(), []);
  
  return (
    <group>
      {/* Handle */}
      <group position={[doorWidth / 2 - 0.8, 0, 0.3]}>
        <mesh geometry={hardware.handle.backplate} material={material} castShadow />
        <mesh
          geometry={hardware.handle.lever}
          material={material}
          position={[0.25, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        />
      </group>
      
      {/* Letter Plate */}
      {config.hardware.letterPlate && (
        <mesh
          geometry={hardware.letterPlate}
          material={material}
          position={[0, -doorHeight * 0.1, 0.25]}
          castShadow
        />
      )}
      
      {/* Knocker */}
      {config.hardware.knocker && (
        <group position={[0, doorHeight * 0.15, 0.3]}>
          <mesh geometry={hardware.knocker.backplate} material={material} castShadow />
          <mesh
            geometry={hardware.knocker.ring}
            material={material}
            position={[0, -0.15, 0.05]}
            castShadow
          />
        </group>
      )}
    </group>
  );
}

/**
 * Lighting setup for architectural photography look
 */
function Lighting() {
  return (
    <>
      {/* Main directional light (soft daylight from window) */}
      <directionalLight
        position={[8, 10, 6]}
        intensity={2.5}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.00001}
      />
      
      {/* Fill light (soft ambient) */}
      <ambientLight intensity={0.6} />
      
      {/* Subtle rim light from behind */}
      <directionalLight
        position={[-5, 5, -8]}
        intensity={0.8}
        color="#fffef0"
      />
      
      {/* Environment map for realistic reflections */}
      <Environment preset="studio" />
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
    <div style={{ width, height, background: '#f5f5f5', borderRadius: '8px', overflow: 'hidden' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
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
