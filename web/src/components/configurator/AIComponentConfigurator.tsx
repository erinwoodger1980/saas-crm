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
        const minimalConfig: SceneConfig = {
          version: 1,
          components: components.map((comp: GeneratedComponent) => ({
            id: comp.id,
            name: comp.name,
            type: 'component',
            visible: true,
            geometry: {
              type: 'box',
              dimensions: {
                width: comp.width,
                height: comp.height,
                depth: comp.depth,
              },
            },
            position: comp.position,
            material: comp.material || 'wood',
          })),
          camera: {
            position: [0, 1000, 2000],
            rotation: [0, 0, 0],
            target: [0, 0, 0],
            zoom: 1,
            fov: 50,
            mode: 'Perspective',
          },
          lighting: {
            boundsX: [-1500, 1500],
            boundsZ: [-1500, 1500],
            intensity: 1,
            shadowCatcherDiameter: 3000,
            ambientIntensity: 0.6,
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
      <div className="p-6 border-b space-y-4">
        <h2 className="text-2xl font-semibold">AI Component Generator</h2>
        <p className="text-sm text-muted-foreground">
          Describe your product and AI will estimate the components and dimensions
        </p>

        <div className="space-y-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., 'Oak hardwood door frame with 4 panels, beveled edges, natural finish, hinges on left side'"
            className="min-h-24 resize-none"
          />

          <div className="flex gap-2">
            <Button
              onClick={handleGeneratePreview}
              disabled={isGenerating || !description.trim()}
              className="gap-2 flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate Preview
                </>
              )}
            </Button>

            {generatedComponents.length > 0 && (
              <Button
                onClick={handleCreateComponents}
                disabled={isCreating}
                variant="default"
                className="gap-2 flex-1"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create {generatedComponents.length} Components
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3D Canvas */}
      {config ? (
        <div className="flex-1 relative bg-gradient-to-b from-slate-50 to-slate-100">
          <Canvas
            shadows
            camera={{
              position: [0, 1000, 2000],
              fov: 50,
              near: 1,
              far: 10000,
            }}
            gl={{ antialias: true, alpha: false }}
          >
            {/* Simple orbit controls - no UI */}
            <OrbitControls
              autoRotate
              autoRotateSpeed={2}
              enableZoom
              enablePan
              enableRotate
            />

            {/* Lighting */}
            <Lighting config={config.lighting} />

            {/* Generated components */}
            <ProductComponents
              components={config.components}
              materials={config.materials}
              visibility={config.visibility}
              onSelect={() => {}}
              selectedId={null}
            />

            {/* Environment */}
            <Environment preset="studio" />
          </Canvas>

          {/* Component info overlay */}
          {generatedComponents.length > 0 && (
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur rounded-lg p-4 shadow-lg max-w-xs">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Generated Components</h3>
                <div className="space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                  {generatedComponents.map((comp) => (
                    <div key={comp.id} className="flex justify-between">
                      <span>{comp.name}</span>
                      <span className="font-mono text-right">
                        {comp.width}×{comp.height}×{comp.depth}mm
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">Enter a description and click "Generate Preview"</p>
            <p className="text-xs text-muted-foreground">The 3D model will appear here</p>
          </div>
        </div>
      )}

      {/* Footer buttons */}
      <div className="p-4 border-t flex gap-2">
        {onClose && (
          <Button onClick={onClose} variant="outline" className="flex-1">
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
