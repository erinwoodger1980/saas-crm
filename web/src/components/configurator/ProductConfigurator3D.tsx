/**
 * Unified Product Configurator 3D
 * Single configurator for doors, windows, and all joinery products
 * Product-type driven, parametric, with AI assistance
 */

'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import {
  SceneConfig,
  CameraState,
  ComponentVisibility,
  UIToggles,
  CameraMode,
} from '@/types/scene-config';
import { ProductParams, EditableAttribute, ComponentEdit } from '@/types/parametric-builder';
import {
  getOrCreateParams,
  initializeSceneFromParams,
  applyEditToScene,
  rebuildSceneConfig,
} from '@/lib/scene/builder-registry';
import { CameraController } from './CameraController';
import { Lighting } from './Lighting';
import { ProductComponents } from './ProductComponents';
import { SceneUI } from './SceneUI';
import { InspectorPanel } from './InspectorPanel';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ProductConfigurator3DProps {
  /** Tenant ID for multi-tenancy */
  tenantId: string;
  /** Entity type being configured (usually 'quoteLineItem') */
  entityType: string;
  /** Entity ID being configured */
  entityId: string;
  /** Quote line item data */
  lineItem: any;
  /** Callback when configuration changes */
  onChange?: (config: SceneConfig) => void;
  /** Canvas dimensions */
  width?: string | number;
  height?: string | number;
  /** Callback when closed */
  onClose?: () => void;
}

/**
 * Fetch scene state from API
 */
async function loadSceneState(
  tenantId: string,
  entityType: string,
  entityId: string
): Promise<SceneConfig | null> {
  try {
    const params = new URLSearchParams({ tenantId, entityType, entityId });
    const response = await fetch(`/api/scene-state?${params}`);
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to load scene state');
    }
    
    const data = await response.json();
    return data.data.config;
  } catch (error) {
    console.error('Error loading scene state:', error);
    return null;
  }
}

/**
 * Save scene state to API
 */
async function saveSceneState(
  tenantId: string,
  entityType: string,
  entityId: string,
  config: SceneConfig
): Promise<boolean> {
  try {
    const response = await fetch('/api/scene-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        entityType,
        entityId,
        config,
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error saving scene state:', error);
    return false;
  }
}

/**
 * Main Product Configurator Component
 */
export function ProductConfigurator3D({
  tenantId,
  entityType,
  entityId,
  lineItem,
  onChange,
  width = '100%',
  height = '80vh',
  onClose,
}: ProductConfigurator3DProps) {
  const [config, setConfig] = useState<SceneConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [editableAttributes, setEditableAttributes] = useState<Record<string, EditableAttribute[]>>({});

  /**
   * Load or initialize scene configuration
   */
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      
      let loaded: SceneConfig | null = null;
      
      // For preview mode (settings, etc.), skip API load
      const isPreviewMode = tenantId === 'settings' || tenantId === 'preview';
      
      if (!isPreviewMode) {
        // Try to load existing scene state from database
        loaded = await loadSceneState(tenantId, entityType, entityId);
      }
      
      if (!loaded) {
        // Initialize from line item
        try {
          // In preview mode, ensure lineItem has minimum required structure
          let effectiveLineItem = lineItem;
          if (isPreviewMode && lineItem?.configuredProduct?.productType) {
            const pt = lineItem.configuredProduct.productType;
            effectiveLineItem = {
              ...lineItem,
              lineStandard: {
                widthMm: 914,
                heightMm: 2032,
              },
              meta: {
                depthMm: pt.category === 'doors' ? 45 : 100,
              },
            };
          }
          
          const params = getOrCreateParams(effectiveLineItem);
          if (params) {
            loaded = initializeSceneFromParams(params, tenantId, entityType, entityId);
            if (loaded && !isPreviewMode) {
              // Save initial state (skip for preview mode)
              await saveSceneState(tenantId, entityType, entityId, loaded);
            }
          } else {
            console.error('Failed to generate params from lineItem:', effectiveLineItem);
          }
        } catch (error) {
          console.error('Error initializing scene:', error, { lineItem });
        }
      }
      
      if (loaded) {
        setConfig(loaded);
        // Extract editable attributes from customData
        if (loaded.customData) {
          const builder = await import('@/lib/scene/builder-registry');
          const result = builder.buildScene(loaded.customData as ProductParams);
          if (result?.editableAttributes) {
            setEditableAttributes(result.editableAttributes);
          }
        }
      } else {
        console.error('Failed to initialize configurator', { lineItem, tenantId, entityType, entityId });
        toast.error('Failed to initialize configurator - check product type configuration');
      }
      
      setIsLoading(false);
    }
    
    load();
  }, [tenantId, entityType, entityId, lineItem]);

  /**
   * Persist configuration changes to database
   * Debounced to avoid excessive writes
   */
  const persistConfig = useCallback(
    async (newConfig: SceneConfig) => {
      // Skip persistence in preview mode
      const isPreviewMode = tenantId === 'settings' || tenantId === 'preview';
      if (isPreviewMode) {
        return;
      }
      
      setIsSaving(true);
      const success = await saveSceneState(tenantId, entityType, entityId, newConfig);
      setIsSaving(false);
      
      if (!success) {
        console.warn('Failed to persist scene configuration');
        toast.error('Failed to save configuration');
      } else {
        toast.success('Configuration saved');
      }
    },
    [tenantId, entityType, entityId]
  );

  /**
   * Update configuration and persist
   */
  const updateConfig = useCallback(
    (updates: Partial<SceneConfig>) => {
      setConfig((prev) => {
        if (!prev) return prev;
        
        const newConfig = {
          ...prev,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        
        // Persist to database (debounced via setTimeout)
        setTimeout(() => persistConfig(newConfig), 500);
        
        // Notify parent
        if (onChange) {
          onChange(newConfig);
        }
        
        return newConfig;
      });
    },
    [persistConfig, onChange]
  );

  /**
   * Handle component selection from raycasting
   */
  const handleComponentSelect = useCallback((componentId: string | null) => {
    setSelectedComponentId(componentId);
  }, []);

  /**
   * Handle attribute edit from inspector
   */
  const handleAttributeEdit = useCallback(
    (componentId: string, changes: Record<string, any>) => {
      if (!config) return;
      
      // Apply edit and rebuild scene
      const updated = applyEditToScene(config, componentId, changes);
      
      setConfig(updated);
      
      // Update editable attributes
      if (updated.customData) {
        import('@/lib/scene/builder-registry').then((builder) => {
          const result = builder.buildScene(updated.customData as ProductParams);
          if (result?.editableAttributes) {
            setEditableAttributes(result.editableAttributes);
          }
        });
      }
      
      // Persist
      setTimeout(() => persistConfig(updated), 500);
    },
    [config, persistConfig]
  );

  /**
   * Camera change handler
   */
  const handleCameraChange = useCallback(
    (camera: CameraState) => {
      updateConfig({ camera });
    },
    [updateConfig]
  );

  /**
   * Visibility toggle handler
   */
  const handleVisibilityToggle = useCallback(
    (componentId: string, visible: boolean) => {
      if (!config) return;
      
      const newVisibility = {
        ...config.visibility,
        [componentId]: visible,
      };
      
      updateConfig({ visibility: newVisibility });
    },
    [config, updateConfig]
  );

  /**
   * UI toggles handler
   */
  const handleUIToggle = useCallback(
    (ui: UIToggles) => {
      updateConfig({ ui });
    },
    [updateConfig]
  );

  /**
   * Reset to defaults
   */
  const handleReset = useCallback(async () => {
    if (!confirm('Reset to default configuration? This cannot be undone.')) {
      return;
    }
    
    const params = getOrCreateParams(lineItem);
    if (!params) {
      toast.error('Failed to reset configuration');
      return;
    }
    
    const fresh = initializeSceneFromParams(params, tenantId, entityType, entityId);
    if (fresh) {
      setConfig(fresh);
      await persistConfig(fresh);
      toast.success('Configuration reset');
    }
  }, [lineItem, tenantId, entityType, entityId, persistConfig]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ width, height }}>
        <p className="text-muted-foreground">Failed to load configuration</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const selectedAttributes = selectedComponentId ? editableAttributes[selectedComponentId] : null;

  return (
    <div className="relative flex gap-4" style={{ width, height }}>
      {/* Main 3D Canvas */}
      <div className="flex-1 relative bg-gradient-to-b from-slate-50 to-slate-100 rounded-lg overflow-hidden border">
        <Canvas
          shadows
          camera={{
            position: config.camera.position,
            fov: config.camera.mode === 'Perspective' ? config.camera.fov : undefined,
          }}
          gl={{ antialias: true, alpha: false }}
        >
          <Suspense fallback={null}>
            {/* Camera controller */}
            <CameraController
              camera={config.camera}
              onCameraChange={handleCameraChange}
            />
            
            {/* Lighting */}
            <Lighting config={config.lighting} />
            
            {/* Product components */}
            <ProductComponents
              components={config.components}
              materials={config.materials}
              visibility={config.visibility}
              onSelect={handleComponentSelect}
              selectedId={selectedComponentId}
            />
            
            {/* Environment */}
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
        
        {/* UI Overlay */}
        <SceneUI
          components={config.components}
          ui={config.ui}
          cameraMode={config.camera.mode}
          onCameraModeChange={(mode) => {
            updateConfig({
              camera: { ...config.camera, mode },
            });
          }}
          onUIToggle={(key, value) => {
            updateConfig({
              ui: { ...config.ui, [key]: value },
            });
          }}
          onVisibilityToggle={handleVisibilityToggle}
          onResetCamera={() => {
            // Reset camera to default position
            const params = config.customData as ProductParams;
            updateConfig({
              camera: {
                ...config.camera,
                position: [0, 0, Math.max(params.dimensions.width, params.dimensions.height) * 2],
                rotation: [0, 0, 0],
                target: [0, 0, 0],
                zoom: 1,
              },
            });
          }}
        />
        
        {/* Save indicator */}
        {isSaving && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-md shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Saving...</span>
          </div>
        )}
      </div>
      
      {/* Inspector Panel */}
      <div className="w-80 flex flex-col gap-4">
        <InspectorPanel
          selectedComponentId={selectedComponentId}
          attributes={selectedAttributes}
          onAttributeChange={(changes) => {
            if (selectedComponentId) {
              handleAttributeEdit(selectedComponentId, changes);
            }
          }}
        />
        
        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            className="w-full"
          >
            Reset to Defaults
          </Button>
          
          {onClose && (
            <Button
              onClick={onClose}
              className="w-full"
            >
              Close Configurator
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
