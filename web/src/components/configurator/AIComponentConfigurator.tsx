/**
 * AI Component Configurator
 * Simplified 3D configurator that generates components from description using OpenAI
 * Hides all camera controls and UI complexity
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Loader2, Wand2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Lighting } from './Lighting';
import { ProductComponents } from './ProductComponents';
import { createCycloramaBackdrop } from '@/lib/scene/geometry';
import { SceneConfig } from '@/types/scene-config';
import { ProductParams } from '@/types/parametric-builder';
import { initializeSceneFromParams } from '@/lib/scene/builder-registry';

interface AIComponentConfiguratorProps {
  tenantId: string;
  lineItem: any;
  description?: string;
  onGeneratedComponents?: (components: any[]) => void;
  onClose?: () => void;
  height?: string | number;
}

interface GeneratedComponent {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  depth: number;
  material: string;
  position: [number, number, number];
}

export function AIComponentConfigurator({
  tenantId,
  lineItem,
  description: initialDescription = '',
  onGeneratedComponents,
  onClose,
  height = '80vh',
}: AIComponentConfiguratorProps) {
  const [description, setDescription] = useState(initialDescription);
  const [generatedComponents, setGeneratedComponents] = useState<GeneratedComponent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [config, setConfig] = useState<SceneConfig | null>(null);

  /**
   * Call OpenAI to generate components based on description
   */
  const handleGeneratePreview = useCallback(async () => {
    if (!description.trim()) {
      toast.error('Please enter a product description');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/estimate-components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          description: description.trim(),
          productType: lineItem?.configuredProduct?.productType,
          existingDimensions: lineItem?.lineStandard,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error response:', errorData);
        throw new Error(`API error: ${response.status} - ${errorData.error || ''} - ${errorData.details || ''}`);
      }

      const data = await response.json();
      const components = data.components || [];

      setGeneratedComponents(components);

      // Create a minimal scene config to render the components
      if (components.length > 0) {
        // Calculate bounds from all components
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        components.forEach((comp: GeneratedComponent) => {
          const halfW = comp.width / 2;
          const halfH = comp.height / 2;
          const halfD = comp.depth / 2;
          const [x, y, z] = comp.position;

          minX = Math.min(minX, x - halfW);
          maxX = Math.max(maxX, x + halfW);
          minY = Math.min(minY, y - halfH);
          maxY = Math.max(maxY, y + halfH);
          minZ = Math.min(minZ, z - halfD);
          maxZ = Math.max(maxZ, z + halfD);
        });

        // Add more padding for better framing
        const padX = (maxX - minX) * 0.3;
        const padY = (maxY - minY) * 0.5; // More top padding for better view
        const padZ = (maxZ - minZ) * 0.3;

        minX -= padX;
        maxX += padX;
        minY -= padY * 0.2; // Less bottom padding
        maxY += padY;
        minZ -= padZ;
        maxZ += padZ;

        // Calculate camera distance to fit all components in view
        const width = maxX - minX;
        const height = maxY - minY;
        const depth = maxZ - minZ;
        const maxDim = Math.max(width, height, depth);

        // Position camera to view all components
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        
        // Professional hero angle - 3/4 perspective for product photography
        const cameraDistance = maxDim * 1.5;
        const camX = centerX + width * 0.6; // Right side view
        const camY = centerY + height * 0.7; // Elevated perspective
        const camZ = centerZ + depth * 1.5; // Forward distance

        const minimalConfig: SceneConfig = {
          version: 1,
          components: components.map((comp: GeneratedComponent) => ({
            id: comp.id,
            name: comp.name,
            type: 'panel' as const,
            visible: true,
            geometry: {
              type: 'box' as const,
              dimensions: [comp.width, comp.height, comp.depth],
              position: comp.position,
            },
            materialId: comp.material || 'wood',
          })),
          camera: {
            position: [camX, camY, camZ],
            rotation: [0, 0, 0],
            target: [centerX, centerY, centerZ],
            zoom: 1,
            fov: 50,
            mode: 'Perspective',
          },
          lighting: {
            boundsX: [minX, maxX],
            boundsZ: [minZ, maxZ],
            intensity: 1.2,
            shadowCatcherDiameter: Math.max(width, depth) * 1.2,
            ambientIntensity: 0.7,
            castShadows: true,
          },
          materials: {
            default: {
              color: '#d4a574',
              metalness: 0.1,
              roughness: 0.8,
            },
          },
          visibility: {
            components: true,
            grid: false,
            wireframe: false,
            bounding: false,
            normals: false,
          },
          ui: {
            showComponentNames: false,
            showDimensions: false,
            showGrid: false,
          },
          customData: {
            components,
          },
        };

        setConfig(minimalConfig);
        toast.success(`Generated ${components.length} components`);
      } else {
        toast.info('No components generated. Try a more specific description.');
      }
    } catch (error) {
      console.error('Error generating components:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  }, [description, tenantId, lineItem]);

  /**
   * Save generated components to component table
   */
  const handleCreateComponents = useCallback(async () => {
    if (generatedComponents.length === 0) {
      toast.error('No components to create. Generate a preview first.');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/components/batch-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          components: generatedComponents.map((comp) => ({
            name: comp.name,
            type: comp.type,
            width: comp.width,
            height: comp.height,
            depth: comp.depth,
            material: comp.material,
            sourceDescription: description,
            aiGenerated: true,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      toast.success(`Created ${data.createdCount} components`);

      // Call callback if provided
      if (onGeneratedComponents) {
        onGeneratedComponents(data.components);
      }

      // Close after successful creation
      if (onClose) {
        setTimeout(onClose, 1000);
      }
    } catch (error) {
      console.error('Error creating components:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create components');
    } finally {
      setIsCreating(false);
    }
  }, [generatedComponents, description, tenantId, onGeneratedComponents, onClose]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden">
      {/* Header with description input */}
      <div className="p-3 border-b space-y-2">
        <h2 className="text-lg font-semibold">AI Component Generator</h2>

        <div className="space-y-2">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your product (e.g., 'Oak hardwood door frame with 4 panels')"
            className="min-h-16 resize-none text-sm"
          />

          <div className="flex gap-2">
            <Button
              onClick={handleGeneratePreview}
              disabled={isGenerating || !description.trim()}
              className="gap-2 flex-1 h-9 text-sm"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  Generate Preview
                </>
              )}
            </Button>

            {generatedComponents.length > 0 && (
              <Button
                onClick={handleCreateComponents}
                disabled={isCreating}
                variant="default"
                className="gap-2 flex-1 h-9 text-sm"
                size="sm"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Create {generatedComponents.length}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3D Canvas - Studio Quality */}
      {config ? (
        <div className="flex-1 relative min-h-[420px]" style={{ backgroundColor: '#f2f2f2' }}>
          <Canvas
            shadows="soft"
            camera={{
              position: config.camera.position,
              fov: 45,
              near: 1,
              far: 10000,
            }}
            gl={{
              antialias: true,
              alpha: false,
              preserveDrawingBuffer: true,
              outputColorSpace: 'srgb',
              toneMapping: 2, // ACESFilmicToneMapping
              toneMappingExposure: 1.0,
            }}
            // Force clear color to studio off-white so background cannot be black
            onCreated={({ gl }) => {
              gl.setClearColor('#f2f2f2');
            }}
            style={{ background: '#f2f2f2' }}
          >
            {/* Studio environment for realistic reflections */}
            <Environment preset="studio" />
            
            {/* Orbit controls - slower rotation for professional presentation */}
            <OrbitControls
              autoRotate
              autoRotateSpeed={0.5}
              enableZoom
              enablePan
              enableRotate
            />

            {/* Lighting */}
            <Lighting config={config.lighting} />

            {/* Studio cyclorama backdrop */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
              <primitive object={createCycloramaBackdrop(5000, 3000, 2000)} />
              <meshStandardMaterial color="#f2f2f2" roughness={0.9} metalness={0.0} />
            </mesh>

            {/* Generated components */}
            <ProductComponents
              components={config.components}
              materials={config.materials}
              visibility={config.visibility}
              onSelect={() => {}}
              selectedId={null}
            />
          </Canvas>

          {/* Component info overlay */}
          {generatedComponents.length > 0 && (
            <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur rounded-lg p-3 shadow-lg max-w-xs max-h-48 overflow-y-auto">
              <div className="space-y-1.5">
                <h3 className="font-semibold text-xs">Components ({generatedComponents.length})</h3>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  {generatedComponents.map((comp) => (
                    <div key={comp.id} className="flex justify-between gap-2">
                      <span className="truncate">{comp.name}</span>
                      <span className="font-mono text-right whitespace-nowrap">
                        {comp.width}×{comp.height}×{comp.depth}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#f5f5f0' }}>
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">Enter a description and click "Generate Preview"</p>
            <p className="text-xs text-muted-foreground">The 3D model will appear here</p>
          </div>
        </div>
      )}

      {/* Footer buttons */}
      <div className="p-2 border-t flex gap-2">
        {onClose && (
          <Button onClick={onClose} variant="outline" className="flex-1 h-8 text-sm" size="sm">
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
