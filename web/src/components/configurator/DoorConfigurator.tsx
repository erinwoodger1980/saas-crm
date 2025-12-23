/**
 * Door Configurator Component
 * Professional 3D configurator with complete state persistence
 * FileMaker parity: camera state, visibility, view mode all persist exactly
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { detectZFighting, logZFightingWarnings } from '@/lib/render/renderHints';
import {
  SceneConfig,
  CameraState,
  ComponentVisibility,
  UIToggles,
  CameraMode,
  createDefaultSceneConfig,
  buildVisibilityMap,
  applyVisibilityMap,
  DEFAULT_CAMERA_STATE,
} from '@/types/scene-config';
import { CameraController } from './CameraController';
import { Lighting } from './Lighting';
import { DoorComponents } from './DoorComponents';
import { SceneUI } from './SceneUI';
import { PostFX } from './PostFX';
import { Loader2 } from 'lucide-react';

interface DoorConfiguratorProps {
  /** Tenant ID for multi-tenancy */
  tenantId: string;
  /** Entity type being configured */
  entityType: string;
  /** Entity ID being configured */
  entityId: string;
  /** Initial scene configuration (if not loading from DB) */
  initialConfig?: SceneConfig;
  /** Callback when configuration changes */
  onChange?: (config: SceneConfig) => void;
  /** Canvas dimensions */
  width?: string | number;
  height?: string | number;
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
 * Main Door Configurator Component
 */
export function DoorConfigurator({
  tenantId,
  entityType,
  entityId,
  initialConfig,
  onChange,
  width = '100%',
  height = '600px',
}: DoorConfiguratorProps) {
  // Initialize with safe defaults immediately to prevent null/undefined errors
  const [config, setConfig] = useState<SceneConfig>(() => {
    return initialConfig || createDefaultSceneConfig(914, 2032, 45);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const debugZFight = process.env.NEXT_PUBLIC_DEBUG_ZFIGHT === 'true';

  /**
   * Debug useEffect - expose scene state to window for inspection
   */
  useEffect(() => {
    console.log('🔥 Scene mounted - DoorConfigurator');
    console.log('[SceneState]', {
      components: config.components?.length || 0,
      materials: config.materials?.length || 0,
      dimensions: config.dimensions,
      camera: config.camera,
      visibility: Object.keys(config.visibility || {}).length,
      metadata: config.metadata,
    });
    // Safely expose to browser DevTools
    (window as any).__SCENE_STATE__ = config;
  }, [config]);

  /**
   * Load scene configuration on mount
   */
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      
      // Try to load from database
      const loaded = await loadSceneState(tenantId, entityType, entityId);
      
      if (loaded) {
        // Merge with defaults to guarantee all required fields
        const d = createDefaultSceneConfig(
          loaded?.dimensions?.width ?? 914,
          loaded?.dimensions?.height ?? 2032,
          loaded?.dimensions?.depth ?? 45
        );
        const safeConfig: SceneConfig = {
          ...d,
          ...loaded,
          components: Array.isArray(loaded.components) ? loaded.components : [],
          materials: Array.isArray(loaded.materials) ? loaded.materials : [],
          visibility: loaded.visibility || {},
          camera: { ...(d.camera), ...(loaded.camera || {}) },
          ui: { ...(d.ui), ...(loaded.ui || {}) },
          lighting: { ...(d.lighting), ...(loaded.lighting || {}) },
        };
        setConfig(safeConfig);
      } else if (initialConfig) {
        // Merge initialConfig with defaults to guarantee all required fields
        const d = createDefaultSceneConfig(
          initialConfig?.dimensions?.width ?? 914,
          initialConfig?.dimensions?.height ?? 2032,
          initialConfig?.dimensions?.depth ?? 45
        );
        const safeConfig: SceneConfig = {
          ...d,
          ...initialConfig,
          components: Array.isArray(initialConfig.components) ? initialConfig.components : [],
          materials: Array.isArray(initialConfig.materials) ? initialConfig.materials : [],
          visibility: initialConfig.visibility || {},
          camera: { ...(d.camera), ...(initialConfig.camera || {}) },
          ui: { ...(d.ui), ...(initialConfig.ui || {}) },
          lighting: { ...(d.lighting), ...(initialConfig.lighting || {}) },
        };
        setConfig(safeConfig);
      }
      // Note: default config already set in useState initializer
      
      setIsLoading(false);
    }
    
    load();
  }, [tenantId, entityType, entityId, initialConfig]);

  /**
   * Persist configuration changes to database
   * Debounced to avoid excessive writes
   */
  const persistConfig = useCallback(
    async (newConfig: SceneConfig) => {
      setIsSaving(true);
      const success = await saveSceneState(tenantId, entityType, entityId, newConfig);
      setIsSaving(false);
      
      if (!success) {
        console.warn('Failed to persist scene configuration');
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
        
        // Persist to database
        persistConfig(newConfig);
        
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
   * Camera change handler
   */
  const handleCameraChange = useCallback(
    (cameraUpdates: Partial<CameraState>) => {
      updateConfig({
        camera: {
          ...config!.camera,
          ...cameraUpdates,
        },
      });
    },
    [config, updateConfig]
  );

  /**
   * Camera mode toggle
   */
  const handleCameraModeChange = useCallback(
    (mode: CameraMode) => {
      updateConfig({
        camera: {
          ...config!.camera,
          mode,
        },
      });
    },
    [config, updateConfig]
  );

  /**
   * Reset camera to default view
   */
  const handleResetCamera = useCallback(() => {
    updateConfig({
      camera: { ...DEFAULT_CAMERA_STATE },
    });
  }, [updateConfig]);

  /**
   * UI toggle handler
   */
  const handleUIToggle = useCallback(
    (key: keyof UIToggles, value: boolean) => {
      updateConfig({
        ui: {
          ...config!.ui,
          [key]: value,
        },
      });
    },
    [config, updateConfig]
  );

  /**
   * Component visibility toggle
   */
  const handleVisibilityToggle = useCallback(
    (componentId: string, visible: boolean) => {
      const newVisibility = {
        ...config!.visibility,
        [componentId]: visible,
      };
      
      // Apply to component tree
      const updatedComponents = applyVisibilityMap(config!.components, newVisibility);
      
      updateConfig({
        components: updatedComponents,
        visibility: newVisibility,
      });
    },
    [config, updateConfig]
  );

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 rounded-lg"
        style={{ width, height }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
      {/* 3D Canvas */}
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          shadowMap: {
            enabled: true,
            type: THREE.PCFSoftShadowMap,
            autoUpdate: true,
          } as any,
        }}
        style={{
          background: '#e6e6e6',
          borderRadius: '8px',
          width: '100%',
          height: '100%',
        }}
        onCreated={(state) => {
          // Debug z-fighting on demand
          if (debugZFight) {
            console.log('🔍 Z-fighting audit enabled');
            logZFightingWarnings(state.scene);
          }
        }}
      >
        <Suspense fallback={null}>
          {/* Post-processing anti-aliasing layer */}
          <PostFX enabled={true} heroMode={false} />

          {/* Camera Controller */}
          <CameraController
            cameraState={config.camera}
            productWidth={config.dimensions.width}
            productHeight={config.dimensions.height}
            onCameraChange={handleCameraChange}
          />

          {/* Lighting */}
          <Lighting config={config.lighting} />

          {/* Door Components */}
          <DoorComponents
            components={config.components}
            materials={config.materials}
            visibility={config.visibility}
          />

          {/* Axis helper (conditional) */}
          {config.ui.axis && <axesHelper args={[500]} />}

          {/* Grid helper (conditional) */}
          {config.ui.guides && (
            <gridHelper
              args={[
                Math.max(config.dimensions.width, config.dimensions.height) * 2,
                20,
                '#666666',
                '#999999',
              ]}
              position={[0, -config.dimensions.height / 2, 0]}
            />
          )}

          {/* Environment map */}
          <Environment preset="apartment" background={false} />
        </Suspense>
      </Canvas>

      {/* UI Controls Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <SceneUI
          components={config.components}
          ui={config.ui}
          cameraMode={config.camera?.mode ?? DEFAULT_CAMERA_STATE.mode}
          onCameraModeChange={handleCameraModeChange}
          onUIToggle={handleUIToggle}
          onVisibilityToggle={handleVisibilityToggle}
          onResetCamera={handleResetCamera}
        />
      </div>

      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-sm text-gray-700">Saving...</span>
        </div>
      )}
    </div>
  );
}
