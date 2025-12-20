/**
 * Example: FileMaker SVG Renderer Integration
 * Complete working example showing:
 * - AI component generation
 * - Estimated profile creation
 * - Profile rendering
 * - Interactive rail movement
 * - Profile swapping
 */

'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  enhanceComponentListWithProfiles,
  ComponentProfile,
} from '@/lib/scene/ai-profile-estimation';
import {
  createExtrudedProfileMesh,
  SVGProfileDefinition,
  loadProfileDefinition,
  swapProfileDefinition,
} from '@/lib/scene/svg-profile';
import {
  createProfiledComponentMesh,
  findComponentInAssembly,
  getAssemblyBoundingBox,
  raycastAssembly,
} from '@/lib/scene/profiled-component';
import {
  fitCameraToObject,
  captureCameraState,
  restoreCameraState,
} from '@/lib/scene/filemaker-camera';
import {
  createFileMakerLighting,
  createShadowCatcherFloor,
} from '@/lib/scene/filemaker-lighting';
import { createPBRMaterial } from '@/lib/scene/materials';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface ExampleConfig {
  productWidth: number;
  productHeight: number;
  productDepth: number;
}

/**
 * Example component list from AI
 * Simulates OpenAI response
 */
function generateExampleComponents(config: ExampleConfig) {
  const railHeight = Math.max(50, config.productHeight * 0.15);
  const stileWidth = Math.max(40, config.productWidth * 0.08);

  return [
    // Left stile
    {
      id: 'stile-left',
      type: 'stile',
      widthMm: stileWidth,
      depthMm: config.productDepth,
      lengthMm: config.productHeight,
    },
    // Right stile
    {
      id: 'stile-right',
      type: 'stile',
      widthMm: stileWidth,
      depthMm: config.productDepth,
      lengthMm: config.productHeight,
    },
    // Top rail
    {
      id: 'rail-top',
      type: 'rail',
      widthMm: config.productWidth - stileWidth * 2,
      depthMm: config.productDepth,
      lengthMm: railHeight,
    },
    // Mid rail
    {
      id: 'rail-mid',
      type: 'rail',
      widthMm: config.productWidth - stileWidth * 2,
      depthMm: config.productDepth,
      lengthMm: railHeight,
    },
    // Bottom rail
    {
      id: 'rail-bottom',
      type: 'rail',
      widthMm: config.productWidth - stileWidth * 2,
      depthMm: config.productDepth,
      lengthMm: railHeight,
    },
    // Center mullion
    {
      id: 'mullion-center',
      type: 'mullion',
      widthMm: Math.max(20, stileWidth * 0.5),
      depthMm: config.productDepth,
      lengthMm: config.productHeight - railHeight * 3,
    },
  ];
}

/**
 * Main example component
 */
export function FileMakerSVGRendererExample() {
  const [config] = useState<ExampleConfig>({
    productWidth: 914,
    productHeight: 2032,
    productDepth: 45,
  });

  const [components, setComponents] = useState<ComponentProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highQuality, setHighQuality] = useState(true);
  const [profileMap, setProfileMap] = useState<Map<string, SVGProfileDefinition>>(new Map());

  const assemblyRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());

  // Initialize components on mount
  useEffect(() => {
    const aiComponents = generateExampleComponents(config);
    const enhanced = enhanceComponentListWithProfiles(aiComponents);
    setComponents(enhanced);

    // Build profile map
    const profileMap = new Map<string, SVGProfileDefinition>();
    enhanced.forEach((comp) => {
      profileMap.set(comp.componentId, comp.profileDefinition);
    });
    setProfileMap(profileMap);
  }, [config]);

  // Create assembly in 3D scene
  useEffect(() => {
    if (!sceneRef.current || components.length === 0) return;

    // Clean up old assembly
    if (assemblyRef.current) {
      sceneRef.current.remove(assemblyRef.current);
    }

    // Create material
    const material = createPBRMaterial({
      timber: 'oak',
      finish: 'satin',
      envMapIntensity: 0.8,
    });

    // Create assembly
    const assembly = new THREE.Group();

    components.forEach((comp) => {
      const profile = comp.profileDefinition;
      const mesh = createExtrudedProfileMesh(
        profile.svgText,
        profile.extrudeDepthMm,
        profile.scale,
        material
      );

      if (!mesh) return;

      // Position based on component type
      let position: [number, number, number] = [0, 0, 0];

      switch (comp.componentType) {
        case 'stile':
          if (comp.componentId === 'stile-left') {
            position = [-config.productWidth / 2, config.productHeight / 2, 0];
          } else {
            position = [config.productWidth / 2, config.productHeight / 2, 0];
          }
          break;

        case 'rail':
          const railSpacing = config.productHeight / 4;
          if (comp.componentId === 'rail-top') {
            position = [0, config.productHeight - railSpacing / 2, 0];
          } else if (comp.componentId === 'rail-mid') {
            position = [0, config.productHeight / 2, 0];
          } else {
            position = [0, railSpacing / 2, 0];
          }
          break;

        case 'mullion':
          position = [0, config.productHeight / 2, 0];
          break;
      }

      const group = new THREE.Group();
      group.userData.componentId = comp.componentId;
      group.userData.componentType = comp.componentType;
      group.userData.profile = profile;
      group.position.set(...position);

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      assembly.add(group);
    });

    sceneRef.current.add(assembly);
    assemblyRef.current = assembly;

    // Auto-fit camera
    if (controlsRef.current && cameraRef.current) {
      const box = getAssemblyBoundingBox(assembly);
      fitCameraToObject(box, cameraRef.current, controlsRef.current, {
        perspective: '3/4',
        padding: 1.1,
      });
    }
  }, [components, config]);

  // Handle raycasting
  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (!cameraRef.current || !assemblyRef.current) return;

      const canvas = event.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();

      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(
        pointerRef.current,
        cameraRef.current
      );

      const result = raycastAssembly(
        assemblyRef.current,
        raycasterRef.current,
        cameraRef.current
      );

      if (result) {
        setSelectedId(result.component.userData.componentId);
      } else {
        setSelectedId(null);
      }
    },
    []
  );

  // Swap profile (example: convert estimated to verified)
  const handleSwapProfile = useCallback(
    async (componentId: string) => {
      if (!profileMap.has(componentId) || !assemblyRef.current) return;

      const oldProfile = profileMap.get(componentId)!;

      // Simulate loading verified profile from database
      // In real app: await loadProfileDefinition(tenantId, 'verified_oak_stile');
      const newProfile = swapProfileDefinition(oldProfile, oldProfile.svgText, {
        source: 'verified',
        confidence: 1.0,
        notes: 'Verified profile from database',
      });

      // Update profile map
      const newMap = new Map(profileMap);
      newMap.set(componentId, newProfile);
      setProfileMap(newMap);

      // Update component in assembly
      const component = findComponentInAssembly(assemblyRef.current, componentId);
      if (component) {
        const material = createPBRMaterial({
          timber: 'oak',
          finish: 'satin',
        });

        // Remove old mesh
        while (component.children.length > 0) {
          component.remove(component.children[0]);
        }

        // Create new mesh with updated profile
        const newMesh = createExtrudedProfileMesh(
          newProfile.svgText,
          newProfile.extrudeDepthMm,
          newProfile.scale,
          material
        );

        if (newMesh) {
          newMesh.castShadow = true;
          newMesh.receiveShadow = true;
          component.add(newMesh);
        }
      }
    },
    [profileMap]
  );

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <Canvas
          shadows="soft"
          dpr={[1, 2]}
          onCreated={({ scene, camera, gl }) => {
            sceneRef.current = scene;
            cameraRef.current = camera as THREE.PerspectiveCamera;

            // Setup lighting
            const lights = createFileMakerLighting({
              keyLightIntensity: 1.2,
              fillLightIntensity: 0.6,
              rimLightIntensity: 0.5,
              ambientIntensity: 0.3,
            });

            scene.add(lights.keyLight);
            scene.add(lights.keyLight.target);
            scene.add(lights.fillLight);
            scene.add(lights.fillLight.target);
            scene.add(lights.rimLight);
            scene.add(lights.rimLight.target);
            scene.add(lights.ambientLight);

            // Add shadow catcher
            const floor = createShadowCatcherFloor(
              config.productWidth,
              config.productDepth
            );
            scene.add(floor);

            // Setup WebGL
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
            gl.setClearColor('#e8e8e8');
          }}
        >
          <Suspense fallback={null}>
            <OrbitControls
              ref={controlsRef}
              enableDamping
              dampingFactor={0.05}
              autoRotate={false}
            />
          </Suspense>
        </Canvas>

        {/* Click to select */}
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={handleClick}
          style={{ pointerEvents: 'auto' }}
        />

        {/* UI Overlay */}
        <div className="absolute bottom-4 right-4 flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="bg-white/90">
                View Options
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-4 space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Quality</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highQuality}
                    onChange={(e) => setHighQuality(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">High Quality Shadows</span>
                </label>
              </div>

              {selectedId && (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold">Selected Component</h3>
                  <p className="text-xs text-muted-foreground">{selectedId}</p>

                  <Button
                    size="sm"
                    onClick={() => handleSwapProfile(selectedId)}
                    className="w-full text-xs"
                  >
                    Swap to Verified Profile
                  </Button>

                  <div className="text-xs space-y-1">
                    <p>
                      <strong>Source:</strong>{' '}
                      {profileMap.get(selectedId)?.metadata.source}
                    </p>
                    <p>
                      <strong>Confidence:</strong>{' '}
                      {((profileMap.get(selectedId)?.metadata.confidence || 0) * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>

        {/* Selection highlight */}
        {selectedId && (
          <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1.5 rounded-md shadow-lg text-sm">
            Selected: {selectedId}
          </div>
        )}
      </div>
    </div>
  );
}
