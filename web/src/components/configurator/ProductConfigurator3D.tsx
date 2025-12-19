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
    const response = await fetch(`/api/scene-state?${params}`, {
      credentials: 'include',
    });
    
    // Debug logging (controlled by env var)
    if (process.env.NEXT_PUBLIC_DEBUG_SCENE_STATE === 'true') {
      console.log('[loadSceneState]', {
        status: response.status,
        tenantId,
        entityType,
        entityId,
      });
    }
    
    // Handle expected error cases gracefully
    if (!response.ok) {
      if (response.status === 404) {
        // No scene state saved yet - normal for first time
        return null;
      }
      if (response.status === 401 || response.status === 403) {
        // Auth failure - log but don't throw
        console.warn('[loadSceneState] Auth error, will use default scene:', response.status);
        return null;
      }
      // Other errors - log and return null
      console.warn('[loadSceneState] API error, will use default scene:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.data?.config || null;
  } catch (error) {
    console.error('[loadSceneState] Fetch error, will use default scene:', error);
    return null;
  }
}

/**
 * Save scene state to API
 * Returns { success: boolean, shouldDisable: boolean }
 */
async function saveSceneState(
  tenantId: string,
  entityType: string,
  entityId: string,
  config: SceneConfig
): Promise<{ success: boolean; shouldDisable: boolean }> {
  try {
    const response = await fetch('/api/scene-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        tenantId,
        entityType,
        entityId,
        config,
      }),
    });
    
    // Debug logging (controlled by env var)
    if (process.env.NEXT_PUBLIC_DEBUG_SCENE_STATE === 'true') {
      console.log('[saveSceneState]', {
        status: response.status,
        tenantId,
        entityType,
        entityId,
      });
    }
    
    // If auth fails, disable further saves to prevent retry storm
    if (response.status === 401 || response.status === 403) {
      console.warn('[saveSceneState] Auth error, disabling autosave');
      return { success: false, shouldDisable: true };
    }
    
    return { success: response.ok, shouldDisable: false };
  } catch (error) {
    console.error('[saveSceneState] Fetch error:', error);
    return { success: false, shouldDisable: false };
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
  const [canRender, setCanRender] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveDisabled, setSaveDisabled] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [editableAttributes, setEditableAttributes] = useState<Record<string, EditableAttribute[]>>({});;

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
          console.log('[ProductConfigurator3D] Initializing from lineItem:', { lineItem, tenantId, entityType, entityId });
          
          // In preview mode, ensure lineItem has minimum required structure
          let effectiveLineItem = lineItem;
          if (isPreviewMode && lineItem?.configuredProduct?.productType) {
            const pt = lineItem.configuredProduct.productType;
            console.log('[ProductConfigurator3D] Using preview mode with productType:', pt);
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
          
          console.log('[ProductConfigurator3D] Effective lineItem:', effectiveLineItem);
          
          // Check if product type can be detected
          const { detectProductType } = await import('@/lib/scene/builder-registry');
          const detectedType = detectProductType(effectiveLineItem);
          console.log('[ProductConfigurator3D] Detected product type:', detectedType);
          
          if (!detectedType) {
            console.error('[ProductConfigurator3D] Cannot detect product type from lineItem:', effectiveLineItem);
            toast.error('Please configure the product type before opening 3D preview');
            setIsLoading(false);
            return;
          }
          
          const params = getOrCreateParams(effectiveLineItem);
          console.log('[ProductConfigurator3D] Generated params:', params);
          
          if (params) {
            loaded = initializeSceneFromParams(params, tenantId, entityType, entityId);
            console.log('[ProductConfigurator3D] Scene initialized:', loaded ? 'success' : 'null');
            
            if (loaded && !isPreviewMode) {
              // Save initial state (skip for preview mode)
              await saveSceneState(tenantId, entityType, entityId, loaded);
            }
          } else {
            console.error('[ProductConfigurator3D] Failed to generate params from lineItem:', effectiveLineItem);
          }
        } catch (error) {
          console.error('[ProductConfigurator3D] Error initializing scene:', error, { lineItem });
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
        // Give React time to update state before rendering Canvas
        setTimeout(() => setCanRender(true), 100);
      } else {
        console.error('[ProductConfigurator3D] Failed to initialize configurator', { lineItem, tenantId, entityType, entityId });
        toast.error('Failed to load 3D configurator. Please ensure the product has valid dimensions and type.');
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
      
      // Don't try to save if disabled due to auth failure
      if (saveDisabled) {
        return;
      }
      
      setIsSaving(true);
      const result = await saveSceneState(tenantId, entityType, entityId, newConfig);
      setIsSaving(false);
      
      if (result.shouldDisable) {
        setSaveDisabled(true);
        toast.error('Scene saving disabled (not authorized)', { duration: 5000 });
      } else if (!result.success) {
        console.warn('Failed to persist scene configuration');
        toast.error('Failed to save configuration');
      } else {
        toast.success('Configuration saved', { duration: 2000 });
      }
    },
    [tenantId, entityType, entityId, saveDisabled]
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
      <div className="flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ width, height }}>
        <p className="text-lg font-semibold text-foreground">Failed to load configuration</p>
        <div className="text-sm text-muted-foreground space-y-1 max-w-md">
          <p>The 3D preview could not initialize. This usually means:</p>
          <ul className="list-disc text-left pl-6 space-y-1">
            <li>Product dimensions are missing or invalid (width ≥ 500mm, height ≥ 1500mm)</li>
            <li>Product type/category is not configured</li>
            <li>Configuration data is corrupted</li>
          </ul>
        </div>
        <Button onClick={() => window.location.reload()} className="mt-2">Retry</Button>
      </div>
    );
  }

  const selectedAttributes = selectedComponentId ? editableAttributes[selectedComponentId] : null;

  // Wait for canRender flag before showing Canvas
  if (!canRender) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Safety check: ensure config is valid with all required properties before rendering Canvas
  const isConfigValid = config && 
    config.camera && 
    config.camera.position && 
    config.camera.mode && 
    config.components && 
    config.lighting && 
    config.materials;

  if (!isConfigValid) {
    console.error('[ProductConfigurator3D] Invalid config state:', {
      hasConfig: !!config,
      hasCamera: !!config?.camera,
      hasCameraPosition: !!config?.camera?.position,
      hasCameraMode: !!config?.camera?.mode,
      hasComponents: !!config?.components,
      hasLighting: !!config?.lighting,
      hasMaterials: !!config?.materials,
    });
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ width, height }}>
        <p className="text-muted-foreground">Configuration not ready</p>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // Safe camera mode access with default fallback to prevent crashes
  const cameraMode = config.camera?.mode || 'Perspective';

  return (
    <div className="relative flex gap-4" style={{ width, height }}>
      {/* Main 3D Canvas */}
      <div className="flex-1 relative bg-gradient-to-b from-slate-50 to-slate-100 rounded-lg overflow-hidden border">
        <Canvas
          shadows
          camera={{
            position: config.camera?.position || [0, 1000, 2000],
            fov: cameraMode === 'Perspective' ? (config.camera?.fov || 50) : 50,
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
          cameraMode={cameraMode}
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
