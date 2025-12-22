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
import {
  SceneConfig,
  CameraState,
  ComponentVisibility,
  UIToggles,
  CameraMode,
  DEFAULT_UI_TOGGLES,
  LightingConfig,
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
import { InspectorPanel } from './InspectorPanel';
import { AutoFrame } from './AutoFrame';
import { Stage } from './Stage';
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
}: ProductConfigurator3DProps) {
  // ===== ALL STATE & REFS (MUST BE AT TOP) =====
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
  
  const controlsRef = useRef<any>(null);
  const initialFrameApplied = useRef(false);
  const loadInitiated = useRef(false);
  const mountedRef = useRef(true);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Track mount/unmount for debugging
  useEffect(() => {
    console.log('[ProductConfigurator3D] Component mounted');
    return () => {
      console.log('[ProductConfigurator3D] Component unmounting - THIS CAUSES CONTEXT LOSS');
      mountedRef.current = false;
      if (rendererRef.current) {
        console.log('[ProductConfigurator3D] Disposing renderer on unmount');
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

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

  // Main scene load/initialize effect
  useEffect(() => {
    // Prevent duplicate loads in React StrictMode AND re-render loops
    if (loadInitiated.current) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[ProductConfigurator3D] Skipping duplicate load - already initialized');
      }
      return;
    }
    loadInitiated.current = true;

    async function load() {
      if (!mountedRef.current) return;
      setIsLoading(true);
      setLoadError(null);
      
      let loaded: SceneConfig | null = null;
      
      // 1. Try to use provided initialConfig first
      if (initialConfig) {
        loaded = initialConfig;
        console.log('[ProductConfigurator3D] Using provided initialConfig');
      }
      // 2. Try to load existing scene state from database
      else if (!isPreviewMode) {
        loaded = await loadSceneState(tenantId, entityType, safeEntityId);
      }
      
      if (!loaded) {
        // Initialize from line item
        try {
          console.log('[ProductConfigurator3D] Initializing from lineItem:', { lineItem, tenantId, entityType, entityId: safeEntityId });
          
          const previewProductType = productType || lineItem?.configuredProduct?.productType;
          let effectiveLineItem = lineItem ?? {};
          if (isPreviewMode) {
            if (!previewProductType) {
              console.warn('[ProductConfigurator3D] Preview mode requires a product type');
              if (mountedRef.current) {
                const message = 'Select a product type to preview in 3D.';
                setLoadError(message);
                toast.error(message);
                setIsLoading(false);
              }
              return;
            }
            const defaults = getPreviewDefaults(previewProductType);
            const widthMm = Number((lineItem as any)?.lineStandard?.widthMm) || defaults.widthMm;
            const heightMm = Number((lineItem as any)?.lineStandard?.heightMm) || defaults.heightMm;
            const depthMm = Number((lineItem as any)?.meta?.depthMm) || defaults.depthMm;

            console.log('[ProductConfigurator3D] Using preview mode with productType:', previewProductType);
            effectiveLineItem = {
              ...(lineItem || {}),
              configuredProduct: {
                ...(lineItem as any)?.configuredProduct,
                productType: previewProductType,
              },
              lineStandard: {
                widthMm,
                heightMm,
              },
              meta: {
                ...(lineItem as any)?.meta,
                depthMm,
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
            if (!mountedRef.current) return;
            const message = isPreviewMode
              ? 'Select a product type to preview in 3D.'
              : 'Please configure the product type before opening 3D preview';
            setLoadError(message);
            toast.error(message);
            setIsLoading(false);
            return;
          }
          
          const params = getOrCreateParams(effectiveLineItem);
          console.log('[ProductConfigurator3D] Generated params:', params);
          
          if (params) {
            loaded = initializeSceneFromParams(params, tenantId, entityType, safeEntityId);
            console.log('[ProductConfigurator3D] Scene initialized:', loaded ? 'success' : 'null');
            
            if (loaded && !isPreviewMode) {
              // Save initial state (skip for preview mode)
              await saveSceneState(tenantId, entityType, safeEntityId, loaded);
            }
          } else {
            console.error('[ProductConfigurator3D] Failed to generate params from lineItem:', effectiveLineItem);
            setLoadError('Failed to create a preview. Please check product dimensions and type.');
          }
        } catch (error) {
          console.error('[ProductConfigurator3D] Error initializing scene:', error, { lineItem });
          setLoadError('Failed to initialize 3D preview. Please try again.');
        }
      }
      
      if (!mountedRef.current) return;
      
      if (loaded) {
        const normalized = normalizeSceneConfig(loaded);
        setConfig(normalized);
        // Extract editable attributes from customData
        if (normalized.customData) {
          const builder = await import('@/lib/scene/builder-registry');
          const result = builder.buildScene(normalized.customData as ProductParams);
          if (result?.editableAttributes) {
            setEditableAttributes(result.editableAttributes);
          }
        }
        // Give React time to update state before rendering Canvas
        setTimeout(() => {
          if (mountedRef.current) {
            setCanRender(true);
          }
        }, 100);
      } else {
        console.error('[ProductConfigurator3D] Failed to initialize configurator', { lineItem, tenantId, entityType, entityId });
        const message =
          loadError ||
          'Failed to load 3D configurator. Please ensure the product has valid dimensions and type.';
        setLoadError(message);
        toast.error(message);
      }
      
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
    
    load();
    // Use stable keys instead of objects to prevent infinite re-renders
  }, [tenantId, entityType, safeEntityId, lineItemKey, productTypeKey, isPreviewMode]);

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

  return (
    <div className={`relative ${heroMode ? 'w-full h-full min-h-0' : 'flex gap-4 min-h-0'}`} style={!heroMode ? { width, height } : { width, height }}>
      {/* Main 3D Canvas */}
      <div className={`${heroMode ? 'w-full h-full' : 'flex-1 relative'} bg-gradient-to-b from-slate-100 to-slate-200 ${!heroMode ? 'rounded-lg' : ''} overflow-hidden ${!heroMode ? 'border' : ''} min-h-0`}>
        <Canvas
          frameloop="demand"
          shadows="soft"
          dpr={[1, 2]}
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
          }}
          onCreated={({ gl }) => {
            console.log('[ProductConfigurator3D] Canvas created, initializing WebGL renderer');
            // Improved renderer settings for better quality
            rendererRef.current = gl;
            gl.setClearColor('#e8e8e8');
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
            (gl as any).physicallyCorrectLights = true;
            
            // Add context loss/restore handlers
            const canvas = gl.domElement;
            canvas.addEventListener('webglcontextlost', (e) => {
              console.error('[ProductConfigurator3D] WebGL context lost', e);
              e.preventDefault();
            });
            canvas.addEventListener('webglcontextrestored', () => {
              console.log('[ProductConfigurator3D] WebGL context restored');
            });
            console.log('[ProductConfigurator3D] WebGL renderer initialized successfully');
          }}
        >
          {/* REMOVED SUSPENSE - testing if it causes context loss */}
          {/* <Suspense fallback={null}> */}
            {/* TESTING: Disable all components to isolate context loss */}
            
            {/* Camera controller with controls ref export - DISABLED FOR TESTING */}
            {/* <CameraController
              cameraState={config.camera}
              productWidth={productWidth}
              productHeight={productHeight}
              productDepth={productDepth}
              onCameraChange={handleCameraChange}
              onControlsReady={(controls) => {
                controlsRef.current = controls;
              }}
            /> */}
            
            {/* Auto-frame component for smooth auto-zoom on load and config changes - DISABLED FOR TESTING */}
            {/* <AutoFrame
              components={config.components}
              controls={controlsRef.current}
              heroMode={heroMode}
            /> */}

            {/* Stage - DISABLED: testing if it contributes to context loss */}
            {/* <Stage productWidth={productWidth} productHeight={productHeight} /> */}
            
            {/* Lighting - DISABLED FOR TESTING */}
            {/* <Lighting config={config.lighting} /> */}
            
            {/* Contact shadows - DISABLED: may contribute to WebGL context loss */}
            {/* <ContactShadows
              position={[0, 0.5, 0]}
              opacity={0.35}
              blur={2.5}
              far={10}
              scale={Math.max(productWidth, productHeight) / 800}
            /> */}
            
            {/* Product components - DISABLED FOR TESTING */}
            {/* <ProductComponents
              components={config.components}
              materials={config.materials}
              visibility={config.visibility}
              onSelect={handleComponentSelect}
              selectedId={selectedComponentId}
              orbitControlsRef={controlsRef}
              onTransformEnd={(componentId, newY) => {
                handleAttributeEdit(componentId, { positionY: newY });
              }}
            /> */}
            
            {/* Just render a simple mesh to test if Canvas works */}
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial color="orange" />
            </mesh>
            
            {/* Environment - DISABLED: causes WebGL texture errors "texSubImage2D: bad image data" */}
            {/* <Environment preset="studio" /> */}

            {/* Post-processing for subtle polish - DISABLED in hero mode to prevent crashes */}
            <PostFX enabled={highQuality && !heroMode} heroMode={heroMode} />
          {/* </Suspense> */}
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
                  {/* Camera Controls */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Camera</h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={cameraMode === 'Perspective' ? 'default' : 'outline'}
                        onClick={() => {
                          updateConfig({
                            camera: { ...config.camera, mode: 'Perspective' },
                          });
                        }}
                        className="flex-1 text-xs"
                      >
                        Perspective
                      </Button>
                      <Button
                        size="sm"
                        variant={cameraMode === 'Ortho' ? 'default' : 'outline'}
                        onClick={() => {
                          updateConfig({
                            camera: { ...config.camera, mode: 'Ortho' },
                          });
                        }}
                        className="flex-1 text-xs"
                      >
                        Orthographic
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
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
                      className="w-full text-xs"
                    >
                      Reset View
                    </Button>
                  </div>

                  {/* View Options */}
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold">View</h3>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.ui.guides}
                        onChange={(e) => {
                          updateConfig({
                            ui: { ...config.ui, guides: e.target.checked },
                          });
                        }}
                        className="rounded"
                      />
                      <span>Show Grid</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.ui.axis}
                        onChange={(e) => {
                          updateConfig({
                            ui: { ...config.ui, axis: e.target.checked },
                          });
                        }}
                        className="rounded"
                      />
                      <span>Show Axis</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={highQuality}
                        onChange={(e) => setHighQuality(e.target.checked)}
                        className="rounded"
                      />
                    <span>High Quality</span>
                    </label>
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
                    attributes={selectedAttributes}
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

        {/* UI Overlay - Full scene UI in normal mode */}
        {!heroMode && (
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
      
      {/* Inspector Panel */}
      {!heroMode && (
        <div className="w-80 flex flex-col gap-4 min-h-0 overflow-y-auto">
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
      )}
    </div>
  );
}
