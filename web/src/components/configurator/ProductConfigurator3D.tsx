/**
 * Unified Product Configurator 3D
 * Single configurator for doors, windows, and all joinery products
 * Product-type driven, parametric, with AI assistance
 */

'use client';

import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
// import { Environment, ContactShadows } from '@react-three/drei'; // DISABLED: causing WebGL context loss
import * as THREE from 'three';
import { disposeScene, disposeRenderer } from '@/lib/three/disposal';
import {
  SceneConfig,
  CameraState,
  ComponentVisibility,
  UIToggles,
  CameraMode,
  DEFAULT_UI_TOGGLES,
  LightingConfig,
  ComponentNode,
} from '@/types/scene-config';
import { ProductParams, EditableAttribute, ComponentEdit } from '@/types/parametric-builder';
import {
  getOrCreateParams,
  initializeSceneFromParams,
  applyEditToScene,
  rebuildSceneConfig,
} from '@/lib/scene/builder-registry';
import { createLightingFromDimensions, normalizeLightingConfig } from '@/lib/scene/normalize-lighting';
import { CameraController } from './CameraController';
import { Lighting } from './Lighting';
import { ProductComponents } from './ProductComponents';
import { SceneUI } from './SceneUI';
import InspectorPanel from './InspectorPanel';
import { AutoFrame } from './AutoFrame';
import { Stage } from './Stage';
import { SceneDisposer } from './SceneDisposer';
import { PostFX } from './PostFX';
import { Loader2, Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { updateQuoteLine } from '@/lib/api/quotes';
import { toast } from 'sonner';
import { fitCameraToBox } from '@/lib/scene/fit-camera';
import { Box3, Vector3 } from 'three';

interface ProductConfigurator3DProps {
  /** Tenant ID for multi-tenancy */
  tenantId: string;
  /** Entity type being configured (usually 'quoteLineItem') */
  entityType: string;
  /** Entity ID being configured */
  entityId?: string;
  /** Quote line item data */
  lineItem?: any;
  /** Direct product type when no line item exists (settings preview) */
  productType?: {
    category: string;
    type?: string;
    option?: string;
  };
  /** Initial scene configuration to load (bypasses database load) */
  initialConfig?: SceneConfig;
  /** Callback when configuration changes */
  onChange?: (config: SceneConfig) => void;
  /** Canvas dimensions */
  width?: string | number;
  height?: string | number;
  /** Callback when closed */
  onClose?: () => void;
  /** Hero preview mode - hide UI, show only floating button */
  heroMode?: boolean;
  /** Render quality: 'low' for Settings preview (low power), 'high' for production */
  renderQuality?: 'low' | 'high';
  /** Settings preview mode - enables ultra low-power rendering */
  settingsPreview?: boolean;
}

/**
 * Fetch scene state from API
 */
async function loadSceneState(
  tenantId: string,
  entityType: string,
  entityId: string
): Promise<SceneConfig | null> {
  // Skip remote load for preview entities to avoid auth errors
  if (entityId.startsWith('preview-')) return null;
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
  // Skip remote save for preview entities to avoid auth errors
  if (entityId.startsWith('preview-')) {
    return { success: true, shouldDisable: false };
  }
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

function buildDefaultLighting(dimensions: SceneConfig['dimensions']): LightingConfig {
  const width = dimensions?.width ?? 1000;
  const height = dimensions?.height ?? 2000;
  const depth = dimensions?.depth ?? 45;
  
  return createLightingFromDimensions(width, height, depth);
}

function normalizeSceneConfig(config: SceneConfig): SceneConfig {
  const normalized: SceneConfig = {
    ...config,
    components: Array.isArray(config.components) ? config.components : [],
    materials: Array.isArray(config.materials) ? config.materials : [],
    visibility: config.visibility || {},
    ui: config.ui || { ...DEFAULT_UI_TOGGLES },
    lighting: normalizeLightingConfig(config.lighting || buildDefaultLighting(config.dimensions)),
  };

  normalized.materials = normalized.materials.map((mat) => {
    const safeMat: any = { ...mat };
    safeMat.baseColor = mat.baseColor || '#cccccc';
    safeMat.roughness = mat.roughness ?? 0.6;
    safeMat.metalness = mat.metalness ?? 0;
    safeMat.maps = Array.isArray((mat as any).maps) ? (mat as any).maps : [];
    return safeMat;
  });

  return normalized;
}

function getPreviewDefaults(productType?: { category?: string; type?: string; option?: string }) {
  const category = productType?.category;
  // Door defaults
  if (category === 'doors') {
    return { widthMm: 914, heightMm: 2032, depthMm: 45 };
  }
  // Window defaults
  if (category === 'windows') {
    return { widthMm: 1200, heightMm: 1200, depthMm: 100 };
  }
  // Generic fallback
  return { widthMm: 1000, heightMm: 2000, depthMm: 100 };
}

// Load state machine
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Main Product Configurator Component
 */
export function ProductConfigurator3D({
  tenantId,
  entityType,
  entityId,
  lineItem,
  productType,
  initialConfig,
  onChange,
  width = '100%',
  height = '80vh',
  onClose,
  heroMode = true,
  renderQuality = 'high',
  settingsPreview = false,
}: ProductConfigurator3DProps) {
  // ===== ALL STATE & REFS (MUST BE AT TOP) =====
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [loadStep, setLoadStep] = useState<string>('init');
  const [config, setConfig] = useState<SceneConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canRender, setCanRender] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveDisabled, setSaveDisabled] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [editableAttributes, setEditableAttributes] = useState<Record<string, EditableAttribute[]>>({});
  const [showUIDrawer, setShowUIDrawer] = useState(false);
  const [showInspectorDrawer, setShowInspectorDrawer] = useState(false);
  const [highQuality, setHighQuality] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  
  const controlsRef = useRef<any>(null);
  const initialFrameApplied = useRef(false);
  const loadInitiated = useRef(false);
  const mountedRef = useRef(true);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  
  // SETTINGS PREVIEW = ultra low-power mode
  const isLowPowerMode = renderQuality === 'low' || settingsPreview;

  // Retry handler for error state
  const handleRetry = useCallback(() => {
    setStatus('idle');
    setLoadError(null);
    setCanRender(false);
    initialFrameApplied.current = false;
    loadInitiated.current = false;
  }, []);

  // Track mount/unmount with COMPLETE WebGL cleanup
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ProductConfigurator3D] Mounted, settingsPreview:', settingsPreview, 'renderQuality:', renderQuality);
    }
    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[ProductConfigurator3D] Unmounting - Canvas will be fully disposed by SceneDisposer');
      }
      mountedRef.current = false;
    };
  }, [renderQuality, settingsPreview]);

  const safeEntityId = useMemo(() => String(entityId ?? 'preview-settings'), [entityId]);
  const isPreviewMode = useMemo(
    () => tenantId === 'settings' || tenantId === 'preview' || safeEntityId.startsWith('preview-'),
    [tenantId, safeEntityId]
  );
  
  // Create stable keys from object props to prevent infinite re-renders
  const lineItemKey = useMemo(() => {
    if (!lineItem) return 'null';
    return JSON.stringify({
      id: lineItem.id,
      widthMm: (lineItem as any)?.lineStandard?.widthMm,
      heightMm: (lineItem as any)?.lineStandard?.heightMm,
      productType: lineItem?.configuredProduct?.productType,
    });
  }, [lineItem]);
  
  const productTypeKey = useMemo(() => {
    if (!productType) return 'null';
    return JSON.stringify(productType);
  }, [productType]);

  // ===== COMPUTED VALUES (SAFE TO COMPUTE BEFORE RETURNS) =====
  const productWidth = (config?.customData as any)?.dimensions?.width || 1000;
  const productHeight = (config?.customData as any)?.dimensions?.height || 2000;
  const productDepth = (config?.customData as any)?.dimensions?.depth || 45;
  const cameraMode = config?.camera?.mode || 'Perspective';

  // Selected and fallback attributes must be computed before any conditional returns
  const selectedAttributes = selectedComponentId ? editableAttributes[selectedComponentId] : null;

  const fallbackAttributes = useMemo(() => {
    if (!selectedComponentId) return null;
    if (editableAttributes[selectedComponentId]) return null;

    const selectedComponent = config?.components.find(c => c.id === selectedComponentId);
    if (!selectedComponent) return null;

    const attrs: EditableAttribute[] = [];

    if (selectedComponent.position) {
      attrs.push({ key: 'positionX', label: 'Position X', type: 'number', value: selectedComponent.position[0], min: -2000, max: 2000 });
      attrs.push({ key: 'positionY', label: 'Position Y', type: 'number', value: selectedComponent.position[1], min: -2000, max: 2000 });
      attrs.push({ key: 'positionZ', label: 'Position Z', type: 'number', value: selectedComponent.position[2], min: -2000, max: 2000 });
    }

    if (selectedComponent.geometry?.type === 'box' && selectedComponent.geometry.dimensions) {
      attrs.push({ key: 'width', label: 'Width', type: 'number', value: selectedComponent.geometry.dimensions[0], min: 10, max: 5000 });
      attrs.push({ key: 'height', label: 'Height', type: 'number', value: selectedComponent.geometry.dimensions[1], min: 10, max: 5000 });
      attrs.push({ key: 'depth', label: 'Depth', type: 'number', value: selectedComponent.geometry.dimensions[2], min: 10, max: 500 });
    }

    return attrs.length > 0 ? attrs : null;
  }, [selectedComponentId, config?.components, editableAttributes]);

  const effectiveAttributes = selectedAttributes || fallbackAttributes;

  // ===== ALL EFFECTS (MUST BE AT TOP, BEFORE RETURNS) =====

  // Reset load state when entity changes
  useEffect(() => {
    loadInitiated.current = false;
    initialFrameApplied.current = false;
    setCanRender(false);
    setLoadError(null);
  }, [tenantId, entityType, safeEntityId, productType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (controlsRef.current?.dispose) {
        try {
          controlsRef.current.dispose();
        } catch (err) {
          console.warn('[ProductConfigurator3D] Failed to dispose controls:', err);
        }
      }
      if (rendererRef.current) {
        try {
          rendererRef.current.dispose();
          rendererRef.current.forceContextLoss?.();
          rendererRef.current.domElement?.remove?.();
        } catch (err) {
          console.warn('[ProductConfigurator3D] Failed to dispose renderer:', err);
        }
      }
    };
  }, []);

  // Inspector drawer trigger
  useEffect(() => {
    if (heroMode && selectedComponentId) {
      setShowInspectorDrawer(true);
    }
  }, [heroMode, selectedComponentId]);

  // Main scene load/initialize effect - SINGLE AUTHORITATIVE LOADER
  useEffect(() => {
    // Only skip if explicitly idle (initial mount before we want to load)
    // This prevents duplicate loads but ensures we can retry on error
    if (status === 'loading' || status === 'ready') {
      if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
        console.log('[ProductConfigurator3D] Skipping load - status:', status);
      }
      return;
    }

    const loadId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(7);
    const controller = new AbortController();

    async function load() {
      if (!mountedRef.current) return;

      if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
        console.group(`[3D LOAD ${loadId}]`);
        console.log('Inputs:', { tenantId, entityType, entityId, productType, hasInitialConfig: !!initialConfig });
      }

      setStatus('loading');
      setIsLoading(true);
      setLoadError(null);
      setCanRender(false);

      try {
        // Step 1: Validate inputs
        setLoadStep('validate-inputs');
        if (!tenantId) throw new Error('Missing tenantId');
        
        if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
          console.log('✓ Inputs validated');
        }

        // Step 2: Resolve configuration
        setLoadStep('resolve-config');
        let loaded: SceneConfig | null = null;

        // Priority 1: Use provided initialConfig
        if (initialConfig) {
          loaded = initialConfig;
          if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
            console.log('✓ Using initialConfig');
          }
        }
        // Priority 2: Load from database (non-preview only)
        else if (!isPreviewMode) {
          if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
            console.log('→ Loading from database...');
          }
          loaded = await loadSceneState(tenantId, entityType, safeEntityId);
          if (loaded && process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
            console.log('✓ Loaded from database');
          }
        }

        // Priority 3: Build from line item / product type
        if (!loaded) {
          setLoadStep('build-from-params');
          if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
            console.log('→ Building scene from params...');
          }

          const previewProductType = productType || lineItem?.configuredProduct?.productType;
          let effectiveLineItem = lineItem ?? {};

          if (isPreviewMode) {
            if (!previewProductType) {
              throw new Error('Preview mode requires a product type');
            }
            const defaults = getPreviewDefaults(previewProductType);
            const widthMm = Number((lineItem as any)?.lineStandard?.widthMm) || defaults.widthMm;
            const heightMm = Number((lineItem as any)?.lineStandard?.heightMm) || defaults.heightMm;
            const depthMm = Number((lineItem as any)?.meta?.depthMm) || defaults.depthMm;

            effectiveLineItem = {
              ...(lineItem || {}),
              configuredProduct: {
                ...(lineItem as any)?.configuredProduct,
                productType: previewProductType,
              },
              lineStandard: { widthMm, heightMm },
              meta: { ...(lineItem as any)?.meta, depthMm },
            };
          }

          // Detect product type
          const { detectProductType } = await import('@/lib/scene/builder-registry');
          const detectedType = detectProductType(effectiveLineItem);
          
          if (!detectedType) {
            throw new Error(
              isPreviewMode
                ? 'Select a product type to preview in 3D'
                : 'Cannot detect product type - please configure product dimensions and type'
            );
          }

          if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
            console.log('✓ Detected type:', detectedType);
          }

          // Generate params and build scene
          const params = getOrCreateParams(effectiveLineItem);
          if (!params) {
            throw new Error('Failed to generate scene parameters from product data');
          }

          if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
            console.log('✓ Generated params:', params);
          }

          loaded = initializeSceneFromParams(params, tenantId, entityType, safeEntityId);
          
          if (!loaded) {
            throw new Error('Scene initialization returned null - check builder registry');
          }

          if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
            console.log('✓ Scene built successfully');
          }

          // Save initial state (non-preview only)
          if (!isPreviewMode) {
            setLoadStep('save-initial-state');
            await saveSceneState(tenantId, entityType, safeEntityId, loaded);
            if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
              console.log('✓ Initial state saved');
            }
          }
        }

        if (!loaded) {
          throw new Error('Configuration resolution failed - no config generated');
        }

        // Step 3: Normalize and set config
        setLoadStep('normalize-config');
        const normalized = normalizeSceneConfig(loaded);
        
        if (!mountedRef.current || controller.signal.aborted) return;
        
        setConfig(normalized);

        if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
          console.log('✓ Config normalized and set');
        }

        // Step 4: Extract editable attributes
        setLoadStep('extract-attributes');
        if (normalized.customData) {
          const builder = await import('@/lib/scene/builder-registry');
          const result = builder.buildScene(normalized.customData as ProductParams);
          if (result?.editableAttributes) {
            setEditableAttributes(result.editableAttributes);
            if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
              console.log('✓ Attributes extracted:', Object.keys(result.editableAttributes).length, 'components');
            }
          }
        }

        // Step 5: Mark ready
        setLoadStep('ready');
        setStatus('ready');
        setCanRender(true);
        setIsLoading(false);

        if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
          console.log('✅ Load complete');
          console.groupEnd();
        }

      } catch (err) {
        if (!mountedRef.current || controller.signal.aborted) return;

        console.error('[3D LOAD ERROR]', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setLoadError(message);
        setStatus('error');
        setIsLoading(false);
        setCanRender(false);
        toast.error(`3D Load Failed: ${message}`);

        if (process.env.NEXT_PUBLIC_DEBUG_3D === 'true') {
          console.groupEnd();
        }
      }
    }

    // Start load with timeout protection
    const timeoutId = setTimeout(() => {
      if (mountedRef.current) {
        console.error('[3D LOAD TIMEOUT]');
        setStatus((currentStatus) => {
          if (currentStatus === 'loading') {
            setLoadError('Load timeout after 10 seconds');
            setIsLoading(false);
            setCanRender(false);
            toast.error('3D Load timeout - please try again');
            return 'error';
          }
          return currentStatus;
        });
      }
    }, 10000);

    load().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [tenantId, entityType, safeEntityId, lineItemKey, productTypeKey, isPreviewMode, initialConfig, status]);

  // Auto-frame once after load using bounding box from dimensions
  useEffect(() => {
    if (!canRender || initialFrameApplied.current || !controlsRef.current) return;
    if (!config) return;
    
    // Schedule frame fitting to next tick to avoid state loop
    const timeoutId = setTimeout(() => {
      if (!mountedRef.current || !controlsRef.current) return;
      
      const controls = controlsRef.current;
      const camera = controls.object;
      if (!camera) return;

      // Safely compute dimensions from config
      const w = (config.customData as any)?.dimensions?.width || 1000;
      const h = (config.customData as any)?.dimensions?.height || 2000;
      const d = (config.customData as any)?.dimensions?.depth || 45;

      const box = new Box3(
        new Vector3(-w / 2, 0, -d / 2),
        new Vector3(w / 2, h, d / 2)
      );

      try {
        fitCameraToBox(box, camera, controls, 1.05);
        initialFrameApplied.current = true;
      } catch (error) {
        console.warn('[ProductConfigurator3D] Auto-frame error:', error);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [canRender, config]);

  /**
   * Persist configuration changes to database
   * Debounced to avoid excessive writes
   */
  const persistConfig = useCallback(
    async (newConfig: SceneConfig) => {
      // Skip persistence in preview mode
      if (isPreviewMode) {
        return;
      }
      
      // Don't try to save if disabled due to auth failure
      if (saveDisabled) {
        return;
      }
      
      if (!mountedRef.current) return;
      setIsSaving(true);
      const result = await saveSceneState(tenantId, entityType, safeEntityId, newConfig);
      
      // Also persist key fields back to the quote line (width/height/thickness and selections)
      try {
        const params = newConfig.customData as ProductParams | undefined;
        const quoteId = (lineItem?.quoteId || lineItem?.quote_id || lineItem?.quoteID) as string | undefined;
        const lineId = (lineItem?.id) as string | undefined;
        if (params && quoteId && lineId) {
          const lineStandard: Record<string, any> = {
            widthMm: Number(params.dimensions.width) || undefined,
            heightMm: Number(params.dimensions.height) || undefined,
            thicknessMm: Number(params.dimensions.depth) || undefined,
            timber: params.construction?.timber || undefined,
            finish: params.construction?.finish || undefined,
            glazing: params.construction?.glazingType || undefined,
          };
          const metaPatch: Record<string, any> = {
            configuredProductParams: params,
          };
          await updateQuoteLine(String(quoteId), String(lineId), {
            lineStandard,
            meta: metaPatch,
          });
        }
      } catch (e) {
        console.warn('[ProductConfigurator3D] Failed to persist line-item fields:', e);
      }
      if (mountedRef.current) {
        setIsSaving(false);
      }
      
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
    [tenantId, entityType, safeEntityId, saveDisabled, lineItem, isPreviewMode]
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
   * Handle adding a new component
   */
  const handleAddComponent = useCallback(() => {
    if (!config) return;
    
    // Create a simple box component as template
    const newComponent: ComponentNode = {
      id: `component_${Date.now()}`,
      name: 'New Component',
      type: 'frame',
      visible: true,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      geometry: {
        type: 'box',
        dimensions: [100, 100, 50],
        position: [0, 0, 0],
      },
      materialId: config.materials[0]?.id || 'default',
    };

    const updatedConfig = {
      ...config,
      components: [...config.components, newComponent],
    };

    setConfig(updatedConfig);
    persistConfig(updatedConfig);
    if (onChange) onChange(updatedConfig);
    setSelectedComponentId(newComponent.id);
  }, [config, persistConfig, onChange]);

  /**
   * Handle deleting selected component
   */
  const handleDeleteComponent = useCallback(() => {
    if (!config || !selectedComponentId) return;

    const updatedConfig = {
      ...config,
      components: config.components.filter(c => c.id !== selectedComponentId),
    };

    setConfig(updatedConfig);
    persistConfig(updatedConfig);
    if (onChange) onChange(updatedConfig);
    setSelectedComponentId(null);
  }, [config, selectedComponentId, persistConfig, onChange]);

  /**
   * Handle attribute edit from inspector
   */
  const handleAttributeEdit = useCallback(
    (componentId: string, changes: Record<string, any>) => {
      if (!config) return;
      
      // For fallback attributes (position, dimensions), apply directly to component
      let updated = { ...config };
      const componentIndex = config.components.findIndex(c => c.id === componentId);
      
      if (componentIndex >= 0) {
        const component = { ...config.components[componentIndex] };
        
        // Handle position changes
        if ('positionX' in changes || 'positionY' in changes || 'positionZ' in changes) {
          component.position = [
            changes.positionX ?? component.position?.[0] ?? 0,
            changes.positionY ?? component.position?.[1] ?? 0,
            changes.positionZ ?? component.position?.[2] ?? 0,
          ];
        }
        
        // Handle dimension changes for box geometry
        if (component.geometry?.type === 'box' && ('width' in changes || 'height' in changes || 'depth' in changes)) {
          const currentDims = component.geometry.dimensions || [100, 100, 50];
          component.geometry = {
            ...component.geometry,
            dimensions: [
              changes.width ?? currentDims[0],
              changes.height ?? currentDims[1],
              changes.depth ?? currentDims[2],
            ],
          };
        }
        
        updated.components = [...config.components];
        updated.components[componentIndex] = component;
      }
      
      // Try to apply edit through scene builder if customData exists
      if (config.customData) {
        try {
          const sceneUpdated = applyEditToScene(config, componentId, changes);
          updated = sceneUpdated;
        } catch (err) {
          console.warn('[handleAttributeEdit] Scene builder failed, using direct update:', err);
        }
      }
      
      setConfig(updated);
      
      // Update editable attributes from builder if available
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
      if (onChange) onChange(updated);
    },
    [config, persistConfig, onChange]
  );

  /**
   * Camera change handler
   */
  const handleCameraChange = useCallback(
    (camera: Partial<CameraState>) => {
      if (!config?.camera) return;
      updateConfig({ camera: { ...config.camera, ...camera } as CameraState });
    },
    [config?.camera, updateConfig]
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
    if (!lineItem) {
      toast.error('No product data available to reset.');
      return;
    }
    
    const params = getOrCreateParams(lineItem);
    if (!params) {
      toast.error('Failed to reset configuration');
      return;
    }
    
    const fresh = initializeSceneFromParams(params, tenantId, entityType, safeEntityId);
    if (fresh) {
      const normalized = normalizeSceneConfig(fresh);
      setConfig(normalized);
      await persistConfig(normalized);
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
    const friendlyMessage = loadError || 'Failed to load configuration';
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6 text-center" style={{ width, height }}>
        <p className="text-lg font-semibold text-foreground">{friendlyMessage}</p>
        <div className="text-sm text-muted-foreground space-y-1 max-w-md">
          {!loadError && (
            <>
              <p>The 3D preview could not initialize. This usually means:</p>
              <ul className="list-disc text-left pl-6 space-y-1">
                <li>Product dimensions are missing or invalid (width ≥ 500mm, height ≥ 1500mm)</li>
                <li>Product type/category is not configured</li>
                <li>Configuration data is corrupted</li>
              </ul>
            </>
          )}
        </div>
        <Button onClick={() => window.location.reload()} className="mt-2">Retry</Button>
      </div>
    );
  }

  // moved: selectedAttributes/fallbackAttributes computed near top before returns

  // Loading state - show spinner with current step
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ width, height }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          Loading 3D builder… ({loadStep})
        </div>
      </div>
    );
  }

  // Error state - show error with retry button
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center" style={{ width, height }}>
        <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20">
          <p className="font-medium text-destructive mb-2">Failed to load 3D configurator</p>
          <p className="text-sm text-muted-foreground mb-4">
            {loadError || 'Unknown error occurred'}
          </p>
          <Button onClick={handleRetry} variant="outline" size="sm">
            Retry
          </Button>
        </div>
        {process.env.NEXT_PUBLIC_DEBUG_3D === 'true' && (
          <div className="text-xs text-muted-foreground">
            Last step: {loadStep}
          </div>
        )}
      </div>
    );
  }

  // Idle state - should not happen, but handle gracefully
  if (status === 'idle') {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Ready state - ensure config is valid before rendering Canvas
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
      <div className="flex flex-col items-center justify-center gap-4 p-8" style={{ width, height }}>
        <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20">
          <p className="font-medium text-destructive mb-2">Invalid configuration</p>
          <p className="text-sm text-muted-foreground mb-4">
            Configuration is missing required properties
          </p>
          <Button onClick={handleRetry} variant="outline" size="sm">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${heroMode ? 'w-full h-full min-h-0' : 'flex gap-4 min-h-0'}`} style={!heroMode ? { width, height } : { width, height }}>
      {/* Main 3D Canvas */}
      <div className={`${heroMode ? 'w-full h-full' : 'flex-1 relative'} bg-gradient-to-b from-slate-100 to-slate-200 ${!heroMode ? 'rounded-lg' : ''} overflow-hidden ${!heroMode ? 'border' : ''} min-h-0`}>
        <Canvas
          key={canvasKey}
          frameloop="demand"
          shadows={isLowPowerMode ? false : "soft"}
          dpr={settingsPreview ? 1 : (isLowPowerMode ? [1, 1] : [1, 2])}
          camera={{
            position: config.camera?.position || [0, 1000, 2000],
            fov: cameraMode === 'Perspective' ? (config.camera?.fov || 50) : 50,
            near: 1,
            far: Math.max(productWidth, productHeight) * 10,
          }}
          gl={{
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: false,
            powerPreference: isLowPowerMode ? 'low-power' : 'high-performance',
          }}
          onCreated={({ gl, scene }) => {
            // Store refs for cleanup
            rendererRef.current = gl;
            sceneRef.current = scene;
            
            if (process.env.NODE_ENV === 'development') {
              console.log('[ProductConfigurator3D] Canvas created, mode:', isLowPowerMode ? 'LOW-POWER' : 'HIGH-PERFORMANCE');
            }
            
            // LOW POWER MODE for Settings preview
            if (isLowPowerMode) {
              gl.setClearColor('#e8e8e8');
              gl.shadowMap.enabled = false; // No shadows
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.NoToneMapping; // Cheapest tone mapping
              gl.toneMappingExposure = 1.0;
              (gl as any).physicallyCorrectLights = false; // Cheaper lighting
            } else {
              // HIGH PERFORMANCE mode for production
              gl.setClearColor('#e8e8e8');
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.0;
              (gl as any).physicallyCorrectLights = true;
            }
            
            // Add context loss/restore handlers
            const canvas = gl.domElement;
            const handleContextLost = (e: Event) => {
              if (process.env.NODE_ENV === 'development') {
                console.error('[ProductConfigurator3D] WebGL context lost');
              }
              e.preventDefault();
              setContextLost(true);
            };
            
            const handleContextRestored = () => {
              if (process.env.NODE_ENV === 'development') {
                console.log('[ProductConfigurator3D] WebGL context restored');
              }
              setContextLost(false);
            };
            
            canvas.addEventListener('webglcontextlost', handleContextLost);
            canvas.addEventListener('webglcontextrestored', handleContextRestored);
            
            if (process.env.NODE_ENV === 'development') {
              console.log('[ProductConfigurator3D] WebGL renderer initialized successfully (preview mode:', isPreviewMode, ')');
            }
            
            // Cleanup event listeners
            return () => {
              canvas.removeEventListener('webglcontextlost', handleContextLost);
              canvas.removeEventListener('webglcontextrestored', handleContextRestored);
            };
          }}
        >
          {/* SceneDisposer ensures complete cleanup on unmount */}
          <SceneDisposer />
          
          {/* Camera controller with controls ref export */}
          <CameraController
            cameraState={config.camera}
            productWidth={productWidth}
            productHeight={productHeight}
            productDepth={productDepth}
            onCameraChange={handleCameraChange}
            onControlsReady={(controls) => {
              controlsRef.current = controls;
            }}
          />
          
          {/* Auto-frame component for smooth auto-zoom on load and config changes */}
          <AutoFrame
            components={config.components}
            controls={controlsRef.current}
            heroMode={heroMode}
          />

          {/* Stage with cyclorama backdrop and floor */}
          <Stage productWidth={productWidth} productHeight={productHeight} hideFloor={settingsPreview} />
          
          {/* Lighting */}
          <Lighting config={config.lighting} />
          
          {/* Product components - Wireframe mode for technical drawing */}
          <ProductComponents
            components={config.components}
            materials={config.materials}
            visibility={config.visibility}
            onSelect={handleComponentSelect}
            selectedId={selectedComponentId}
            orbitControlsRef={controlsRef}
            wireframe={settingsPreview}
            onTransformEnd={(componentId, newY) => {
              handleAttributeEdit(componentId, { positionY: newY });
            }}
          />
          
          {/* Environment - DISABLED: causes WebGL texture errors */}
          {/* <Environment preset="studio" /> */}
          
          {/* Post-processing for subtle polish - DISABLED in hero mode to prevent crashes */}
          <PostFX enabled={!isLowPowerMode && highQuality && !heroMode} heroMode={heroMode} />
        </Canvas>
        
        {/* UI Overlay - Only small floating button in hero mode */}
        {heroMode && (
          <div className="absolute bottom-4 right-4 z-50 pointer-events-auto flex gap-2">
            <Sheet open={showUIDrawer} onOpenChange={setShowUIDrawer}>
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 bg-white/90 backdrop-blur hover:bg-white shadow-lg"
                >
                  <Settings className="h-4 w-4" />
                  View options
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-6 space-y-4">
                <div className="space-y-4">
                  {/* Components List */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Components</h3>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {config.components.map((comp) => (
                        <button
                          key={comp.id}
                          onClick={() => {
                            setSelectedComponentId(comp.id === selectedComponentId ? null : comp.id);
                            if (comp.id !== selectedComponentId) {
                              setShowInspectorDrawer(true);
                            }
                          }}
                          className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent transition-colors ${
                            selectedComponentId === comp.id ? 'bg-primary text-primary-foreground' : ''
                          }`}
                        >
                          {comp.name || comp.type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {(selectedComponentId || showInspectorDrawer) && (
              <Sheet open={showInspectorDrawer} onOpenChange={setShowInspectorDrawer}>
                <SheetTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 bg-white/90 backdrop-blur hover:bg-white shadow-lg"
                  >
                    <Save className="h-4 w-4" />
                    Edit
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 p-4 space-y-4">
                  <InspectorPanel
                    selectedComponentId={selectedComponentId}
                    attributes={effectiveAttributes}
                    onAttributeChange={(changes) => {
                      if (selectedComponentId) {
                        handleAttributeEdit(selectedComponentId, changes);
                      }
                    }}
                  />
                </SheetContent>
              </Sheet>
            )}
          </div>
        )}

        {/* UI Overlay - Full scene UI in normal mode (hidden in settingsPreview) */}
        {!heroMode && !settingsPreview && (
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
            qualityEnabled={highQuality}
            onQualityToggle={setHighQuality}
          />
        )}
        
        {/* Save indicator */}
        {isSaving && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-md shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Saving...</span>
          </div>
        )}
      </div>
      
      {/* Settings Preview UI - Shows components list and inspector */}
      {settingsPreview && config && (
        <div className="w-80 flex flex-col gap-4 min-h-0 overflow-y-auto bg-white border-l p-4">
          {/* Components List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Components</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {(config.components || []).map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => {
                    setSelectedComponentId(comp.id === selectedComponentId ? null : comp.id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    comp.id === selectedComponentId
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {comp.name || comp.id}
                </button>
              ))}
            </div>
          </div>
          
          {/* Inspector */}
          <InspectorPanel
            selectedComponentId={selectedComponentId}
            attributes={effectiveAttributes}
            onAttributeChange={(changes) => {
              if (selectedComponentId) {
                handleAttributeEdit(selectedComponentId, changes);
              }
            }}
          />
          
          {/* AI Component Generation */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">AI Component Generation</h3>
            <p className="text-xs text-muted-foreground">
              Describe your product or upload a photo to automatically generate components
            </p>
            <Button variant="outline" className="w-full" size="sm">
              Generate from Description
            </Button>
            <Button variant="outline" className="w-full" size="sm">
              Generate from Photo
            </Button>
          </div>
          
          {/* Component Actions */}
          <div className="space-y-2 border-t pt-4">
            <Button variant="outline" className="w-full" size="sm" onClick={handleAddComponent}>
              Add Component
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              size="sm"
              disabled={!selectedComponentId}
              onClick={handleDeleteComponent}
            >
              Delete Selected
            </Button>
          </div>
        </div>
      )}
      
      {/* Inspector Panel */}
      {!heroMode && !settingsPreview && (
        <div className="w-80 flex flex-col gap-4 min-h-0 overflow-y-auto">
          <InspectorPanel
            selectedComponentId={selectedComponentId}
            attributes={effectiveAttributes}
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
      )}
      
      {/* WebGL Context Loss Recovery Overlay */}
      {contextLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4 text-center space-y-4">
            <div className="text-red-500">
              <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">3D Preview Paused</h3>
              <p className="text-sm text-gray-600">
                The WebGL renderer encountered an error. Click below to restart the 3D view.
              </p>
            </div>
            <Button
              onClick={() => {
                setContextLost(false);
                setCanvasKey(prev => prev + 1);
                if (process.env.NODE_ENV === 'development') {
                  console.log('[ProductConfigurator3D] Retrying after context loss');
                }
              }}
              className="w-full"
            >
              Retry 3D Preview
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
